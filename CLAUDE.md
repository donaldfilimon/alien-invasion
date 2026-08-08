# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A browser-based WebGL/WebGPU cinematic (~110 s, fully scrubbable) built with
React 19 + TypeScript + Vite, Three.js, and React Three Fiber v9. Seven
chapters, one continuous 3D world, one camera move. The home-level `~/CLAUDE.md`
lists this directory as "Swift/game experiments" — that's stale; this is a
React/Three.js project, not Swift.

`AGENTS.md` is the contributor guide (structure, style, commit/PR rules) and
`README.md` has the scene breakdown + run/export steps. Read both; this file
covers the invariant and the gotchas that cost time.

## Commands

**bun is the package manager**; `bun.lock` is the single lockfile.
`package-lock.json` was deliberately removed (commit `14a56f3`) — don't
reintroduce it or run `npm install`, which would recreate it.

- `bun install` — install dependencies.
- `bun run dev` — Vite dev server with HMR. Serves on **port 5199** (the video
  renderer hard-codes `http://localhost:5199`).
- `bun run build` — `tsc -b` then `vite build` → `dist/`. `tsc -b` is strict;
  type errors fail the build.
- `bun run lint` — `oxlint` only; **no auto-fix flag**. Run before committing.
- `bun run preview` — serve the built `dist/`.
- Offline render (needs `bun run dev` running on 5199):
  `node scripts/render-video.mjs <framesDir> [fps] [startSec] [endSec]`
  then encode with ffmpeg (see `README.md`). The script drives full Chromium
  with `--enable-gpu` — the default Playwright headless shell falls back to
  SwiftShader at ~4 s/frame.

No unit tests exist; validate visually (scrub the timeline, export frames).

## The central invariant — read this before touching animation

**Every frame is a pure function of the single timeline clock `t`.** There are
no stateful tweens. Pause/seek/replay need zero special handling: set `t` and
the camera, world, titles, and credits are already correct.

- `t` lives in the zustand store `src/state/cinematic.ts` (`useCinematic`),
  alongside `DURATION`, `CHAPTERS`, `playing`, and `backend`.
- Everything else derives from `t`:
  - Camera/scalar keyframe tracks + `env()`/`ramp()` envelopes in
    `src/timeline/tracks.ts` (`CAMERA_TRACK`, `sampleCamera`, `sampleScalar`).
  - Camera rig sampling in `src/scenes/CameraRig.tsx`.
  - 3D world in `src/scenes/*.tsx`; UI/title cards/credits/transport in
    `src/ui/Overlay.tsx`.
  - Post-processing chain in `src/App.tsx`.

Consequences for editing:
- Add a camera move → append a key to `CAMERA_TRACK` in `tracks.ts`.
- Gate an event in time → wrap a material/property in
  `env(t, fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd)`.
- Add a chapter → extend `CHAPTERS` in `cinematic.ts` **and bump `DURATION`**.
- Never introduce per-frame state that isn't a function of `t` — it breaks
  exact seeking and the offline renderer.

## Dev-only hooks (do not strip)

In `DEV` only, `src/App.tsx` exposes `window.renderAt(t)` (steps the timeline
and screenshots one frame) and `cinematic.ts` exposes `window.cine` (the
zustand store) for console/tooling access. Both are guarded by
`import.meta.env.DEV` — the video renderer depends on `renderAt`.

## Rendering gotchas (non-obvious, learned the hard way)

- **WebGPU is primary; WebGL2 is the automatic fallback.** The overlay badge
  shows the live backend. WGSL/TSL shaders compile on first load (can take a
  while).
- **WGSL renders `Points` at a fixed 1 px** (no programmable point size). That's
  why windows and streetlights are instanced quads/spheres — only the starfield
  uses true `Points`, where 1 px is correct.
- **Two post nodes were tried and dropped** — don't re-add without reading why:
  - `ChromaticAberrationNode` fails to build under this three.js version's
    WebGPU node compiler.
  - `GodraysNode` floods an open night sky uniformly — its raymarch integrates
    over an unbounded medium, so every sky pixel (sitting at max depth)
    accumulates near-max scattering regardless of distance from the light. Not
    a tuning problem (multipliers 0.4→0.03 plus a per-channel clamp all
    produced the same flat wash). It's the wrong effect for an unbounded sky.
- The post chain order in `App.tsx`: GTAO → HDR bloom → AgX tone map →
  vignette → lens flare → film grain → DOF (rack focus driven by `t`) → FXAA.

## TypeScript & style (enforced)

- `tsconfig.app.json` is strict and bundler-mode: `verbatimModuleSyntax`,
  `erasableSyntaxOnly`, `noUnusedLocals`, `noUnusedParameters`,
  `noFallthroughCasesInSwitch`, `allowImportingTsExtensions`. Use
  `import type` for type-only imports (verbatimModuleSyntax forces it).
- ESM only (`"type": "module"`) — never `require`.
- `oxlint` with `react`, `typescript`, `oxc` plugins;
  `react/rules-of-hooks` = error, `react/only-export-components` = warn
  (`allowConstantExport: true`). Config in `.oxlintrc.json`.
- Components `PascalCase`; hooks/stores/helpers `camelCase`; constants/tracks
  `UPPER_SNAKE_CASE`.

## Do not commit

`dist/`, `node_modules/`, and `*.mp4` outputs are gitignored — including the
checked-in `alien-invasion.mp4` reference render (it's large; regenerate via
the export flow, don't edit).