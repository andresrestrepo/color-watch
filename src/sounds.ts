let ctx: AudioContext | null = null
let ambientGain: GainNode | null = null
let ambientTimer: ReturnType<typeof setTimeout> | null = null
let ambientActive = false

function getCtx(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') ctx.resume()
  return ctx
}

function note(
  freq: number,
  start: number,
  duration: number,
  dest: AudioNode,
  vol = 0.3,
  type: OscillatorType = 'sine'
) {
  const c = getCtx()
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(vol, start + 0.02)
  g.gain.exponentialRampToValueAtTime(0.001, start + duration)
  osc.connect(g)
  g.connect(dest)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

/** Call on first user interaction to unlock the AudioContext */
export function initAudio() {
  getCtx()
}

/** Triumphant ascending arpeggio — played on win */
export function playWin() {
  const c = getCtx()
  const dest = c.destination
  const now = c.currentTime
  const arp = [523.25, 659.25, 783.99, 1046.5] // C5 E5 G5 C6
  arp.forEach((f, i) => note(f, now + i * 0.13, 0.55, dest, 0.28))
  // warm chord underneath
  note(261.63, now + 0.52, 1.4, dest, 0.14)
  note(329.63, now + 0.52, 1.4, dest, 0.1)
  note(392.00, now + 0.52, 1.4, dest, 0.08)
}

/** Descending dissonant buzz — played on 0 correct */
export function playWrong() {
  const c = getCtx()
  const dest = c.destination
  const now = c.currentTime
  note(220,    now,        0.15, dest, 0.28, 'sawtooth')
  note(196,    now + 0.15, 0.15, dest, 0.28, 'sawtooth')
  note(174.61, now + 0.30, 0.25, dest, 0.22, 'sawtooth')
}

/** Ascending pings, one per correct position */
export function playPartial(correct: number) {
  const c = getCtx()
  const dest = c.destination
  const now = c.currentTime
  const freqs = [440, 523.25, 587.33, 659.25, 698.46, 783.99, 880]
  for (let i = 0; i < correct; i++) {
    note(freqs[i] ?? 880, now + i * 0.1, 0.3, dest, 0.2)
  }
}

// ── Ambient music ──────────────────────────────────────────────────────────────
// Gentle pentatonic loop: C4 D4 E4 G4 A4 G4 E4 D4
const MELODY = [261.63, 293.66, 329.63, 392.00, 440.00, 392.00, 329.63, 293.66]
const NOTE_LEN = 0.55 // seconds per note

function scheduleLoop() {
  if (!ambientActive || !ambientGain) return
  const c = getCtx()
  const now = c.currentTime
  MELODY.forEach((freq, i) => {
    note(freq, now + i * NOTE_LEN, NOTE_LEN * 0.75, ambientGain!, 1)
  })
  ambientTimer = setTimeout(scheduleLoop, MELODY.length * NOTE_LEN * 1000 - 100)
}

export function startAmbient() {
  if (ambientActive) return
  ambientActive = true
  const c = getCtx()
  ambientGain = c.createGain()
  ambientGain.gain.setValueAtTime(0, c.currentTime)
  ambientGain.gain.linearRampToValueAtTime(0.07, c.currentTime + 1.5)
  ambientGain.connect(c.destination)
  scheduleLoop()
}

export function stopAmbient() {
  ambientActive = false
  if (ambientTimer) { clearTimeout(ambientTimer); ambientTimer = null }
  if (ambientGain && ctx) {
    ambientGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8)
    setTimeout(() => { ambientGain?.disconnect(); ambientGain = null }, 900)
  }
}
