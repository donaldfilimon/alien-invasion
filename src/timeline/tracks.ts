import * as THREE from 'three'

/** Smoothstep easing applied within each keyframe segment. */
const smooth = (x: number) => x * x * (3 - 2 * x)

/** Clamped 0→1 ramp between a and b. */
export const ramp = (t: number, a: number, b: number) =>
  smooth(Math.min(Math.max((t - a) / (b - a), 0), 1))

/** Trapezoid envelope: 0 before a, up a→b, hold 1 b→c, down c→d. */
export const env = (t: number, a: number, b: number, c: number, d: number) =>
  ramp(t, a, b) * (1 - ramp(t, c, d))

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
