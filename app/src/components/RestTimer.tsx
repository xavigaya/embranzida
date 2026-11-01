import { useEffect, useRef, useState } from 'react'

type Props = {
  endAt: number
  totalS: number
  nextLabel: string
  onAdd: (s: number) => void
  onDone: () => void
}

function beep() {
  try {
    const ctx = new AudioContext()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.frequency.value = 880
    g.gain.setValueAtTime(0.25, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
    o.connect(g).connect(ctx.destination)
    o.start()
    o.stop(ctx.currentTime + 0.6)
  } catch {
    /* sense àudio disponible */
  }
}

export function RestTimer({ endAt, totalS, nextLabel, onAdd, onDone }: Props) {
  const [now, setNow] = useState(Date.now())
  const fired = useRef(false)

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  const left = Math.max(0, Math.ceil((endAt - now) / 1000))

  useEffect(() => {
    if (left === 0 && !fired.current) {
      fired.current = true
      navigator.vibrate?.([300, 120, 300])
      beep()
    }
    if (left > 0) fired.current = false
  }, [left])

  const frac = totalS > 0 ? left / totalS : 0
  const R = 108
  const C = 2 * Math.PI * R
  const mm = Math.floor(left / 60)
  const ss = String(left % 60).padStart(2, '0')

  return (
    <div className="overlay" role="dialog" aria-label="Descans">
      <p className="overlay-kicker">{left > 0 ? 'Descans' : 'A treballar!'}</p>
      <div className="ring">
        <svg viewBox="0 0 240 240" aria-hidden="true">
          <circle cx="120" cy="120" r={R} className="ring-track" />
          <circle
            cx="120"
            cy="120"
            r={R}
            className="ring-fill"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - frac)}
            transform="rotate(-90 120 120)"
          />
        </svg>
        <span className="ring-time">
          {mm}:{ss}
        </span>
      </div>
      <p className="overlay-next">Següent: {nextLabel}</p>
      <div className="overlay-actions">
        <button type="button" className="btn ghost" onClick={() => onAdd(15)}>
          +15 s
        </button>
        <button type="button" className="btn primary" onClick={onDone}>
          {left > 0 ? 'Salta el descans' : 'Continua'}
        </button>
      </div>
    </div>
  )
}
