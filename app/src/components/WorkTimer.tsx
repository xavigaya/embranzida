import { useEffect, useRef, useState } from 'react'
import { CATALOG } from '../data/catalog'
import { ExerciseMedia } from './ExerciseMedia'

const byId = new Map(CATALOG.map((e) => [e.id, e]))

function beep(freq = 880, dur = 0.5) {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = freq
    g.gain.setValueAtTime(0.25, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + dur)
  } catch {
    /* sense àudio */
  }
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

type Props = {
  exerciseId: string
  label: string // p. ex. «Sèrie 2 de 3»
  targetS: number
  onDone: (seconds: number) => void
  onCancel: () => void
}

// Temporitzador de treball per als exercicis per temps: compte enrere de 3 s i després la durada objectiu.
export function WorkTimer({ exerciseId, label, targetS, onDone, onCancel }: Props) {
  const [phase, setPhase] = useState<'prep' | 'work' | 'paused'>('prep')
  const [now, setNow] = useState(Date.now())
  const startAt = useRef(Date.now() + 3000) // inici del treball
  const pausedAt = useRef<number | null>(null)
  const finished = useRef(false)
  const lastBeep = useRef(4)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 200)
    return () => clearInterval(t)
  }, [])

  const elapsed = phase === 'paused' ? (pausedAt.current! - startAt.current) / 1000 : (now - startAt.current) / 1000
  const left = Math.max(0, targetS - Math.max(0, elapsed))

  useEffect(() => {
    if (phase === 'prep') {
      const s = Math.ceil((startAt.current - now) / 1000)
      if (s <= 0) {
        setPhase('work')
        beep(1100, 0.35)
        navigator.vibrate?.(150)
      } else if (s < lastBeep.current) {
        lastBeep.current = s
        beep(660, 0.15)
      }
    } else if (phase === 'work' && left <= 0 && !finished.current) {
      finished.current = true
      navigator.vibrate?.([300, 120, 300])
      beep(880, 0.6)
      onDone(targetS)
    }
  }, [now, phase, left, targetS, onDone])

  const togglePause = () => {
    if (phase === 'work') {
      pausedAt.current = Date.now()
      setPhase('paused')
    } else if (phase === 'paused') {
      startAt.current += Date.now() - pausedAt.current!
      pausedAt.current = null
      setPhase('work')
    }
  }

  const R = 108
  const C = 2 * Math.PI * R
  const prepLeft = Math.max(1, Math.ceil((startAt.current - now) / 1000))
  const frac = phase === 'prep' ? 1 : left / targetS
  const e = byId.get(exerciseId)

  return (
    <div className="overlay work" role="dialog" aria-label={`Temporitzador: ${e?.name}`}>
      <p className="overlay-kicker">{phase === 'prep' ? 'Preparat' : phase === 'paused' ? 'En pausa' : e?.name}</p>
      <p className="overlay-next">{label}</p>
      <div className="ring">
        <svg viewBox="0 0 240 240" aria-hidden="true">
          <circle cx="120" cy="120" r={R} className="ring-track" />
          <circle cx="120" cy="120" r={R} className="ring-fill work" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} transform="rotate(-90 120 120)" />
        </svg>
        <span className="ring-time">{phase === 'prep' ? prepLeft : fmt(Math.ceil(left))}</span>
      </div>
      <div className="work-media">
        <ExerciseMedia exerciseId={exerciseId} compact />
      </div>
      <div className="overlay-actions">
        <button type="button" className="btn ghost" onClick={phase === 'prep' ? onCancel : togglePause}>
          {phase === 'prep' ? 'Cancel·la' : phase === 'paused' ? 'Continua' : 'Pausa'}
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={phase === 'prep'}
          onClick={() => {
            if (finished.current) return
            finished.current = true
            onDone(Math.max(1, Math.round(Math.min(targetS, Math.max(0, elapsed)))))
          }}
        >
          Acaba ara
        </button>
      </div>
    </div>
  )
}
