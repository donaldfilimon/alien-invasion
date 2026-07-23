import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Pinned to 5199: scripts/render-video.mjs hard-codes this URL, and
    // .claude/launch.json launches the dev server here. Plain `npm run dev`
    // must land on the same port or the offline renderer silently fails.
    port: 5199,
  },
})
