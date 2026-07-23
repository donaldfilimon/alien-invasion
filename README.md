# Alien Invasion — A Real-Time WebGL Cinematic

A ~2-minute, fully scrubbable cinematic short that runs entirely in the browser.
Seven chapters, one continuous 3D world, one camera move.

```
Alien Invasion
├── Scene 1 · Observatory     (0:00)  Something moves between the stars
├── Scene 2 · Arrival         (0:15)  The mothership descends through the clouds
├── Scene 3 · Panic           (0:35)  Searchlights, flickering city, rooftop sweep
├── Scene 4 · First Contact   (0:50)  A holographic emissary in the plaza
├── Scene 5 · The Truth       (1:05)  Pull back — the fleet fills the sky
├── Scene 6 · Alliance        (1:20)  Aurora ignites, the city glows teal
└── Credits                   (1:35)
```

## Run it

```sh
npm install
npm run dev
```

Space bar toggles play/pause. Drag the scrubber or click a chapter to seek —
every frame is a pure function of the timeline clock, so seeking is exact.

## Stack

- **React 19 + TypeScript + Vite**
- **Three.js WebGPURenderer** via **React Three Fiber v9** — renders WGSL on
  WebGPU, falls back to WebGL2 automatically (badge top-left shows the live backend)
- **TSL (Three Shading Language)** — aurora shader and the whole post chain
- **Realism pass** — real moonlight shadow maps over the instanced city,
  clearcoat physical material on the mothership hull with a baked PMREM
  environment for real image-based reflections, per-building color variation,
  oriented emissive window quads, sodium streetlights

### Post-processing chain (`src/App.tsx`)

GTAO contact shadows (real depth/normal MRT buffers) → HDR bloom → AgX tone
mapping → vignette → lens flare → film grain → depth-of-field (rack focus
driven by the timeline, sharp on the hologram in First Contact) → FXAA.

Two nodes were tried and dropped, each isolated by bisecting the chain node-by-node:
- `ChromaticAberrationNode` fails to build under this three.js version's WebGPU node compiler.
- `GodraysNode` floods an open night sky uniformly — its raymarch integrates
  over an unbounded medium, so every sky pixel (sitting at max depth)
  accumulates near-max scattering regardless of distance from the light. Not a
  tuning problem: three multiplier values from 0.4 down to 0.03 (plus a
  per-channel clamp) produced the same flat wash, which is what a full-frame
  integral looks like, not "too bright." It's the wrong effect for this scene
  shape — no bounded fog/cloud volume to march through.

- **zustand** — the master timeline clock

Note: WebGPU renders `Points` at a fixed 1px (WGSL has no point size), which is
why windows/streetlights are instanced quads/spheres — only the starfield uses
true points, where 1px is exactly right.

## Architecture

| Piece | File | Idea |
|---|---|---|
| Master clock | `src/state/cinematic.ts` | Single `t` in a zustand store; `tick()` advances it |
| Keyframe engine | `src/timeline/tracks.ts` | Camera/scalar tracks + `env()`/`ramp()` envelopes — everything derives from `t` |
| Camera | `src/scenes/CameraRig.tsx` | Samples the track each frame, adds handheld sway |
| World | `src/scenes/*.tsx` | City (instanced towers + additive window points), mothership, fleet, hologram, aurora, observatory |
| UI | `src/ui/Overlay.tsx` | Title cards, credits roll, transport controls — all also derived from `t` |

Because no animation is stateful (no tweens), pause/seek/replay need zero
special handling: set `t`, and the world, camera, titles, and credits are
already there.

## Export to video

Because every frame is a pure function of `t`, the film can be **offline-rendered**
(exact frame-stepping, never a dropped frame — not a screen recording):

```sh
npm run dev                                   # renderAt(t) is DEV-only
node scripts/render-video.mjs /tmp/frames 24  # steps the timeline, 1 JPEG/frame
ffmpeg -framerate 24 -i /tmp/frames/f%05d.jpg \
  -c:v libx264 -crf 18 -pix_fmt yuv420p alien-invasion.mp4
```

The script drives headless Chromium (full build + `--enable-gpu`; the default
Playwright headless shell falls back to SwiftShader at ~4 s/frame) and hides
the transport controls while keeping letterbox, title cards, and credits.

## Extending

- Add camera moves: append keys to `CAMERA_TRACK` in `src/timeline/tracks.ts`.
- Add events: gate any material/property with `env(t, fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd)`.
- Add chapters: extend `CHAPTERS` in `src/state/cinematic.ts` and bump `DURATION`.
