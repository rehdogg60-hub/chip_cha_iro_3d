# Chip Cha Iro 3D

A standalone Vite + React + Three.js mascot platformer prototype for a 3D Chip Cha Iro experience.

This project is self-contained inside `Chip_Cha_Iro_3D_Vite/` and does not modify any existing Reh Dogg Games Plus projects.

## Structure

```text
Chip_Cha_Iro_3D_Vite/
  package.json
  index.html
  README.md
  public/
    models/
      chip.glb
  src/
    App.tsx
    main.tsx
    components/
      ChipScene.tsx
    assets/
    styles/
      app.css
    game/
      constants.ts
```

## Run Locally

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

The production build will be generated in `dist/`.

## Gameplay Prototype

Chip Cha Iro 3D now includes a small playable platformer level:

- Start screen, playable loop, and end screen
- Grass field, ramps, platforms, bridge, trees, rocks, water hazard, and goal area
- 20 regular dog treats
- 3 golden treats that trigger `Celebrate`
- HUD with treats, golden treats, falls, score, and optional debug animation state
- Third-person follow camera that stays behind Chip
- Desktop movement with WASD / arrow keys, Shift to run, and Space to jump
- Mobile joystick, sprint button, and jump button
- Automatic animation selection for `Idle`, `Walk`, `Run`, `Jump`, `Fall`, and `Celebrate`

## Chip Model

The Chip model is located at:

```text
public/models/chip.glb
```

Current model profile:

- Stylized low-poly chocolate Labrador mascot based on the provided Chip Cha Iro reference image
- Arcade-friendly puppy proportions
- Browser/mobile optimized GLB
- 7,376 generated triangles
- 9 simple materials
- Big golden eyes, broad floppy ears, red collar, gold tag, open smile, tongue, and lighter chest patch
- Animation-ready node rig
- Animation clips: `Idle`, `Walk`, `Run`, `Jump`, `Celebrate`, `Fall`

Regenerate the model:

```bash
npm run generate:model
```

The generator lives at:

```text
scripts/generate-chip-model.mjs
```

Replace `public/models/chip.glb` with a final production model later if needed, but keep the filename as `chip.glb` if you want the app to load it without code changes.

## Animation Controls

The app wires the GLB animation clips into gameplay-style controls:

- `Idle`: standing still
- `Walk`: movement with WASD, arrow keys, or the Walk button
- `Run`: movement while holding Shift or the Sprint button
- `Jump`: Space or Jump button
- `Fall`: Respawn / Fall button
- `Celebrate`: Special Treat button

Animation changes use smooth Three.js `AnimationMixer` fade transitions.
