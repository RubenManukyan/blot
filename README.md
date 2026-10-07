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
- Online multiplayer requires a separately hosted WebSocket server. Set `VITE_GAME_SERVER_URL` in the GitHub Actions build environment to its `wss://` URL; without it, the online lobby displays that multiplayer is unavailable.

To enable Pages in GitHub:

1. Open the repository on GitHub
2. Go to Settings > Pages
3. Set the source to "GitHub Actions"
4. Push to the `main` branch to trigger a deployment

## Production build

```bash
npm run build
```
