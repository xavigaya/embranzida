import { useMemo, useState } from 'react'
import { CATALOG } from '../data/catalog'
import type { DoneRow } from '../lib/db'
import type { HistoryEntry } from '../lib/loads'
import { epley1RM, fmtKg } from '../lib/progression'
import type { Measurement, Plan } from '../lib/types'
import { Chart, type Point } from './Chart'

type Props = {
  plan: Plan | null
  done: DoneRow[]
  history: HistoryEntry[]
  measurements: Measurement[]
  onAddMeasurement: (m: { weight_kg?: number; waist_cm?: number; hip_cm?: number }) => void
}

const names = new Map(CATALOG.map((e) => [e.id, e.name]))
const localDay = (iso: string) => new Date(iso).toLocaleDateString('sv-SE')
const mondayOf = (day: string) => {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7))
  return d.toISOString().slice(0, 10)
}
const num = (v: string) => {
  const n = Number(v.replace(',', '.'))
  return v.trim() === '' || isNaN(n) ? undefined : n
}

export function Progress({ plan, done, history, measurements, onAddMeasurement }: Props) {
  const today = new Date().toLocaleDateString('sv-SE')

  // Adherència: sessions fetes respecte de les previstes fins avui
  const planned = plan ? plan.sessions.length : 0
  const doneInPlan = plan ? plan.sessions.filter((s) => done.some((d) => d.plannedSessionId === s.id)).length : 0
  const currentWeek = plan ? Math.min(plan.weeks, Math.floor((Date.parse(today) - Date.parse(plan.startDate)) / (7 * 864e5)) + 1) : null

  // Exercicis amb càrrega registrada, ordenats per nombre de sessions
  const exercises = useMemo(() => {
    const m = new Map<string, Set<string>>()
    for (const h of history) if (h.loadKg) (m.get(h.exerciseId) ?? m.set(h.exerciseId, new Set()).get(h.exerciseId)!).add(h.sessionLogId)
    return [...m].sort((a, b) => b[1].size - a[1].size).map(([id]) => id)
  }, [history])
  const [exId, setExId] = useState<string | null>(null)
  const ex = exId && exercises.includes(exId) ? exId : exercises[0]

  const strength: Point[] = useMemo(() => {
    if (!ex) return []
    const bySession = new Map<string, { date: string; best: number }>()
    for (const h of history.filter((h) => h.exerciseId === ex && h.loadKg && !h.deload)) {
      const v = epley1RM(h.loadKg!, h.reps ?? 0) ?? h.loadKg!
      const cur = bySession.get(h.sessionLogId)
      if (!cur || v > cur.best) bySession.set(h.sessionLogId, { date: localDay(h.date), best: v })
    }
    return [...bySession.values()].sort((a, b) => a.date.localeCompare(b.date)).map((s) => ({ x: s.date, y: Math.round(s.best * 10) / 10 }))
  }, [history, ex])

  // Sèries de treball per setmana (últimes 8 setmanes amb activitat)
  const weekly: Point[] = useMemo(() => {
    const m = new Map<string, number>()
    for (const h of history) {
      const w = mondayOf(localDay(h.date))
      m.set(w, (m.get(w) ?? 0) + 1)
    }
    return [...m].sort((a, b) => a[0].localeCompare(b[0])).slice(-8).map(([x, y]) => ({ x, y }))
  }, [history])

  const series = (k: 'weight_kg' | 'waist_cm' | 'hip_cm'): Point[] =>
    measurements
      .filter((m) => m[k] != null)
      .sort((a, b) => a.measured_at.localeCompare(b.measured_at))
      .map((m) => ({ x: localDay(m.measured_at), y: m[k]! }))
  const weight = series('weight_kg')
  const waist = series('waist_cm')

  const [form, setForm] = useState({ w: '', c: '', m: '' })
  const canSave = [form.w, form.c, form.m].some((v) => num(v) != null)

  return (
    <main className="screen progress-screen">
      <header>
        <p className="kicker">El meu progrés</p>
        <h1>Progrés</h1>
      </header>

      <dl className="stats">
        <div>
          <dt>Sessions fetes</dt>
          <dd>
            {doneInPlan}
            <small>/ {planned}</small>
          </dd>
        </div>
        <div>
          <dt>Setmana</dt>
          <dd>
            {currentWeek ?? '—'}
            <small>/ {plan?.weeks ?? 12}</small>
          </dd>
        </div>
        <div>
          <dt>Sèries</dt>
          <dd>{history.length}</dd>
        </div>
      </dl>

      <section className="card stack-sm">
        <h2>Força</h2>
        {exercises.length === 0 ? (
          <p className="muted">Quan registris sèries amb càrrega, aquí veuràs com evoluciona el teu 1RM estimat.</p>
        ) : (
          <>
            <div className="chips scroll">
              {exercises.map((id) => (
                <button key={id} type="button" className={`chip ${id === ex ? 'on' : ''}`} onClick={() => setExId(id)}>
                  {names.get(id) ?? 'Exercici'}
                </button>
              ))}
            </div>
            <Chart title={`1RM estimat · ${names.get(ex!) ?? ''}`} unit="kg" points={strength} format={fmtKg} />
            {strength.length === 1 && <p className="muted small">Amb dues sessions o més veuràs la línia d’evolució.</p>}
          </>
        )}
      </section>

      {weekly.length > 0 && (
        <section className="card stack-sm">
          <h2>Volum</h2>
          <Chart title="Sèries per setmana (data d’inici de la setmana)" unit="sèries" points={weekly} kind="bar" />
        </section>
      )}

      <section className="card stack-sm">
        <h2>Mesures corporals</h2>
        {weight.length > 0 && <Chart title="Pes" unit="kg" points={weight} format={fmtKg} />}
        {waist.length > 0 && <Chart title="Cintura" unit="cm" points={waist} format={fmtKg} />}
        {weight.length === 0 && waist.length === 0 && (
          <p className="muted">Registra el pes i la cintura cada una o dues setmanes, sempre en les mateixes condicions.</p>
        )}
        <form
          className="measure-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!canSave) return
            onAddMeasurement({ weight_kg: num(form.w), waist_cm: num(form.c), hip_cm: num(form.m) })
            setForm({ w: '', c: '', m: '' })
          }}
        >
          <label>
            <span>Pes (kg)</span>
            <input inputMode="decimal" value={form.w} onChange={(e) => setForm({ ...form, w: e.target.value })} placeholder="—" />
          </label>
          <label>
            <span>Cintura (cm)</span>
            <input inputMode="decimal" value={form.c} onChange={(e) => setForm({ ...form, c: e.target.value })} placeholder="—" />
          </label>
          <label>
            <span>Maluc (cm)</span>
            <input inputMode="decimal" value={form.m} onChange={(e) => setForm({ ...form, m: e.target.value })} placeholder="—" />
          </label>
          <button type="submit" className="btn primary block" disabled={!canSave}>
            Desa les mesures d’avui
          </button>
        </form>
      </section>
    </main>
  )
}
