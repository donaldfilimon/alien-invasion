import { useEffect, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useCinematic, chapterAt } from '../state/cinematic'
import { Score } from './score'

/**
 * Drives the procedural score from the same `t` as the picture. Audio can't
 * autoplay before a user gesture, so the AudioContext is created lazily on the
 * first pointer/key interaction and stays silent (muted) until the user opts
 * in via the sound button.
 */
export function ScoreNode() {
  const scoreRef = useRef<Score | null>(null)

  useEffect(() => {
    const start = () => {
      if (scoreRef.current) return
      const Ctx =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      const ctx = new Ctx()
      void ctx.resume()
      scoreRef.current = new Score(ctx)
      useCinematic.getState().setAudioStarted(true)
    }
    window.addEventListener('pointerdown', start, { once: true })
    window.addEventListener('keydown', start, { once: true })
    return () => {
      window.removeEventListener('pointerdown', start)
      window.removeEventListener('keydown', start)
      scoreRef.current?.dispose()
      scoreRef.current = null
    }
  }, [])

  useFrame(() => {
    const s = scoreRef.current
    if (!s) return
    const st = useCinematic.getState()
    s.update(st.t, chapterAt(st.t).id, st.playing, st.muted, st.volume)
  })

  return null
}