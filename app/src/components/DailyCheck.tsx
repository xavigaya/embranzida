import { useState } from 'react'
import type { DailyStatus } from '../lib/types'

type Props = { day: string; onSave: (d: DailyStatus) => void; onSkip: () => void }

// Preguntes en positiu (5 = millor) per fer-ho ràpid; es desen amb l'escala de la base de dades
const QUESTIONS = [
  { key: 'sleep', label: 'Com has dormit?', low: 'Malament', high: 'Molt bé' },
  { key: 'energy', label: 'Quina energia tens?', low: 'Gens', high: 'Molta' },
  { key: 'comfort', label: 'Tens molèsties musculars?', low: 'Moltes', high: 'Cap' },
  { key: 'mood', label: 'Com estàs d’ànim?', low: 'Baix', high: 'Molt bé' },
] as const

type Key = (typeof QUESTIONS)[number]['key']

export function DailyCheck({ day, onSave, onSkip }: Props) {
  const [v, setV] = useState<Partial<Record<Key, number>>>({})
  const complete = QUESTIONS.every((q) => v[q.key] != null)
  return (
    <section className="daily card">
      <div className="daily-head">
        <h2>Com et trobes avui?</h2>
        <button type="button" className="link small" onClick={onSkip}>
          Ara no
        </button>
      </div>
      {QUESTIONS.map((q) => (
        <div key={q.key} className="daily-q">
          <span>{q.label}</span>
          <div className="scale" role="radiogroup" aria-label={q.label}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                role="radio"
                aria-checked={v[q.key] === n}
                className={`dot ${v[q.key] === n ? 'on' : ''}`}
                onClick={() => setV({ ...v, [q.key]: n })}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="scale-ends">
            <small>{q.low}</small>
            <small>{q.high}</small>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn primary block"
        disabled={!complete}
        onClick={() =>
          onSave({ day, sleep: v.sleep!, fatigue: 6 - v.energy!, soreness: 6 - v.comfort!, mood: v.mood! })
        }
      >
        Desa
      </button>
    </section>
  )
}
