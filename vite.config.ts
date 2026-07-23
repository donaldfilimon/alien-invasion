import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// `base` defaults to '/' for root-host deploys (Vercel, custom domain, Render).
// Set BASE_PATH (e.g. "/alien-invasion/") for subpath hosts like GitHub Pages,
// so Vite rewrites the index.html asset/OG paths to the project subpath.
const base = process.env.BASE_PATH ?? '/'

// https://vite.dev/config/
export default defineConfig({
  base,
  plugins: [react()],
  server: {
    // Pinned to 5199: scripts/render-video.mjs hard-codes this URL, and
    // .claude/launch.json launches the dev server here. Plain `npm run dev`
    // must land on the same port or the offline renderer silently fails.
    port: 5199,
  },
})
