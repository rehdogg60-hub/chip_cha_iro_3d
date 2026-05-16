import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { defaultAnimation, type ChipAnimationName } from "../game/animations";
import { checkpointPoint, goalPoint, platforms, spawnPoint, treats } from "../game/level";

export type GraphicsQuality = "low" | "medium" | "high";

export interface MobileControls {
  x: number;
  z: number;
  sprint: boolean;
  jumpToken: number;
}

export interface GameStats {
  treats: number;
  goldenTreats: number;
  falls: number;
  score: number;
  animation: ChipAnimationName;
}

interface ChipSceneProps {
  modelPath: string;
  enabled: boolean;
  runId: number;
  mobileControls: MobileControls;
  debugMode: boolean;
  soundOn: boolean;
  graphicsQuality: GraphicsQuality;
  onStatsChange: (stats: GameStats) => void;
  onComplete: () => void;
}

interface BurstParticle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

const startStats: GameStats = { treats: 0, goldenTreats: 0, falls: 0, score: 0, animation: "Idle" };

export function ChipScene({
  modelPath,
  enabled,
  runId,
  mobileControls,
  debugMode,
  soundOn,
  graphicsQuality,
  onStatsChange,
  onComplete
}: ChipSceneProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const enabledRef = useRef(enabled);
  const mobileRef = useRef(mobileControls);
  const debugRef = useRef(debugMode);
  const soundRef = useRef(soundOn);
  const graphicsRef = useRef(graphicsQuality);
  const statsRef = useRef<GameStats>(startStats);
  const keysRef = useRef(new Set<string>());
  const requestedJumpRef = useRef(0);
  const actionsRef = useRef<Partial<Record<ChipAnimationName, THREE.AnimationAction>>>({});
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);

  useEffect(() => { enabledRef.current = enabled; }, [enabled]);
  useEffect(() => { mobileRef.current = mobileControls; }, [mobileControls]);
  useEffect(() => { requestedJumpRef.current = mobileControls.jumpToken; }, [mobileControls.jumpToken]);
  useEffect(() => { debugRef.current = debugMode; }, [debugMode]);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);
  useEffect(() => { graphicsRef.current = graphicsQuality; }, [graphicsQuality]);

  function playAnimation(name: ChipAnimationName) {
    const nextAction = actionsRef.current[name] || actionsRef.current[defaultAnimation];
    if (!nextAction || currentActionRef.current === nextAction) return;
    const previousAction = currentActionRef.current;
    const fadeTime = name === "Jump" || name === "Fall" ? 0.08 : 0.18;
    nextAction.reset().setEffectiveWeight(1).setEffectiveTimeScale(1).fadeIn(fadeTime).play();
    previousAction?.fadeOut(fadeTime);
    currentActionRef.current = nextAction;
  }

  useEffect(() => {
    if (!mountRef.current) return;
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x101926, 10, 34);

    const camera = new THREE.PerspectiveCamera(52, mount.clientWidth / mount.clientHeight, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: graphicsRef.current !== "low", alpha: true });
    renderer.setPixelRatio(pixelRatioFor(graphicsRef.current));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const clock = new THREE.Clock();
    const raycaster = new THREE.Raycaster();
    const cameraBlockers: THREE.Object3D[] = [];
    const player = new THREE.Group();
    player.position.set(spawnPoint.x, spawnPoint.y, spawnPoint.z);
    scene.add(player);

    let mixer: THREE.AnimationMixer | null = null;
    let modelRoot: THREE.Object3D | null = null;
    let modelBaseScale = 1;
    let velocityY = 0;
    let grounded = false;
    let wasGrounded = false;
    let coyoteTimer = 0;
    let jumpBufferTimer = 0;
    let lastJumpToken = 0;
    let gamepadJumpWasPressed = false;
    let completed = false;
    let celebrationUntil = 0;
    let checkpointReached = false;
    const currentCheckpoint = new THREE.Vector3(spawnPoint.x, spawnPoint.y, spawnPoint.z);
    const collected = new Set<string>();
    const treatMeshes = new Map<string, THREE.Object3D>();
    const sparkleSources = new Map<string, THREE.Object3D>();
    const particles: BurstParticle[] = [];
    const stats: GameStats = { ...startStats };
    statsRef.current = stats;
    onStatsChange(stats);

    let audioContext: AudioContext | null = null;

    const materials = {
      grass: new THREE.MeshStandardMaterial({ color: 0x4fab5f, roughness: 0.72 }),
      grassTop: new THREE.MeshStandardMaterial({ color: 0x66cf73, roughness: 0.7 }),
      wood: new THREE.MeshStandardMaterial({ color: 0x8f5c2c, roughness: 0.58 }),
      stone: new THREE.MeshStandardMaterial({ color: 0x7e8790, roughness: 0.76 }),
      water: new THREE.MeshStandardMaterial({ color: 0x1779b8, roughness: 0.25, transparent: true, opacity: 0.62 }),
      treat: new THREE.MeshStandardMaterial({ color: 0xd58a36, roughness: 0.38, emissive: 0x3a1700, emissiveIntensity: 0.08 }),
      golden: new THREE.MeshStandardMaterial({ color: 0xffd45a, roughness: 0.24, metalness: 0.12, emissive: 0x9d6500, emissiveIntensity: 0.45 }),
      glow: new THREE.MeshBasicMaterial({ color: 0xffd45a, transparent: true, opacity: 0.18, depthWrite: false }),
      sparkle: new THREE.MeshBasicMaterial({ color: 0xfff3b4, transparent: true, opacity: 0.92 }),
      dust: new THREE.MeshBasicMaterial({ color: 0xf2d49a, transparent: true, opacity: 0.72 }),
      checkpoint: new THREE.MeshStandardMaterial({ color: 0x64d9ff, roughness: 0.24, emissive: 0x0b4a6a, emissiveIntensity: 0.5 }),
      checkpointDone: new THREE.MeshStandardMaterial({ color: 0xffd45a, roughness: 0.24, emissive: 0x6d4600, emissiveIntensity: 0.55 }),
      goal: new THREE.MeshStandardMaterial({ color: 0xffde72, roughness: 0.28, emissive: 0x4b2c00, emissiveIntensity: 0.2 })
    };

    scene.add(new THREE.HemisphereLight(0xcbeeff, 0x254225, 2.6));
    const sun = new THREE.DirectionalLight(0xffe1a6, 4.2);
    sun.position.set(-3, 8, 5);
    scene.add(sun);

    const field = new THREE.Mesh(new THREE.PlaneGeometry(26, 15), materials.grassTop);
    field.rotation.x = -Math.PI / 2;
    field.position.y = -0.04;
    scene.add(field);

    const water = new THREE.Mesh(new THREE.PlaneGeometry(7.4, 4.5), materials.water);
    water.rotation.x = -Math.PI / 2;
    water.position.set(4.7, 0.05, -0.15);
    scene.add(water);

    platforms.forEach(platform => {
      const material = platform.kind === "wood" ? materials.wood : platform.kind === "stone" ? materials.stone : materials.grass;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(platform.width, platform.height, platform.depth), material);
      mesh.position.set(platform.x, platform.y - platform.height / 2, platform.z);
      scene.add(mesh);
      if (platform.id !== "field") cameraBlockers.push(mesh);
    });

    const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.18, 2.2), materials.wood);
    ramp.position.set(-2.15, 0.42, 0);
    ramp.rotation.z = -0.24;
    scene.add(ramp);
    cameraBlockers.push(ramp);

    const bridgeRailMat = new THREE.MeshStandardMaterial({ color: 0x65401e, roughness: 0.62 });
    [-0.55, 0.85].forEach(z => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(2.9, 0.12, 0.1), bridgeRailMat);
      rail.position.set(5.7, 1.22, z);
      scene.add(rail);
      cameraBlockers.push(rail);
    });

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b3f1f, roughness: 0.7 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e8c45, roughness: 0.74 });
    [[-8.5, -3.3], [-4.6, 3.2], [0.2, 3.4], [8.6, -2.8]].forEach(([x, z]) => {
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 8), trunkMat);
      trunk.position.set(x, 0.45, z);
      const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.35, 8), leafMat);
      leaves.position.set(x, 1.38, z);
      scene.add(trunk, leaves);
      cameraBlockers.push(trunk, leaves);
    });

    [[-7.7, 2.8], [-1.2, -2.8], [4.0, 2.7], [9.4, 2.2]].forEach(([x, z]) => {
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.35, 0), materials.stone);
      rock.scale.set(1.25, 0.65, 0.9);
      rock.position.set(x, 0.22, z);
      scene.add(rock);
      cameraBlockers.push(rock);
    });

    const checkpoint = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.035, 8, 28), materials.checkpoint);
    checkpoint.position.set(checkpointPoint.x, checkpointPoint.y, checkpointPoint.z);
    checkpoint.rotation.x = Math.PI / 2;
    scene.add(checkpoint);
    const checkpointLight = new THREE.PointLight(0x64d9ff, 1.8, 3.4);
    checkpointLight.position.copy(checkpoint.position);
    scene.add(checkpointLight);

    treats.forEach(treat => {
      const mesh = new THREE.Mesh(
        treat.golden ? new THREE.IcosahedronGeometry(0.22, 1) : new THREE.CapsuleGeometry(0.11, 0.22, 4, 8),
        treat.golden ? materials.golden : materials.treat
      );
      mesh.position.set(treat.x, treat.y, treat.z);
      const group = new THREE.Group();
      group.add(mesh);
      group.position.set(treat.x, treat.y, treat.z);
      mesh.position.set(0, 0, 0);
      if (treat.golden) {
        const glow = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10), materials.glow);
        group.add(glow);
        const light = new THREE.PointLight(0xffd45a, 1.2, 2.6);
        group.add(light);
      }
      scene.add(group);
      treatMeshes.set(treat.id, group);
      sparkleSources.set(treat.id, group);
    });

    const goal = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.06, 10, 32), materials.goal);
    goal.position.set(goalPoint.x, goalPoint.y + 0.75, goalPoint.z);
    goal.rotation.y = Math.PI / 2;
    scene.add(goal);

    const loader = new GLTFLoader();
    loader.load(modelPath, gltf => {
      const model = gltf.scene;
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const scale = 1.25 / Math.max(size.x, size.y, size.z);
      modelBaseScale = scale;
      model.position.sub(center);
      model.position.y -= box.min.y - center.y;
      model.scale.setScalar(scale);
      player.add(model);
      modelRoot = model;
      mixer = new THREE.AnimationMixer(model);
      gltf.animations.forEach(clip => {
        const name = clip.name as ChipAnimationName;
        const action = mixer!.clipAction(clip);
        if (name === "Jump" || name === "Celebrate" || name === "Fall") {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        actionsRef.current[name] = action;
      });
      playAnimation("Idle");
    });

    function pixelRatioForCurrentQuality() {
      const nextPixelRatio = pixelRatioFor(graphicsRef.current);
      if (renderer.getPixelRatio() !== nextPixelRatio) renderer.setPixelRatio(nextPixelRatio);
      scene.fog = graphicsRef.current === "low" ? new THREE.Fog(0x101926, 8, 28) : new THREE.Fog(0x101926, 10, 34);
    }

    function getAudioContext() {
      if (!audioContext) audioContext = new AudioContext();
      if (audioContext.state === "suspended") void audioContext.resume();
      return audioContext;
    }

    function playSound(kind: "bark" | "pickup" | "jump" | "goal" | "land") {
      if (!soundRef.current) return;
      try {
        const context = getAudioContext();
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const now = context.currentTime;
        const settings = {
          bark: { start: 180, end: 130, duration: 0.18, volume: 0.055, type: "square" as OscillatorType },
          pickup: { start: 660, end: 990, duration: 0.12, volume: 0.045, type: "sine" as OscillatorType },
          jump: { start: 330, end: 520, duration: 0.1, volume: 0.04, type: "triangle" as OscillatorType },
          goal: { start: 520, end: 1040, duration: 0.42, volume: 0.055, type: "sine" as OscillatorType },
          land: { start: 95, end: 70, duration: 0.08, volume: 0.035, type: "triangle" as OscillatorType }
        }[kind];
        oscillator.type = settings.type;
        oscillator.frequency.setValueAtTime(settings.start, now);
        oscillator.frequency.exponentialRampToValueAtTime(settings.end, now + settings.duration);
        gain.gain.setValueAtTime(settings.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + settings.duration);
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + settings.duration);
      } catch {
        // Audio placeholders should never interrupt gameplay if the browser blocks sound.
      }
    }

    function emitStats(animation: ChipAnimationName) {
      stats.animation = animation;
      stats.score = Math.max(0, stats.treats * 10 + stats.goldenTreats * 100 - stats.falls * 25);
      statsRef.current = { ...stats };
      onStatsChange(statsRef.current);
    }

    function surfaceHeight(x: number, z: number) {
      let height = 0;
      for (const platform of platforms) {
        const inX = Math.abs(x - platform.x) <= platform.width / 2;
        const inZ = Math.abs(z - platform.z) <= platform.depth / 2;
        if (inX && inZ) height = Math.max(height, platform.y);
      }
      return height;
    }

    function emitBurst(position: THREE.Vector3, color: number, count: number, power: number) {
      const particleCount = graphicsRef.current === "low" ? Math.ceil(count * 0.45) : graphicsRef.current === "medium" ? Math.ceil(count * 0.7) : count;
      for (let index = 0; index < particleCount; index += 1) {
        const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 4), material);
        mesh.position.copy(position);
        scene.add(mesh);
        const angle = Math.random() * Math.PI * 2;
        const lift = 0.6 + Math.random() * power;
        particles.push({
          mesh,
          velocity: new THREE.Vector3(Math.cos(angle) * power * Math.random(), lift, Math.sin(angle) * power * Math.random()),
          life: 0,
          maxLife: 0.42 + Math.random() * 0.28
        });
      }
    }

    function updateParticles(dt: number) {
      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        particle.life += dt;
        particle.velocity.y -= 4.2 * dt;
        particle.mesh.position.addScaledVector(particle.velocity, dt);
        const material = particle.mesh.material as THREE.MeshBasicMaterial;
        material.opacity = Math.max(0, 1 - particle.life / particle.maxLife);
        particle.mesh.scale.setScalar(1 + particle.life * 1.8);
        if (particle.life >= particle.maxLife) {
          particle.mesh.removeFromParent();
          particle.mesh.geometry.dispose();
          material.dispose();
          particles.splice(index, 1);
        }
      }
    }

    function updateTreatSparkles(dt: number, elapsed: number) {
      if (graphicsRef.current === "low") return;
      sparkleSources.forEach((source, id) => {
        const golden = id.startsWith("gold");
        source.rotation.y += dt * (golden ? 3 : 2.1);
        source.position.y += Math.sin(elapsed * 4 + source.position.x) * 0.0008;
        if (Math.random() < dt * (golden ? 8 : 3)) {
          const offset = new THREE.Vector3((Math.random() - 0.5) * 0.45, (Math.random() - 0.1) * 0.34, (Math.random() - 0.5) * 0.45);
          const mesh = new THREE.Mesh(new THREE.SphereGeometry(golden ? 0.035 : 0.024, 5, 4), materials.sparkle.clone());
          mesh.position.copy(source.position).add(offset);
          scene.add(mesh);
          particles.push({
            mesh,
            velocity: new THREE.Vector3(0, 0.35 + Math.random() * 0.35, 0),
            life: 0,
            maxLife: golden ? 0.48 : 0.32
          });
        }
      });
    }

    function respawn() {
      stats.falls += 1;
      player.position.copy(currentCheckpoint);
      velocityY = 0;
      playSound("land");
      emitBurst(player.position.clone().add(new THREE.Vector3(0, 0.15, 0)), 0x8edfff, 12, 1.1);
      playAnimation("Fall");
      emitStats("Fall");
    }

    function readGamepad() {
      const empty = { x: 0, z: 0, sprint: false, jumpPressed: false };
      const pads = navigator.getGamepads?.();
      if (!pads) return empty;
      const pad = Array.from(pads).find(Boolean);
      if (!pad) return empty;
      const axisX = Math.abs(pad.axes[0] ?? 0) > 0.18 ? pad.axes[0] ?? 0 : 0;
      const axisY = Math.abs(pad.axes[1] ?? 0) > 0.18 ? pad.axes[1] ?? 0 : 0;
      const dpadX = (pad.buttons[15]?.pressed ? 1 : 0) - (pad.buttons[14]?.pressed ? 1 : 0);
      const dpadZ = (pad.buttons[12]?.pressed ? 1 : 0) - (pad.buttons[13]?.pressed ? 1 : 0);
      return {
        x: axisX || dpadX,
        z: -axisY || dpadZ,
        sprint: Boolean(pad.buttons[1]?.pressed || pad.buttons[7]?.pressed || pad.buttons[10]?.pressed),
        jumpPressed: Boolean(pad.buttons[0]?.pressed || pad.buttons[2]?.pressed)
      };
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.code === "Space") event.preventDefault();
      keysRef.current.add(event.code);
    }

    function onKeyUp(event: KeyboardEvent) {
      keysRef.current.delete(event.code);
    }

    function onResize() {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("resize", onResize);

    let frameId = 0;
    function animate() {
      frameId = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.04);
      const elapsed = clock.elapsedTime;
      const now = performance.now();
      pixelRatioForCurrentQuality();
      mixer?.update(dt);
      goal.rotation.z += dt * 1.4;
      checkpoint.rotation.z += dt * 1.8;
      checkpointLight.intensity = checkpointReached ? 1.1 + Math.sin(elapsed * 5) * 0.25 : 1.6 + Math.sin(elapsed * 6) * 0.5;
      updateTreatSparkles(dt, elapsed);
      updateParticles(dt);

      if (enabledRef.current && !completed) {
        const keys = keysRef.current;
        const mobile = mobileRef.current;
        const gamepad = readGamepad();
        const inputX = (keys.has("KeyD") || keys.has("ArrowRight") ? 1 : 0) - (keys.has("KeyA") || keys.has("ArrowLeft") ? 1 : 0) + mobile.x + gamepad.x;
        const inputZ = (keys.has("KeyW") || keys.has("ArrowUp") ? 1 : 0) - (keys.has("KeyS") || keys.has("ArrowDown") ? 1 : 0) + mobile.z + gamepad.z;
        const direction = new THREE.Vector3(inputX, 0, inputZ);
        const moving = direction.lengthSq() > 0.02;
        const sprinting = keys.has("ShiftLeft") || keys.has("ShiftRight") || mobile.sprint || gamepad.sprint;
        const ground = surfaceHeight(player.position.x, player.position.z);
        wasGrounded = grounded;
        grounded = player.position.y <= ground + 0.92 && velocityY <= 0.2;
        coyoteTimer = grounded ? 0.13 : Math.max(0, coyoteTimer - dt);

        if (requestedJumpRef.current !== lastJumpToken) {
          lastJumpToken = requestedJumpRef.current;
          jumpBufferTimer = 0.15;
        }
        if (keys.has("Space")) jumpBufferTimer = Math.max(jumpBufferTimer, 0.08);
        if (gamepad.jumpPressed && !gamepadJumpWasPressed) jumpBufferTimer = 0.15;
        gamepadJumpWasPressed = gamepad.jumpPressed;
        jumpBufferTimer = Math.max(0, jumpBufferTimer - dt);

        if (moving) {
          direction.normalize();
          const speed = sprinting ? 5.45 : 3.2;
          player.position.x += direction.x * speed * dt;
          player.position.z += direction.z * speed * dt;
          player.rotation.y = Math.atan2(direction.x, direction.z);
        }

        if (jumpBufferTimer > 0 && coyoteTimer > 0) {
          velocityY = 6.9;
          grounded = false;
          coyoteTimer = 0;
          jumpBufferTimer = 0;
          playSound("jump");
          emitBurst(player.position.clone().add(new THREE.Vector3(0, -0.55, 0)), 0xf4d29a, 8, 0.7);
        }

        const gravity = velocityY < 0 ? 18.5 : 14.5;
        velocityY -= gravity * dt;
        player.position.y += velocityY * dt;
        const updatedGround = surfaceHeight(player.position.x, player.position.z);
        if (player.position.y <= updatedGround + 0.9) {
          player.position.y = updatedGround + 0.9;
          if (!wasGrounded && velocityY < -1.2) {
            playSound("land");
            emitBurst(player.position.clone().add(new THREE.Vector3(0, -0.55, 0)), 0xe7c58c, 10, 0.55);
            if (modelRoot) {
              modelRoot.scale.y = modelBaseScale * 0.92;
              window.setTimeout(() => {
                if (modelRoot) modelRoot.scale.y = modelBaseScale;
              }, 90);
            }
          }
          velocityY = 0;
          grounded = true;
        }

        if (!checkpointReached && player.position.distanceTo(checkpoint.position) < 0.82) {
          checkpointReached = true;
          currentCheckpoint.set(checkpointPoint.x, checkpointPoint.y - 0.95, checkpointPoint.z);
          checkpoint.material = materials.checkpointDone;
          playSound("bark");
          emitBurst(checkpoint.position, 0xffd45a, 22, 1.35);
        }

        if (player.position.y < -2.2 || (player.position.x > 2.4 && player.position.x < 7.1 && Math.abs(player.position.z) < 2.1 && updatedGround < 0.3)) {
          respawn();
        }

        treats.forEach(treat => {
          if (collected.has(treat.id)) return;
          const distance = player.position.distanceTo(new THREE.Vector3(treat.x, treat.y, treat.z));
          if (distance < 0.72) {
            collected.add(treat.id);
            const source = treatMeshes.get(treat.id);
            const burstPosition = source?.position.clone() || new THREE.Vector3(treat.x, treat.y, treat.z);
            source?.removeFromParent();
            treatMeshes.delete(treat.id);
            sparkleSources.delete(treat.id);
            if (treat.golden) {
              stats.goldenTreats += 1;
              celebrationUntil = now + 1400;
              playSound("goal");
              emitBurst(burstPosition, 0xffd45a, 30, 1.7);
              playAnimation("Celebrate");
              emitStats("Celebrate");
            } else {
              stats.treats += 1;
              playSound("pickup");
              emitBurst(burstPosition, 0xffc16b, 12, 0.8);
            }
          }
        });

        if (player.position.distanceTo(new THREE.Vector3(goalPoint.x, goalPoint.y, goalPoint.z)) < 1.0) {
          completed = true;
          celebrationUntil = now + 1400;
          playSound("goal");
          emitBurst(goal.position, 0xffd45a, 38, 1.9);
          playAnimation("Celebrate");
          emitStats("Celebrate");
          window.setTimeout(onComplete, 900);
        }

        let animation: ChipAnimationName = "Idle";
        if (now < celebrationUntil) animation = "Celebrate";
        else if (!grounded) animation = velocityY < -0.3 ? "Fall" : "Jump";
        else if (moving) animation = sprinting ? "Run" : "Walk";
        playAnimation(animation);
        emitStats(animation);
      }

      const lookTarget = new THREE.Vector3(player.position.x, player.position.y + 0.82, player.position.z);
      const desiredCamera = new THREE.Vector3(0, 2.85, -5.25)
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), player.rotation.y)
        .add(player.position);
      const rayDirection = desiredCamera.clone().sub(lookTarget);
      const rayDistance = rayDirection.length();
      rayDirection.normalize();
      raycaster.set(lookTarget, rayDirection);
      raycaster.far = rayDistance;
      const hit = raycaster.intersectObjects(cameraBlockers, false)[0];
      const cameraTarget = hit ? hit.point.addScaledVector(rayDirection, -0.35) : desiredCamera;
      camera.position.lerp(cameraTarget, 0.11);
      camera.lookAt(lookTarget);
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("resize", onResize);
      mixer?.stopAllAction();
      audioContext?.close();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [modelPath, runId, onComplete, onStatsChange]);

  return <div className="scene-stage" ref={mountRef} />;
}

function pixelRatioFor(quality: GraphicsQuality) {
  const dpr = window.devicePixelRatio || 1;
  if (quality === "low") return 1;
  if (quality === "medium") return Math.min(dpr, 1.5);
  return Math.min(dpr, 2);
}
