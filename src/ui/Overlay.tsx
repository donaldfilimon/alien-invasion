import { useEffect } from 'react'
import { CHAPTERS, DURATION, chapterAt, useCinematic } from '../state/cinematic'
import { env, ramp } from '../timeline/tracks'

const CREDITS = [
  ['ALIEN INVASION', 'a real-time WebGL cinematic'],
  ['Direction & Camera', 'Keyframe Timeline Engine'],
  ['Visual Effects', 'Three.js · React Three Fiber'],
  ['Lighting', 'HDR Bloom · Additive Glow'],
  ['Starring', 'One Mothership · 42 Scouts · A Very Calm Alien'],
  ['Filmed entirely on location', 'In Your Browser'],
  ['', 'Thank you for watching'],
]

function fmt(t: number) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function Overlay() {
  const t = useCinematic((s) => s.t)
  const playing = useCinematic((s) => s.playing)
  const backend = useCinematic((s) => s.backend)
  const ready = useCinematic((s) => s.ready)
  const setT = useCinematic((s) => s.setT)
  const toggle = useCinematic((s) => s.toggle)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        useCinematic.getState().toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const chapter = chapterAt(t)
  const local = t - chapter.start
  const isCredits = chapter.id === 7
  // Title card: fade in over first second, hold, fade by second 6
  const titleOpacity = isCredits ? 0 : env(local + chapter.start, chapter.start + 0.4, chapter.start + 1.6, chapter.start + 4.5, chapter.start + 6)
  const creditsProgress = isCredits ? ramp(t, 95, 110) : 0

  return (
    <div className="overlay">
      {/* Loading splash — shown until the first real frame renders (WGSL compile done) */}
      {!ready && (
        <div className="splash" role="status" aria-live="polite">
          <div className="splash-title">Alien Invasion</div>
          <div className="splash-sub">
            {backend ? `Compiling ${backend} shaders…` : 'Initializing renderer…'}
          </div>
          <div className="splash-spinner" />
          <div className="splash-hint">WebGPU · WebGL2 fallback</div>
        </div>
      )}

      {/* Letterbox bars */}
      <div className="bar bar-top" />
      <div className="bar bar-bottom" />

      {backend && <div className="backend-badge">{backend} · AgX</div>}

      {/* Chapter title card */}
      <div className="title-card" style={{ opacity: titleOpacity }}>
        <div className="chapter-index">Scene {chapter.id}</div>
        <h1>{chapter.title}</h1>
        <p>{chapter.subtitle}</p>
      </div>

      {/* Credits roll — position derived from t so it scrubs correctly */}
      {isCredits && (
        <div className="credits" style={{ opacity: ramp(t, 95, 97) }}>
          <div
            className="credits-roll"
            style={{ transform: `translateY(${(1 - creditsProgress) * 60 - 30}vh)` }}
          >
            {CREDITS.map(([role, name], i) => (
              <div key={i} className="credit">
                {role && <div className="credit-role">{role}</div>}
                <div className="credit-name">{name}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transport controls */}
      <div className="controls">
        <button className="play-btn" onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
          {playing ? '❚❚' : t >= DURATION ? '↺' : '▶'}
        </button>
        <div className="scrubber">
          <input
            type="range"
            min={0}
            max={DURATION}
            step={0.05}
            value={t}
            onChange={(e) => setT(parseFloat(e.target.value))}
          />
          <div className="chapter-marks">
            {CHAPTERS.map((c) => (
              <button
                key={c.id}
                className={`mark ${chapter.id === c.id ? 'active' : ''}`}
                style={{ left: `${(c.start / DURATION) * 100}%` }}
                title={c.title}
                onClick={() => setT(c.start)}
              />
            ))}
          </div>
        </div>
        <div className="time">
          {fmt(t)} / {fmt(DURATION)}
        </div>
      </div>

      <div className="chapter-list">
        {CHAPTERS.map((c) => (
          <button
            key={c.id}
            className={chapter.id === c.id ? 'active' : ''}
            onClick={() => setT(c.start)}
          >
            {c.title}
          </button>
        ))}
      </div>
    </div>
  )
}
