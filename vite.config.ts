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
  build: {
    // Vite 8 bundles with rolldown, so the chunking knobs are
    // `rolldownOptions.output.codeSplitting.groups`. The older spellings
    // (`rollupOptions`, `output.manualChunks`, `output.advancedChunks`) are all
    // deprecated aliases here — don't "modernize" this back to them.
    rolldownOptions: {
      output: {
        codeSplitting: {
          // Split by *cache lifetime*, not by route — this is a single-page
          // cinematic where every static import is on the first-frame path, so
          // there is nothing to defer. Total bytes are unchanged; what changes
          // is that a one-line edit to src/ now invalidates the ~30 kB app
          // chunk instead of the whole 1.78 MB bundle for returning visitors.
          //
          // Deliberately NOT dynamic import(): the film cannot start until
          // three + the post chain are resident, so a dynamic boundary would
          // only insert a request waterfall in front of the first frame.
          //
          // Priority matters: groups capture in descending priority, and
          // captured modules pull their dependencies in recursively (rolldown's
          // default). react must outrank the `vendor` catch-all or r3f would
          // drag react into the vendor chunk.
          groups: [
            // three/webgpu resolves to the prebuilt build/three.webgpu.js —
            // one indivisible 1.37 MB file, and 77% of the bundle. Pinned at
            // 0.185.1, so it is the most cacheable thing we ship.
            { name: 'three', test: /node_modules[\\/]three[\\/]/, priority: 30 },
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 20 },
            // @react-three/fiber, react-reconciler, zustand.
            { name: 'vendor', test: /node_modules/, priority: 10 },
          ],
          // src/ is intentionally unlisted: it falls through to automatic
          // chunking and stays the entry chunk.
        },
      },
    },
    // The 500 kB default can never be met here: build/three.webgpu.js is a
    // single 1.37 MB prebuilt file with no smaller entry point and nothing to
    // tree-shake. Raised just clear of that floor so the warning goes back to
    // being a tripwire for a *new* heavy dependency rather than permanent
    // noise. A three.js version bump could legitimately re-trip it — if it
    // does, re-measure before raising this again.
    chunkSizeWarningLimit: 1500,
  },
  server: {
    // Pinned to 5199: scripts/render-video.mjs hard-codes this URL, and
    // .claude/launch.json launches the dev server here. Plain `npm run dev`
    // must land on the same port or the offline renderer silently fails.
    port: 5199,
  },
})
