import { create } from 'zustand'

export const DURATION = 110

export interface Chapter {
  id: number
  title: string
  subtitle: string
  start: number
}

export const CHAPTERS: Chapter[] = [
  { id: 1, title: 'Observatory', subtitle: 'Something moves between the stars', start: 0 },
  { id: 2, title: 'Arrival', subtitle: 'It was never a comet', start: 15 },
  { id: 3, title: 'Panic', subtitle: 'The city holds its breath', start: 35 },
  { id: 4, title: 'First Contact', subtitle: 'A voice made of light', start: 50 },
  { id: 5, title: 'The Truth', subtitle: 'They were never alone', start: 65 },
  { id: 6, title: 'Alliance', subtitle: 'Two worlds, one sky', start: 80 },
  { id: 7, title: 'Credits', subtitle: '', start: 95 },
]

export function chapterAt(t: number): Chapter {
  let current = CHAPTERS[0]
  for (const c of CHAPTERS) if (t >= c.start) current = c
  return current
}

interface CinematicState {
  t: number
  playing: boolean
  backend: string
  /** Flips true once the first real frame has rendered (WGSL compile done). */
  ready: boolean
  /** Procedural Web Audio score. Audio can't autoplay (no user gesture yet),
   * so it starts silent (muted) and the user opts in via the sound button. */
  audioStarted: boolean
  muted: boolean
  volume: number
  setT: (t: number) => void
  toggle: () => void
  tick: (delta: number) => void
  setBackend: (b: string) => void
  setReady: (r: boolean) => void
  setAudioStarted: (b: boolean) => void
  setMuted: (m: boolean) => void
  setVolume: (v: number) => void
}

export const useCinematic = create<CinematicState>((set, get) => ({
  t: 0,
  playing: true,
  backend: '',
  ready: false,
  audioStarted: false,
  muted: true,
  volume: 0.6,
  setBackend: (b) => set({ backend: b }),
  setReady: (r) => set({ ready: r }),
  setAudioStarted: (b) => set({ audioStarted: b }),
  setMuted: (m) => set({ muted: m }),
  setVolume: (v) => set({ volume: Math.min(Math.max(v, 0), 1) }),
  setT: (t) => set({ t: Math.min(Math.max(t, 0), DURATION) }),
  toggle: () => {
    const { playing, t } = get()
    if (!playing && t >= DURATION) set({ t: 0, playing: true })
    else set({ playing: !playing })
  },
  tick: (delta) => {
    const { t, playing } = get()
    if (!playing) return
    const next = t + delta
    if (next >= DURATION) set({ t: DURATION, playing: false })
    else set({ t: next })
  },
}))

// Dev-only handle for driving the timeline from the console / tooling.
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>).cine = useCinematic
}
