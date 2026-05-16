# Chip Cha Iro 3D - GitHub Pages Static Upload

This release is already built for simple GitHub Pages hosting.

## What to Upload

Upload the CONTENTS of the `web` folder to the GitHub repository root.

The repository root should contain:

- `index.html`
- `assets/`
- `models/`
- `audio/`

## Do Not Upload These for the Static Version

- Do not upload the Vite source `index.html`.
- Do not upload `src/`.
- Do not upload `package.json` for the static GitHub Pages version.
- Do not use Live Server on the source `index.html`.
- Do not rely on `.github/workflows` for this static upload method.

## GitHub Pages Settings

In GitHub, open the repository and use:

Settings -> Pages

Set:

- Build and deployment: Deploy from branch
- Branch: main
- Folder: /root

After saving, GitHub Pages will publish the files from the repository root.

## Local Check

Open `web/index.html` directly, or serve the `web` folder with a local static server.

The built game expects these asset paths next to `index.html`:

- `./models/chip.glb`
- `./audio/title_theme.mp3`
- `./audio/gameplay_loop.mp3`
