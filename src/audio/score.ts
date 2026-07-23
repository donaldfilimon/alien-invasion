import {
  alliance,
  aurora,
  contact,
  descentShimmer,
  drifter,
  fleetReveal,
  panic,
  reentry,
} from '../timeline/tracks'

/**
 * A small procedural Web Audio score. Every voice is a sustained node whose
 * gain / filter cutoff is driven each frame by the same `t` the picture is —
 * so the sound scrubs and seeks in lockstep with the image, and stays silent
 * when paused or muted. No event scheduling except a soft bell "sting" at each
 * chapter transition. Kept deliberately light: a sub drone, an opening pad,
 * a wind bed, a high shimmer, and a panic rumble.
 */
export class Score {
  readonly ctx: AudioContext
  private master: GainNode
  private noiseBuf: AudioBuffer
  private lastChapter = -1

  private droneGain!: GainNode
  private padGain!: GainNode
  private padFilter!: BiquadFilterNode
  private windGain!: GainNode
  private windFilter!: BiquadFilterNode
  private shimmerGain!: GainNode
  private rumbleGain!: GainNode

  constructor(ctx: AudioContext) {
    this.ctx = ctx
    this.master = ctx.createGain()
    this.master.gain.value = 0
    this.master.connect(ctx.destination)
    this.noiseBuf = this.makeNoise(ctx)
    this.buildDrone()
    this.buildPad()
    this.buildWind()
    this.buildShimmer()
    this.buildRumble()
  }

  private makeNoise(ctx: AudioContext) {
    const len = ctx.sampleRate * 2
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    return buf
  }

  private smooth(p: AudioParam, v: number, tc = 0.08) {
    p.setTargetAtTime(v, this.ctx.currentTime, tc)
  }

  private buildDrone() {
    const g = this.ctx.createGain()
    g.gain.value = 0
    g.connect(this.master)
    for (const f of [55, 110]) {
      const o = this.ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      o.connect(g)
      o.start()
    }
    this.droneGain = g
  }

  private buildPad() {
    const g = this.ctx.createGain()
    g.gain.value = 0
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 200
    lp.Q.value = 3
    lp.connect(g)
    g.connect(this.master)
    for (const f of [164.81, 220, 277.18]) {
      const o = this.ctx.createOscillator()
      o.type = 'triangle'
      o.frequency.value = f
      o.detune.value = (Math.random() - 0.5) * 12
      o.connect(lp)
      o.start()
    }
    this.padGain = g
    this.padFilter = lp
  }

  private buildWind() {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const bp = this.ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 600
    bp.Q.value = 0.7
    const g = this.ctx.createGain()
    g.gain.value = 0
    src.connect(bp)
    bp.connect(g)
    g.connect(this.master)
    src.start()
    this.windGain = g
    this.windFilter = bp
  }

  private buildShimmer() {
    const g = this.ctx.createGain()
    g.gain.value = 0
    g.connect(this.master)
    for (const f of [880, 1320]) {
      const o = this.ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f
      o.connect(g)
      o.start()
    }
    this.shimmerGain = g
  }

  private buildRumble() {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuf
    src.loop = true
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 90
    const g = this.ctx.createGain()
    g.gain.value = 0
    src.connect(lp)
    lp.connect(g)
    g.connect(this.master)
    src.start()
    this.rumbleGain = g
  }

  /** Soft bell at each chapter transition — a "voice made of light" motif. */
  private sting(chapterId: number) {
    const now = this.ctx.currentTime
    const roots = [55, 55, 41.2, 27.5, 82.4, 82.4, 110]
    const root = roots[chapterId - 1] ?? 55
    const partials = [1, 1.5, 2]
    partials.forEach((p, i) => {
      const o = this.ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = root * p
      const g = this.ctx.createGain()
      const peak = 0.18 / partials.length
      g.gain.setValueAtTime(0.0001, now)
      g.gain.linearRampToValueAtTime(peak, now + 0.04)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.4)
      o.connect(g)
      g.connect(this.master)
      o.start(now)
      o.stop(now + 2.6)
      // avoid GC cutting the node before it finishes
      o.onended = () => g.disconnect()
      void i
    })
  }

  update(t: number, chapterId: number, playing: boolean, muted: boolean, volume: number) {
    const gate = playing && !muted ? volume : 0
    this.smooth(this.master.gain, gate, 0.12)

    const re = reentry(t)
    const dr = drifter(t)
    const pa = panic(t)
    const co = contact(t)
    const au = aurora(t)
    const al = alliance(t)
    const de = descentShimmer(t)
    const fr = fleetReveal(t)

    // Sub drone — low tension under arrival, contact, alliance.
    this.smooth(this.droneGain.gain, 0.12 * (0.2 + re * 0.5 + co * 0.6 + al * 0.6))
    // Pad — opens (filter rises) as the alliance blooms.
    this.smooth(this.padGain.gain, 0.08 * (0.15 + re * 0.4 + al * 0.8 + fr * 0.3))
    this.smooth(this.padFilter.frequency, 180 + al * 1400 + au * 600, 0.2)
    // Wind bed — the drifter + reentry.
    this.smooth(this.windGain.gain, 0.06 * (dr * 0.6 + re * 0.7))
    this.smooth(this.windFilter.frequency, 400 + re * 800 + pa * 400, 0.2)
    // Shimmer — the voice made of light.
    this.smooth(this.shimmerGain.gain, 0.05 * (au * 0.5 + co * 0.7 + al * 0.5 + de * 0.2))
    // Rumble — panic.
    this.smooth(this.rumbleGain.gain, 0.14 * pa)

    if (chapterId !== this.lastChapter) {
      const wasInitial = this.lastChapter === -1
      this.lastChapter = chapterId
      if (!wasInitial && playing && !muted) this.sting(chapterId)
    }
  }

  dispose() {
    try {
      void this.ctx.close()
    } catch {
      /* already closed */
    }
  }
}