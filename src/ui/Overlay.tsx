import { useEffect, useState } from 'react'
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

/** Index of the chapter containing time `t` (last chapter whose start <= t). */
function chapterIndexAt(t: number) {
  let cur = 0
  for (let i = 0; i < CHAPTERS.length; i++) if (CHAPTERS[i].start <= t) cur = i
  return cur
}

export function Overlay() {
  const t = useCinematic((s) => s.t)
  const playing = useCinematic((s) => s.playing)
  const backend = useCinematic((s) => s.backend)
  const ready = useCinematic((s) => s.ready)
  const setT = useCinematic((s) => s.setT)
  const [isFs, setIsFs] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onFsChange = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Don't hijack native activation when a button/input is focused.
      const el = e.target as HTMLElement | null
      const typing = el && (el.tagName === 'BUTTON' || el.tagName === 'INPUT')
      if (typing && (e.code === 'Space' || e.code === 'Enter')) return

      const s = useCinematic.getState()
      switch (e.code) {
        case 'Space':
          e.preventDefault()
          s.toggle()
          break
        case 'ArrowLeft':
          e.preventDefault()
          s.setT(s.t - (e.shiftKey ? 10 : 2))
          break
        case 'ArrowRight':
          e.preventDefault()
          s.setT(s.t + (e.shiftKey ? 10 : 2))
          break
        case 'BracketLeft': {
          e.preventDefault()
          s.setT(CHAPTERS[Math.max(0, chapterIndexAt(s.t) - 1)].start)
          break
        }
        case 'BracketRight': {
          e.preventDefault()
          s.setT(CHAPTERS[Math.min(CHAPTERS.length - 1, chapterIndexAt(s.t) + 1)].start)
          break
        }
        case 'Home':
          e.preventDefault()
          s.setT(0)
          break
        case 'End':
          e.preventDefault()
          s.setT(DURATION)
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Restart in one click when the film has ended (toggle() only resets when
  // already paused at the end; this covers the paused-while-playing edge too).
  const onPlayClick = () => {
    const s = useCinematic.getState()
    if (s.t >= DURATION) {
      s.setT(0)
      if (!s.playing) s.toggle()
    } else {
      s.toggle()
    }
  }

  const toggleFs = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen?.()
  }

  const seek = (time: number) => {
    setT(time)
    setMenuOpen(false)
  }

  const chapter = chapterAt(t)
  const local = t - chapter.start
  const isCredits = chapter.id === 7
  // Title card: fade in over first second, hold, fade by second 6
  const titleOpacity = isCredits
    ? 0
    : env(local + chapter.start, chapter.start + 0.4, chapter.start + 1.6, chapter.start + 4.5, chapter.start + 6)
  const creditsProgress = isCredits ? ramp(t, 95, 110) : 0
  const atEnd = t >= DURATION

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
        <button
          className="play-btn"
          onClick={onPlayClick}
          aria-label={atEnd ? 'Restart' : playing ? 'Pause' : 'Play'}
        >
          {playing ? '❚❚' : atEnd ? '↺' : '▶'}
        </button>
        <div className="scrubber">
          <input
            type="range"
            min={0}
            max={DURATION}
            step={0.05}
            value={t}
            onChange={(e) => setT(parseFloat(e.target.value))}
            aria-label="Timeline scrubber"
          />
          <div className="chapter-marks">
            {CHAPTERS.map((c) => (
              <button
                key={c.id}
                className={`mark ${chapter.id === c.id ? 'active' : ''}`}
                style={{ left: `${(c.start / DURATION) * 100}%` }}
                aria-label={`Scene ${c.id}: ${c.title}`}
                title={c.title}
                onClick={() => seek(c.start)}
              />
            ))}
          </div>
        </div>
        <div className="time" aria-hidden="true">
          {fmt(t)} / {fmt(DURATION)}
        </div>
        <button
          className="fs-btn"
          onClick={toggleFs}
          aria-label={isFs ? 'Exit fullscreen' : 'Enter fullscreen'}
          title={isFs ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFs ? '⤧' : '⤢'}
        </button>
      </div>

      {/* Chapter list (right edge, desktop) */}
      <nav className="chapter-list" aria-label="Scenes">
        {CHAPTERS.map((c) => (
          <button
            key={c.id}
            className={chapter.id === c.id ? 'active' : ''}
            onClick={() => seek(c.start)}
            aria-label={`Scene ${c.id}: ${c.title}`}
            aria-current={chapter.id === c.id ? 'true' : undefined}
          >
            {c.title}
          </button>
        ))}
      </nav>

      {/* Mobile Scenes menu (<700px — the side list is hidden) */}
      <button
        className="scenes-btn"
        aria-expanded={menuOpen}
        aria-label="Scenes menu"
        onClick={() => setMenuOpen((o) => !o)}
      >
        Scenes
      </button>
      {menuOpen && (
        <nav className="scenes-popover" aria-label="Scenes">
          {CHAPTERS.map((c) => (
            <button
              key={c.id}
              className={chapter.id === c.id ? 'active' : ''}
              onClick={() => seek(c.start)}
              aria-current={chapter.id === c.id ? 'true' : undefined}
            >
              <span className="scenes-num">{c.id}</span>
              {c.title}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}