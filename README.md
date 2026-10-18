# Blot

A card game website built with React and Vite.

## Local development

```bash
npm install
npm run dev
```

To test online multiplayer locally, start the WebSocket server in a second terminal:

```bash
npm run server
```

The development site connects to `ws://localhost:3001` automatically. The server health check is available at `http://localhost:3001/health`.

## GitHub Pages deployment

This project is configured to deploy the built static site to GitHub Pages.

- The Vite base path is set to `/blot/` in GitHub Actions so the app loads correctly from `https://rubenmanukyan.github.io/blot/`
- The workflow in `.github/workflows/deploy.yml` builds the site and publishes the `dist/` folder to the GitHub Pages environment
- Online multiplayer uses a WebSocket server deployed separately from GitHub Pages. The `render.yaml` Blueprint deploys the included `server.js`. Set the GitHub Actions repository variable `VITE_GAME_SERVER_URL` to the Render service's secure WebSocket URL (for example, `wss://blot-game-server.onrender.com`) so the deployed site can connect to it.

### One-time setup

1. In Render, create a new Blueprint using this repository and deploy the `blot-game-server` web service from `render.yaml`.
2. Wait for the Render service to become live. Confirm its health check returns `{"status":"ok"}` at `https://<your-render-service>.onrender.com/health`.
3. In the GitHub repository, open Settings > Secrets and variables > Actions > Variables. Create `VITE_GAME_SERVER_URL` with the Render service's `wss://` URL (for example, `wss://<your-render-service>.onrender.com`).
4. In Actions, run `Deploy static site to Pages`, or push a commit to `main`. The Pages build embeds the server URL; redeploy Pages whenever this variable changes.
5. Open the deployed site, choose **Play online**, create a room, and join it from another browser or device using the invite link.

To enable Pages in GitHub, if it is not already enabled:

1. Open the repository on GitHub
2. Go to Settings > Pages
3. Set the source to "GitHub Actions"
4. Push to the `main` branch to trigger a deployment

The Render Blueprint uses its free plan. Free services may sleep when idle, which can delay the first connection; game rooms are held in server memory and do not survive a server restart or redeploy.

## Production build

```bash
npm run build
```
