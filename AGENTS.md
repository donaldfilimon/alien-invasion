# Repository Guidelines

Contributor guide for **Alien Invasion**, a browser-based WebGL/WebGPU
cinematic built with React 19, Three.js, and React Three Fiber.

## Project Structure & Module Organization

- `src/App.tsx` — scene-graph root and the post-processing chain (GTAO → bloom → AgX → vignette → lens flare → film grain → DOF → FXAA).
- `src/state/cinematic.ts` — zustand master timeline store; the single `t` clock and `CHAPTERS` list.
- `src/timeline/tracks.ts` — keyframe engine: `CAMERA_TRACK`, scalar tracks, `env()` / `ramp()` envelopes. Everything derives from `t`.
- `src/scenes/` — 3D world components (`CameraRig.tsx`, `City.tsx`, `Mothership.tsx`, `Sky.tsx`, `Observatory.tsx`, `Environment.tsx`, `World.tsx`).
- `src/ui/Overlay.tsx` — title cards, credits, transport controls (all derived from `t`).
- `src/assets/`, `public/` — static images, favicon, icons.
- `scripts/render-video.mjs` — offline frame-stepping renderer using the dev-only `window.renderAt(t)` hook.
- `dist/` — Vite build output (generated; do not edit).

There is no test directory; the project ships no unit-test suite.

## Build, Test, and Development Commands

Run from the repo root. **bun is the package manager** — `bun.lock` is the single
lockfile, and `package-lock.json` was removed on purpose; don't reintroduce it.

- `bun install` — install dependencies.
- `bun run dev` — Vite dev server with HMR (port 5199 for the video renderer).
- `bun run build` — `tsc -b` then `vite build` → `dist/`.
- `bun run preview` — serve the built `dist/` bundle.
- `bun run lint` — run `oxlint` (no auto-fix step).
- `node scripts/render-video.mjs <framesDir> [fps] [startSec] [endSec]` — render frames to JPEG; requires `bun run dev` on `http://localhost:5199`.
- `ffmpeg -framerate <fps> -i <framesDir>/f%05d.jpg -c:v libx264 -crf 18 -pix_fmt yuv420p alien-invasion.mp4` — encode frames to MP4.

## Coding Style & Naming Conventions

- **TypeScript strict** (`tsconfig.app.json`): `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `verbatimModuleSyntax`, `erasableSyntaxOnly`. Use `import type` for type-only imports.
- **ESM only** (`"type": "module"`); never `require`.
- **Linting**: `oxlint` with `react`, `typescript`, `oxc` plugins. `react/rules-of-hooks` = error; `react/only-export-components` = warn (`allowConstantExport: true`). Run `bun run lint` before committing.
- **Formatting**: 2-space indentation; keep lines short and consistent with surrounding files.
- **Naming**: components `PascalCase` (`CameraRig`); hooks/stores/helpers `camelCase` (`env`, `useCinematic`); constants/tracks `UPPER_SNAKE_CASE` (`CAMERA_TRACK`, `DURATION`).

## Testing Guidelines

No unit-test framework is configured. Validate changes by running `bun run dev`, scrubbing the timeline, and confirming each chapter renders correctly. For visual changes, export frames with `scripts/render-video.mjs` and compare.

## Architecture Notes

- Core invariant: **every frame is a pure function of `t`** — no stateful tweens. Pause/seek/replay work by setting `t`; no special handling.
- Add camera moves: append keys to `CAMERA_TRACK` in `src/timeline/tracks.ts`.
- Add time-gated events: gate any material/property with `env(t, fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd)`.
- Add chapters: extend `CHAPTERS` in `src/state/cinematic.ts` and bump `DURATION`.
- WebGPU (WGSL/TSL) is the primary renderer; WebGL2 is the automatic fallback. The overlay badge shows the live backend.

## Commit & Pull Request Guidelines

- Atomic, focused commits; one logical change per commit.
- Imperative subject line (e.g. `Add rack-focus DOF to post chain`), blank line, concise body explaining *why*.
- Reference scene/chapter names for scene-specific changes (e.g. `Mothership`, `First Contact`).
- PRs: describe the change, list affected scenes/tracks, link related issues. For visual changes include before/after frames or a clip from `scripts/render-video.mjs`.
- Run `bun run lint` and `bun run build` successfully before opening a PR.

## Environment & Configuration Tips

- Requires a WebGPU-capable browser for intended visuals; WebGL2 is the fallback.
- The video renderer needs the full Chromium build with `--enable-gpu`; the default Playwright headless shell falls back to SwiftShader (~4 s/frame).
- `dist/`, `node_modules/`, and `*.mp4` outputs are gitignored — do not commit them.
