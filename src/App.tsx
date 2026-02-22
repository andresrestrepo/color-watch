import { useState, useEffect, useRef } from 'react'
import './App.css'
import { initAudio, startAmbient, stopAmbient, playWin, playWrong, playPartial } from './sounds'

const COLORS = ['red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'teal'] as const
type Color = typeof COLORS[number]

const COLOR_HEX: Record<Color, string> = {
  red: '#e74c3c',
  blue: '#3498db',
  green: '#2ecc71',
  yellow: '#f1c40f',
  purple: '#9b59b6',
  orange: '#e67e22',
  pink: '#e91e8c',
  teal: '#00bcd4',
}

const DIFFICULTY = {
  easy:   { slots: 3, label: 'Easy' },
  normal: { slots: 5, label: 'Normal' },
  hard:   { slots: 8, label: 'Hard' },
} as const

type Difficulty = keyof typeof DIFFICULTY

interface Attempt {
  guess: Color[]
  correct: number
}

interface GameRecord {
  difficulty: Difficulty
  time: number
  attempts: number
  date: string
}

const RECORDS_KEY = 'colorwatch-records'

function loadRecords(): GameRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function addRecord(record: GameRecord, existing: GameRecord[]): GameRecord[] {
  const updated = [...existing, record].sort((a, b) => a.time - b.time).slice(0, 20)
  localStorage.setItem(RECORDS_KEY, JSON.stringify(updated))
  return updated
}

function generateSolution(numSlots: number): Color[] {
  const shuffled = [...COLORS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, numSlots)
}

function countCorrect(guess: Color[], solution: Color[]): number {
  return guess.filter((color, i) => color === solution[i]).length
}

function Bottle({ fill, empty = false, width = 50, height = 80 }: {
  fill: string
  empty?: boolean
  width?: number
  height?: number
}) {
  return (
    <svg width={width} height={height} viewBox="0 0 60 100" className="bottle">
      <path
        d="M22,2 L38,2 L40,22 Q53,34 53,48 L53,88 Q53,99 41,99 L19,99 Q7,99 7,88 L7,48 Q7,34 20,22 Z"
        fill={empty ? '#2a2a2a' : fill}
        stroke={empty ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.15)'}
        strokeWidth="1.5"
        strokeDasharray={empty ? '4 2' : undefined}
      />
      {!empty && (
        <>
          <rect x="26" y="4" width="7" height="14" rx="2" fill="rgba(255,255,255,0.22)" />
          <rect x="11" y="36" width="6" height="36" rx="3" fill="rgba(255,255,255,0.08)" />
        </>
      )}
    </svg>
  )
}

function App() {
  const [difficulty, setDifficulty] = useState<Difficulty>('easy')
  const numSlots = DIFFICULTY[difficulty].slots

  const [solution, setSolution] = useState<Color[]>(() => generateSolution(numSlots))
  const [guess, setGuess] = useState<(Color | null)[]>(Array(numSlots).fill(null))
  const [selectedSlot, setSelectedSlot] = useState<number>(0)
  const [attempts, setAttempts] = useState<Attempt[]>([])
  const [won, setWon] = useState(false)
  const [time, setTime] = useState(0)
  const [soundOn, setSoundOn] = useState(true)
  const [records, setRecords] = useState<GameRecord[]>(loadRecords)
  const [showRecords, setShowRecords] = useState(false)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioInitialized = useRef(false)
  const soundOnRef = useRef(true)

  // Timer
  useEffect(() => {
    if (won) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => setTime(t => t + 1), 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [won])

  // Cleanup ambient on unmount
  useEffect(() => () => stopAmbient(), [])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  // Unlock AudioContext and start ambient on first user interaction
  const ensureAudio = () => {
    if (audioInitialized.current) return
    audioInitialized.current = true
    initAudio()
    if (soundOnRef.current) startAmbient()
  }

  const toggleSound = () => {
    setSoundOn(prev => {
      const next = !prev
      soundOnRef.current = next
      if (next) {
        initAudio()
        startAmbient()
      } else {
        stopAmbient()
      }
      return next
    })
  }

  const handleDifficultyChange = (d: Difficulty) => {
    ensureAudio()
    const n = DIFFICULTY[d].slots
    setDifficulty(d)
    setSolution(generateSolution(n))
    setGuess(Array(n).fill(null))
    setSelectedSlot(0)
    setAttempts([])
    setWon(false)
    setTime(0)
  }

  const handleSlotClick = (index: number) => {
    ensureAudio()
    setSelectedSlot(index)
  }

  const handleColorSelect = (color: Color) => {
    ensureAudio()
    const newGuess = [...guess]
    newGuess[selectedSlot] = color
    setGuess(newGuess)
    setSelectedSlot((selectedSlot + 1) % numSlots)
  }

  const handleSubmit = () => {
    if (guess.some(c => c === null) || won) return
    ensureAudio()
    const correct = countCorrect(guess as Color[], solution)
    const newAttempts = [...attempts, { guess: guess as Color[], correct }]
    setAttempts(newAttempts)
    if (correct === numSlots) {
      setWon(true)
      if (soundOnRef.current) playWin()
      const record: GameRecord = {
        difficulty,
        time,
        attempts: newAttempts.length,
        date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      }
      setRecords(prev => addRecord(record, prev))
    } else if (correct === 0) {
      if (soundOnRef.current) playWrong()
    } else {
      if (soundOnRef.current) playPartial(correct)
    }
  }

  const handleReset = () => {
    ensureAudio()
    setSolution(generateSolution(numSlots))
    setGuess(Array(numSlots).fill(null))
    setSelectedSlot(0)
    setAttempts([])
    setWon(false)
    setTime(0)
  }

  const slotSize = difficulty === 'easy'
    ? { w: 64, h: 102 }
    : difficulty === 'normal'
    ? { w: 52, h: 83 }
    : { w: 40, h: 64 }

  const historySize = difficulty === 'hard' ? { w: 16, h: 26 } : { w: 22, h: 35 }

  return (
    <div className="game">
      <div className="header">
        <h1>Color Watch</h1>
        <button className={`sound-btn ${soundOn ? '' : 'sound-off'}`} onClick={toggleSound} title={soundOn ? 'Mute' : 'Unmute'}>
          {soundOn ? '♪' : '♪'}
          <span className="sound-label">{soundOn ? 'ON' : 'OFF'}</span>
        </button>
      </div>
      <p className="subtitle">Guess the secret color order</p>

      <div className="difficulty-selector">
        {(Object.keys(DIFFICULTY) as Difficulty[]).map(d => (
          <button
            key={d}
            className={`diff-btn ${difficulty === d ? 'diff-active' : ''}`}
            onClick={() => handleDifficultyChange(d)}
          >
            {DIFFICULTY[d].label}
          </button>
        ))}
      </div>

      <div className={`timer ${won ? 'timer-stopped' : ''}`}>{formatTime(time)}</div>

      {won && (
        <div className="win-banner">
          You got it in {attempts.length} attempt{attempts.length !== 1 ? 's' : ''} — {formatTime(time)}
          <div className="solution-row">
            {solution.map((color, i) => (
              <Bottle key={i} fill={COLOR_HEX[color]} width={30} height={48} />
            ))}
          </div>
        </div>
      )}

      <div className="slots">
        {guess.map((color, i) => (
          <div
            key={i}
            className={`slot ${selectedSlot === i ? 'selected' : ''}`}
            onClick={() => handleSlotClick(i)}
          >
            <Bottle
              fill={color ? COLOR_HEX[color] : '#333'}
              empty={!color}
              width={slotSize.w}
              height={slotSize.h}
            />
            {!color && <span className="slot-num">{i + 1}</span>}
          </div>
        ))}
      </div>

      <div className="palette">
        {COLORS.map(color => (
          <div
            key={color}
            className="color-option"
            onClick={() => handleColorSelect(color)}
            title={color}
          >
            <Bottle fill={COLOR_HEX[color]} width={40} height={64} />
          </div>
        ))}
      </div>

      <div className="actions">
        <button onClick={handleSubmit} disabled={guess.some(c => c === null) || won}>
          Check
        </button>
        <button onClick={handleReset} className="reset-btn">
          New Game
        </button>
        <button className="records-btn" onClick={() => setShowRecords(s => !s)}>
          Records {showRecords ? '▲' : '▼'}
        </button>
      </div>

      {showRecords && (
        <div className="records">
          <div className="records-header">
            <h3>Best Records</h3>
            {records.length > 0 && (
              <button className="clear-btn" onClick={() => {
                localStorage.removeItem(RECORDS_KEY)
                setRecords([])
              }}>Clear</button>
            )}
          </div>
          {records.length === 0 ? (
            <p className="records-empty">No records yet. Win a game to set one!</p>
          ) : (
            <table className="records-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Difficulty</th>
                  <th>Time</th>
                  <th>Attempts</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r, i) => (
                  <tr key={i} className={i === 0 ? 'record-best' : ''}>
                    <td>{i + 1}</td>
                    <td><span className={`diff-badge diff-badge-${r.difficulty}`}>{DIFFICULTY[r.difficulty].label}</span></td>
                    <td className="record-time">{formatTime(r.time)}</td>
                    <td>{r.attempts}</td>
                    <td>{r.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {attempts.length > 0 && (
        <div className="history">
          <h3>Attempts</h3>
          {[...attempts].reverse().map((attempt, i) => (
            <div key={attempts.length - i} className={`attempt ${i === 0 ? 'attempt-latest' : ''}`}>
              <span className="attempt-num">#{attempts.length - i}</span>
              <div className="attempt-colors">
                {attempt.guess.map((color, j) => (
                  <Bottle key={j} fill={COLOR_HEX[color]} width={historySize.w} height={historySize.h} />
                ))}
              </div>
              <span className="attempt-result">{attempt.correct} / {numSlots}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default App
