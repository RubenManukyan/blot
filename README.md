# Blot

A card game website built with React and Vite.

## Local development

```bash
npm install
npm run dev
```

## GitHub Pages deployment

This project is configured to deploy the built static site to GitHub Pages.

- The Vite base path is set to `/blot/` in GitHub Actions so the app loads correctly from `https://rubenmanukyan.github.io/blot/`
- The workflow in `.github/workflows/deploy.yml` builds the site and publishes the `dist/` folder to the GitHub Pages environment
- Online multiplayer uses a WebSocket server deployed separately from GitHub Pages. The `render.yaml` Blueprint deploys the included `server.js`; once Render assigns the service a URL, set a GitHub Actions repository variable named `VITE_GAME_SERVER_URL` to its secure WebSocket URL (for example, `wss://blot-game-server.onrender.com`). Push or manually run the Pages workflow to rebuild the site with multiplayer enabled.

To deploy the game server:

1. Sign in to Render and create a new Blueprint using this repository.
2. Deploy the `blot-game-server` web service from `render.yaml`.
3. In GitHub, open the repository's Settings > Secrets and variables > Actions > Variables and create `VITE_GAME_SERVER_URL` with the Render service's `wss://` URL.
4. Run the `Deploy static site to Pages` workflow from the Actions tab, or push a commit to `main`.

To enable Pages in GitHub, if it is not already enabled:

1. Open the repository on GitHub
2. Go to Settings > Pages
3. Set the source to "GitHub Actions"
4. Push to the `main` branch to trigger a deployment

## Production build

```bash
npm run build
```
