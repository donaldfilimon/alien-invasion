import * as THREE from 'three'

/** Smoothstep easing applied within each keyframe segment. */
const smooth = (x: number) => x * x * (3 - 2 * x)

/** Clamped 0→1 ramp between a and b. */
export const ramp = (t: number, a: number, b: number) =>
  smooth(Math.min(Math.max((t - a) / (b - a), 0), 1))

/** Trapezoid envelope: 0 before a, up a→b, hold 1 b→c, down c→d. */
export const env = (t: number, a: number, b: number, c: number, d: number) =>
  ramp(t, a, b) * (1 - ramp(t, c, d))

/** One-shot flash: 0→1 over [onset, peak], 1→0 over [peak, end]. Fast rise,
 *  slower decay — for ignition/burst beats that aren't a smooth envelope. */
export const flash = (t: number, onset: number, peak: number, end: number) =>
  ramp(t, onset, peak) * (1 - ramp(t, peak, end))

export interface ScalarKey {
  t: number
  v: number
}

export function sampleScalar(keys: ScalarKey[], t: number): number {
  if (t <= keys[0].t) return keys[0].v
  const last = keys[keys.length - 1]
  if (t >= last.t) return last.v
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t >= a.t && t <= b.t) {
      const k = smooth((t - a.t) / (b.t - a.t))
      return a.v + (b.v - a.v) * k
    }
  }
  return last.v
}

export interface CamKey {
  t: number
  pos: [number, number, number]
  look: [number, number, number]
  fov: number
}

/**
 * The master camera move for the whole film. World layout:
 * city grid centered at origin, observatory hill at (120, ~14, 90),
 * mothership hovers at (0, 62, 0), moon far at (-250, 160, -400).
 */
export const CAMERA_TRACK: CamKey[] = [
  // 1 — Observatory
  { t: 0, pos: [172, 30, 158], look: [90, 26, 40], fov: 55 },
  { t: 8, pos: [152, 27, 128], look: [40, 110, -80], fov: 55 },
  { t: 15, pos: [138, 26, 110], look: [0, 220, -60], fov: 60 },
  // 2 — Arrival: follow the ship down through the clouds
  { t: 24, pos: [92, 34, 86], look: [0, 130, -10], fov: 60 },
  { t: 32, pos: [58, 30, 92], look: [0, 72, 0], fov: 58 },
  // 3 — Panic: sweep low over the rooftops
  { t: 38, pos: [52, 34, 74], look: [-10, 24, -20], fov: 70 },
  { t: 44, pos: [30, 24, 44], look: [-8, 16, -10], fov: 70 },
  // 4 — First Contact: plaza, close on the hologram
  { t: 50, pos: [22, 12, 30], look: [0, 15, 0], fov: 55 },
  { t: 58, pos: [16, 9, 22], look: [0, 13, 0], fov: 48 },
  { t: 64, pos: [18, 12, 24], look: [0, 40, 0], fov: 52 },
  // 5 — The Truth: pull back to reveal the fleet
  { t: 72, pos: [0, 90, 150], look: [0, 90, -120], fov: 60 },
  { t: 79, pos: [-20, 150, 230], look: [0, 110, -150], fov: 60 },
  // 6 — Alliance
  { t: 84, pos: [-64, 110, 170], look: [0, 70, -40], fov: 55 },
  { t: 94, pos: [-84, 88, 148], look: [0, 62, 0], fov: 55 },
  // 7 — Credits: drift up into the stars
  { t: 100, pos: [-100, 105, 165], look: [-40, 320, -500], fov: 55 },
  { t: 110, pos: [-118, 132, 186], look: [-40, 420, -600], fov: 50 },
]

const vA = new THREE.Vector3()
const vB = new THREE.Vector3()

/** Samples the camera track at time t into pos/look; returns fov. */
export function sampleCamera(t: number, outPos: THREE.Vector3, outLook: THREE.Vector3): number {
  const keys = CAMERA_TRACK
  if (t <= keys[0].t) {
    outPos.set(...keys[0].pos)
    outLook.set(...keys[0].look)
    return keys[0].fov
  }
  const last = keys[keys.length - 1]
  if (t >= last.t) {
    outPos.set(...last.pos)
    outLook.set(...last.look)
    return last.fov
  }
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i]
    const b = keys[i + 1]
    if (t >= a.t && t <= b.t) {
      const k = smooth((t - a.t) / (b.t - a.t))
      outPos.copy(vA.set(...a.pos)).lerp(vB.set(...b.pos), k)
      outLook.copy(vA.set(...a.look)).lerp(vB.set(...b.look), k)
      return a.fov + (b.fov - a.fov) * k
    }
  }
  return last.fov
}

/** Mothership altitude over the film. */
export const SHIP_ALTITUDE: ScalarKey[] = [
  { t: 0, v: 460 },
  { t: 15, v: 460 },
  { t: 22, v: 210 },
  { t: 29, v: 92 },
  { t: 35, v: 62 },
  { t: 999, v: 62 },
]

/** Rack-focus track for depth of field — deep focus on wide shots, a real
 * bokeh pull to the hologram during First Contact. */
export const FOCUS_DISTANCE: ScalarKey[] = [
  { t: 0, v: 260 },
  { t: 34, v: 260 },
  { t: 38, v: 62 },
  { t: 44, v: 40 },
  { t: 50, v: 26 },
  { t: 56, v: 18 },
  { t: 65, v: 30 },
  { t: 71, v: 420 },
  { t: 999, v: 700 },
]

export const FOCAL_LENGTH: ScalarKey[] = [
  { t: 0, v: 240 },
  { t: 34, v: 240 },
  { t: 38, v: 60 },
  { t: 50, v: 22 },
  { t: 56, v: 14 },
  { t: 65, v: 40 },
  { t: 71, v: 260 },
  { t: 999, v: 260 },
]

export const BOKEH_SCALE: ScalarKey[] = [
  { t: 0, v: 0.4 },
  { t: 38, v: 0.6 },
  { t: 50, v: 1.1 },
  { t: 58, v: 1.4 },
  { t: 65, v: 0.6 },
  { t: 71, v: 0.35 },
  { t: 999, v: 0.35 },
]

/* -------------------------------------------------------------------------
 * Canonical chapter beats — one named definition per time-gated effect so
 * every consumer draws from the same source of truth (no inline env()/ramp()
 * drift between call sites). Times are seconds on the master clock `t`.
 * Add a beat here when a new effect needs to share its timing.
 * ---------------------------------------------------------------------- */

/** Panic (ch3, start 35): searchlights + city flicker share one envelope. */
export const panic = (t: number) => env(t, 35, 37, 48, 51)
/** Alliance (ch6, start 80): warm→teal shift shared by city windows + fleet. */
export const alliance = (t: number) => ramp(t, 80, 86)
/** Aurora (ch6): opacity ramp igniting with the Alliance chapter. */
export const aurora = (t: number) => ramp(t, 80, 86)
/** Aurora ignition burst — a fast flash layered on top of the smooth ramp so
 *  the curtain "ignites" rather than merely fading in. */
export const auroraIgnition = (t: number) => flash(t, 80, 80.3, 83)
/** Mothership descent shimmer, post-touchdown (leads ch3 by 2s — intentional). */
export const descentShimmer = (t: number) => ramp(t, 33, 36)
/** Reentry/comet trail on the descending mothership — visible through Arrival. */
export const reentry = (t: number) => env(t, 16, 21, 33, 36)
/** "Something moves between the stars" — a drifting body in the starfield during ch1. */
export const drifter = (t: number) => env(t, 2, 6, 13, 16)
/** Camera shake: a jolt at mothership contact (~t=35) plus a rumble on reentry. */
export const shake = (t: number) => flash(t, 34.5, 35, 40) * 1.3 + flash(t, 22, 23, 28) * 0.5
/** Mothership dome "waking up" as First Contact begins. */
export const domePower = (t: number) => 0.5 + ramp(t, 49, 53) * 0.9
/** First Contact (ch4, start 50): mothership underglow onto the city. */
export const contact = (t: number) => env(t, 49, 51, 64, 66)
/** First Contact: holographic emissary in the plaza. */
export const hologram = (t: number) => env(t, 50, 52.5, 62.5, 65)
/** The Truth (ch5, start 65): fleet reveal. */
export const fleetReveal = (t: number) => ramp(t, 65, 71)

/** Deterministic PRNG so the city is identical every load. */
export function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
