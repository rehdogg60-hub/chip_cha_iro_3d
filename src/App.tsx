import { useEffect, useRef, useState } from "react";
import { ChipScene, type GameStats, type GraphicsQuality, type MobileControls } from "./components/ChipScene";
import { totalGoldenTreats, totalRegularTreats } from "./game/level";
import { gameTitle, modelPath } from "./game/constants";

type GamePhase = "start" | "playing" | "complete";

const initialStats: GameStats = {
  treats: 0,
  goldenTreats: 0,
  falls: 0,
  score: 0,
  animation: "Idle"
};

export function App() {
  const [phase, setPhase] = useState<GamePhase>("start");
  const [runId, setRunId] = useState(0);
  const [stats, setStats] = useState<GameStats>(initialStats);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [musicOn, setMusicOn] = useState(true);
  const [musicVolume, setMusicVolume] = useState(0.65);
  const [graphicsQuality, setGraphicsQuality] = useState<GraphicsQuality>("medium");
  const [debugMode, setDebugMode] = useState(false);
  const [mobileControls, setMobileControls] = useState<MobileControls>({ x: 0, z: 0, sprint: false, jumpToken: 0 });
  const titleMusicRef = useRef<HTMLAudioElement | null>(null);
  const gameplayMusicRef = useRef<HTMLAudioElement | null>(null);
  const fadeRef = useRef<number | null>(null);
  const audioUnlockedRef = useRef(false);
  const victoryPlayedRef = useRef(false);
  const rank = getRank(stats);
  const gameplayPaused = phase === "playing" && settingsOpen;

  useEffect(() => {
    titleMusicRef.current = makeLoop("./audio/title_theme.mp3");
    gameplayMusicRef.current = makeLoop("./audio/gameplay_loop.mp3");
    return () => {
      if (fadeRef.current) window.clearInterval(fadeRef.current);
      titleMusicRef.current?.pause();
      gameplayMusicRef.current?.pause();
    };
  }, []);

  useEffect(() => {
    updateMusicMix();
  }, [phase, musicOn, musicVolume, gameplayPaused]);

  useEffect(() => {
    if (phase === "complete" && !victoryPlayedRef.current) {
      victoryPlayedRef.current = true;
      playVictorySting(musicOn && audioUnlockedRef.current, musicVolume);
    }
    if (phase !== "complete") victoryPlayedRef.current = false;
  }, [phase, musicOn, musicVolume]);

  function startGame() {
    unlockAudio();
    setStats(initialStats);
    setMobileControls({ x: 0, z: 0, sprint: false, jumpToken: 0 });
    setRunId(id => id + 1);
    setPhase("playing");
  }

  function openSettings() {
    unlockAudio();
    setSettingsOpen(true);
  }

  function unlockAudio() {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    updateMusicMix();
  }

  function updateMusicMix() {
    const titleMusic = titleMusicRef.current;
    const gameplayMusic = gameplayMusicRef.current;
    if (!titleMusic || !gameplayMusic || !audioUnlockedRef.current) return;
    const titleTarget = musicOn && phase === "start" ? musicVolume * 0.42 : 0;
    const gameplayBase = phase === "complete" ? 0.12 : gameplayPaused ? 0.18 : 0.55;
    const gameplayTarget = musicOn && (phase === "playing" || phase === "complete") ? musicVolume * gameplayBase : 0;
    fadeMusic(titleMusic, titleTarget, 900);
    fadeMusic(gameplayMusic, gameplayTarget, 900);
  }

  function updateJoystick(x: number, z: number) {
    setMobileControls(previous => ({ ...previous, x, z }));
  }

  function stopJoystick() {
    updateJoystick(0, 0);
  }

  return (
    <main className="app-shell" onPointerDown={unlockAudio}>
      <ChipScene
        modelPath={modelPath}
        enabled={phase === "playing" && !settingsOpen}
        runId={runId}
        mobileControls={mobileControls}
        debugMode={debugMode}
        soundOn={soundOn}
        graphicsQuality={graphicsQuality}
        onStatsChange={setStats}
        onComplete={() => setPhase("complete")}
      />

      {phase === "start" && (
        <section className="screen-overlay">
          <div className="start-card glass-panel">
            <p className="eyebrow">Reh Dogg Games Plus prototype</p>
            <h1>{gameTitle}</h1>
            <p>Guide Chip across the treat park, collect snacks, avoid the water, and reach the golden goal.</p>
            <button className="primary-button" onClick={startGame}>Play</button>
            <div className="hint-grid">
              <span>WASD / Arrows move</span>
              <span>Shift runs</span>
              <span>Space jumps</span>
              <span>Gamepad supported</span>
              <span>Mobile controls included</span>
            </div>
            <button className="secondary-button" onClick={openSettings}>Settings</button>
          </div>
        </section>
      )}

      {phase === "playing" && (
        <>
          <header className="game-hud glass-panel">
            <strong>{gameTitle}</strong>
            <span>Treats {stats.treats}/{totalRegularTreats}</span>
            <span>Golden {stats.goldenTreats}/{totalGoldenTreats}</span>
            <span>Falls {stats.falls}</span>
            <span>Score {stats.score}</span>
            <span>Rank {rank}</span>
            {debugMode && <span>Anim {stats.animation}</span>}
          </header>

          <div className="mobile-controls" aria-label="Mobile controls">
            <div
              className="joystick"
              onPointerDown={event => {
                event.currentTarget.setPointerCapture(event.pointerId);
                updateJoystick(0, 1);
              }}
              onPointerMove={event => {
                const rect = event.currentTarget.getBoundingClientRect();
                const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
                const y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
                const length = Math.hypot(x, y) || 1;
                updateJoystick(Math.max(-1, Math.min(1, x / Math.max(1, length))), Math.max(-1, Math.min(1, -y / Math.max(1, length))));
              }}
              onPointerUp={stopJoystick}
              onPointerCancel={stopJoystick}
            >
              <span style={{ transform: `translate(${mobileControls.x * 24}px, ${-mobileControls.z * 24}px)` }} />
            </div>
            <div className="mobile-buttons">
              <button
                onPointerDown={() => setMobileControls(previous => ({ ...previous, sprint: true }))}
                onPointerUp={() => setMobileControls(previous => ({ ...previous, sprint: false }))}
                onPointerCancel={() => setMobileControls(previous => ({ ...previous, sprint: false }))}
              >
                Sprint
              </button>
              <button onClick={() => setMobileControls(previous => ({ ...previous, jumpToken: previous.jumpToken + 1 }))}>Jump</button>
            </div>
          </div>

          <button className="settings-toggle" onClick={openSettings}>
            Settings
          </button>
        </>
      )}

      {phase === "complete" && (
        <section className="screen-overlay">
          <div className="start-card glass-panel">
            <p className="eyebrow">Level Complete</p>
            <h1>Chip found the goal!</h1>
            <div className={`rank-badge rank-${rank.toLowerCase()}`}>{rank}</div>
            <div className="final-score">
              <span>Treats: {stats.treats}/{totalRegularTreats}</span>
              <span>Golden Treats: {stats.goldenTreats}/{totalGoldenTreats}</span>
              <span>Falls: {stats.falls}</span>
              <strong>Score: {stats.score}</strong>
              <strong>Rank: {rank}</strong>
            </div>
            <button className="primary-button" onClick={startGame}>Play Again</button>
            <button className="secondary-button" onClick={() => setPhase("start")}>Start Screen</button>
          </div>
        </section>
      )}

      {settingsOpen && (
        <section className="settings-overlay" aria-label="Settings menu">
          <div className="settings-panel glass-panel">
            <div className="settings-header">
              <p className="eyebrow">Options</p>
              <button onClick={() => setSettingsOpen(false)} aria-label="Close settings">Close</button>
            </div>
            <label>
              <span>Sound</span>
              <input type="checkbox" checked={soundOn} onChange={event => setSoundOn(event.target.checked)} />
            </label>
            <label>
              <span>Music</span>
              <input type="checkbox" checked={musicOn} onChange={event => setMusicOn(event.target.checked)} />
            </label>
            <label>
              <span>Volume</span>
              <input
                className="volume-slider"
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={musicVolume}
                onChange={event => setMusicVolume(Number(event.target.value))}
              />
            </label>
            <label>
              <span>Graphics</span>
              <select value={graphicsQuality} onChange={event => setGraphicsQuality(event.target.value as GraphicsQuality)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label>
              <span>Debug Mode</span>
              <input type="checkbox" checked={debugMode} onChange={event => setDebugMode(event.target.checked)} />
            </label>
          </div>
        </section>
      )}
    </main>
  );
}

function makeLoop(src: string) {
  const audio = new Audio(src);
  audio.loop = true;
  audio.preload = "auto";
  audio.volume = 0;
  return audio;
}

function fadeMusic(audio: HTMLAudioElement, targetVolume: number, durationMs: number) {
  const startVolume = audio.volume;
  const startedAt = performance.now();
  if (targetVolume > 0 && audio.paused) {
    void audio.play().catch(() => {
      audio.volume = 0;
    });
  }
  const interval = window.setInterval(() => {
    const progress = Math.min(1, (performance.now() - startedAt) / durationMs);
    audio.volume = startVolume + (targetVolume - startVolume) * progress;
    if (progress >= 1) {
      window.clearInterval(interval);
      if (targetVolume <= 0.001) audio.pause();
    }
  }, 40);
}

function playVictorySting(shouldPlay: boolean, volume: number) {
  if (!shouldPlay) return;
  try {
    const context = new AudioContext();
    const gain = context.createGain();
    gain.gain.value = Math.max(0.01, volume * 0.08);
    gain.connect(context.destination);
    [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const noteGain = context.createGain();
      const start = context.currentTime + index * 0.09;
      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      noteGain.gain.setValueAtTime(0.001, start);
      noteGain.gain.exponentialRampToValueAtTime(1, start + 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      oscillator.connect(noteGain);
      noteGain.connect(gain);
      oscillator.start(start);
      oscillator.stop(start + 0.24);
    });
    window.setTimeout(() => void context.close(), 900);
  } catch {
    // Browsers can still block audio in edge cases; gameplay should continue silently.
  }
}

function getRank(stats: GameStats) {
  const perfectScore = totalRegularTreats * 10 + totalGoldenTreats * 100;
  const scoreRatio = stats.score / perfectScore;
  if (stats.goldenTreats === totalGoldenTreats && stats.falls === 0 && scoreRatio >= 0.95) return "S";
  if (scoreRatio >= 0.78 && stats.falls <= 1) return "A";
  if (scoreRatio >= 0.52 && stats.falls <= 3) return "B";
  return "C";
}
