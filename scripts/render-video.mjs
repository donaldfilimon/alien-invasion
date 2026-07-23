// Offline film renderer: steps the cinematic's deterministic timeline via the
// dev-only window.renderAt(t) hook and screenshots every frame. Because the
// whole film is a pure function of t, this is a true offline render (exact,
// never drops frames), not a screen recording.
//
// Usage: node scripts/render-video.mjs <framesDir> [fps] [startSec] [endSec]
// Requires the dev server on http://localhost:5199 (renderAt is DEV-only).
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const [, , framesDir, fpsArg, startArg, endArg] = process.argv
if (!framesDir) {
  console.error('usage: render-video.mjs <framesDir> [fps] [startSec] [endSec]')
  process.exit(1)
}
const FPS = Number(fpsArg ?? 24)
const START = Number(startArg ?? 0)
const END = Number(endArg ?? 110)
mkdirSync(framesDir, { recursive: true })

// channel:'chromium' selects the full Chromium build (not the GPU-less
// headless shell); --enable-gpu keeps Metal-backed rendering in headless
// mode. Without this the render falls back to SwiftShader at ~4 s/frame.
const browser = await chromium.launch({
  headless: true,
  channel: 'chromium',
  args: ['--enable-unsafe-webgpu', '--enable-gpu', '--hide-scrollbars'],
})
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1,
})

page.on('pageerror', (e) => console.error('[page error]', e.message))
await page.goto('http://localhost:5199', { waitUntil: 'domcontentloaded' })

// WebGPU/WGSL (or WebGL2 fallback) shader compilation can take a while on
// first load — renderAt appears only after the R3F canvas is live.
await page.waitForFunction('typeof window.renderAt === "function"', null, {
  timeout: 180_000,
})

// Hide interactive chrome; keep film elements (letterbox, titles, credits).
await page.addStyleTag({
  content: '.controls,.chapter-list,.backend-badge{display:none !important}',
})

const backend = await page.evaluate('window.cine.getState().backend')
console.log(`backend: ${backend}`)

// Warm-up render so lazily-filled instance buffers and post targets settle.
await page.evaluate('window.renderAt(0)')
await page.waitForTimeout(500)

const first = Math.round(START * FPS)
const last = Math.round(END * FPS)
const t0 = Date.now()
for (let f = first; f <= last; f++) {
  const t = f / FPS
  await page.evaluate((tt) => window.renderAt(tt), t)
  await page.screenshot({
    path: `${framesDir}/f${String(f).padStart(5, '0')}.jpg`,
    type: 'jpeg',
    quality: 88,
  })
  if ((f - first) % 120 === 0) {
    const done = f - first + 1
    const total = last - first + 1
    const rate = done / ((Date.now() - t0) / 1000)
    console.log(
      `frame ${f}/${last} (t=${t.toFixed(2)}s) — ${((done / total) * 100).toFixed(1)}% — ${rate.toFixed(1)} fps capture`,
    )
  }
}

console.log(`done: ${last - first + 1} frames in ${((Date.now() - t0) / 1000).toFixed(0)}s`)
await browser.close()
