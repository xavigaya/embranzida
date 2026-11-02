import { useMemo, useState } from 'react'
import { CATALOG } from '../data/catalog'
import { defaultPrescription, sortByBlock, WEEKDAYS } from '../lib/manualPlan'
import type { Block, Prescription, TemplateSession } from '../lib/types'
import { Stepper } from './Stepper'

type Props = {
  initial: TemplateSession[]
  initialWeeks: number
  initialDeload: boolean
  editing: boolean // true si es modifica un pla existent (es conserven les sessions fetes)
  fromAutomatic: boolean
  onCancel: () => void
  onSave: (r: { template: TemplateSession[]; weeks: number; deloadEvery4: boolean }) => void
}

const MODALITIES = [
  { id: 'forca', label: 'Força' },
  { id: 'cardio', label: 'Cardio' },
  { id: 'mobilitat', label: 'Mobilitat' },
  { id: 'flexibilitat', label: 'Estiraments' },
] as const

const BLOCKS: { id: Block; label: string }[] = [
  { id: 'escalfament', label: 'Escalfament' },
  { id: 'principal', label: 'Principal' },
  { id: 'calma', label: 'Tornada a la calma' },
]

const fmtDur = (s: number) => (s >= 300 ? `${Math.round(s / 60)} min` : `${s} s`)

function summary(p: Prescription) {
  const main =
    p.track === 'time' || p.durationS
      ? `${p.sets > 1 ? `${p.sets} × ` : ''}${fmtDur(p.durationS ?? 0)}`
      : `${p.sets} × ${p.repsMin === p.repsMax ? p.repsMin : `${p.repsMin}–${p.repsMax}`}`
  return [main, p.rirTarget != null ? `RIR ${p.rirTarget}` : null, p.hrZone ? `zona ${p.hrZone}` : null, p.restS ? `desc. ${fmtDur(p.restS)}` : null]
    .filter(Boolean)
    .join(' · ')
}

export function PlanEditor({ initial, initialWeeks, initialDeload, editing, fromAutomatic, onCancel, onSave }: Props) {
  const [sessions, setSessions] = useState<TemplateSession[]>(initial)
  const [weeks, setWeeks] = useState(initialWeeks)
  const [deload, setDeload] = useState(initialDeload)
  const [picker, setPicker] = useState<string | null>(null) // id de la sessió on s'afegeix
  const [editing2, setEditing2] = useState<{ sid: string; p: Prescription; isNew: boolean } | null>(null)

  const update = (sid: string, f: (t: TemplateSession) => TemplateSession) =>
    setSessions(sessions.map((t) => (t.id === sid ? f(t) : t)))
  const move = (sid: string, idx: number, dir: -1 | 1) =>
    update(sid, (t) => {
      const items = [...t.items]
      const j = idx + dir
      if (j < 0 || j >= items.length) return t
      ;[items[idx], items[j]] = [items[j], items[idx]]
      return { ...t, items }
    })

  const usedDays = new Set(sessions.map((s) => s.weekday))
  const addSession = () => {
    const free = [0, 2, 4, 1, 3, 5, 6].find((d) => !usedDays.has(d)) ?? 0
    setSessions([...sessions, { id: crypto.randomUUID(), title: `Sessió ${sessions.length + 1}`, weekday: free, items: [] }])
  }
  const valid = sessions.some((s) => s.items.length > 0)

  return (
    <main className="screen editor">
      <header>
        <h1>{editing ? 'Edita la setmana tipus' : 'La meva setmana tipus'}</h1>
        <p className="muted">
          Defineix les sessions d’una setmana; el pla les repetirà cada setmana. L’app no canviarà les sèries ni
          les repeticions, però et suggerirà les càrregues i t’avisarà si t’estanques.
        </p>
        {fromAutomatic && (
          <p className="date-note">
            Partim de la setmana actual del teu pla automàtic. En passar a manual, les sèries i repeticions deixaran
            de variar per mesocicles.
          </p>
        )}
      </header>

      <section className="card stack-sm">
        <Stepper label="Durada del pla" unit="setmanes" value={weeks} step={1} min={1} max={16} onChange={setWeeks} />
        <label className="consent">
          <input type="checkbox" checked={deload} onChange={(e) => setDeload(e.target.checked)} />
          <span>Setmana de descàrrega cada 4 setmanes (menys sèries i esforç suau per recuperar)</span>
        </label>
        {editing && <p className="muted small">Les sessions que ja has fet es conserven.</p>}
      </section>

      {sessions.map((t) => (
        <section key={t.id} className="card stack-sm ed-session">
          <div className="ed-row">
            <input
              className="ed-title"
              value={t.title}
              maxLength={40}
              onChange={(e) => update(t.id, (x) => ({ ...x, title: e.target.value }))}
              aria-label="Nom de la sessió"
            />
            <button type="button" className="link small" onClick={() => setSessions(sessions.filter((x) => x.id !== t.id))}>
              Elimina
            </button>
          </div>
          <div className="weekdays" role="radiogroup" aria-label="Dia de la setmana">
            {WEEKDAYS.map((d, k) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={t.weekday === k}
                className={`chip ${t.weekday === k ? 'on' : ''}`}
                onClick={() => update(t.id, (x) => ({ ...x, weekday: k }))}
              >
                {d}
              </button>
            ))}
          </div>

          {t.items.length === 0 && <p className="muted small">Encara no hi ha exercicis.</p>}
          <ol className="ed-items">
            {t.items.map((p, idx) => (
              <li key={p.id}>
                <button type="button" className="ed-item" onClick={() => setEditing2({ sid: t.id, p, isNew: false })}>
                  <strong>{p.exercise.name}</strong>
                  <small>
                    {BLOCKS.find((b) => b.id === p.block)?.label} · {summary(p)}
                  </small>
                </button>
                <div className="ed-move">
                  <button type="button" aria-label="Puja" onClick={() => move(t.id, idx, -1)} disabled={idx === 0}>
                    ↑
                  </button>
                  <button type="button" aria-label="Baixa" onClick={() => move(t.id, idx, 1)} disabled={idx === t.items.length - 1}>
                    ↓
                  </button>
                </div>
              </li>
            ))}
          </ol>
          <button type="button" className="btn ghost block" onClick={() => setPicker(t.id)}>
            + Afegeix un exercici
          </button>
        </section>
      ))}

      <button type="button" className="btn ghost block" onClick={addSession} disabled={sessions.length >= 7}>
        + Afegeix una sessió
      </button>

      <nav className="wizard-nav">
        <button type="button" className="btn ghost" onClick={onCancel}>
          Cancel·la
        </button>
        <button type="button" className="btn primary" disabled={!valid} onClick={() => onSave({ template: sessions, weeks, deloadEvery4: deload })}>
          Desa el pla
        </button>
      </nav>

      {picker && (
        <ExercisePicker
          onCancel={() => setPicker(null)}
          onPick={(id) => {
            setEditing2({ sid: picker, p: defaultPrescription(id), isNew: true })
            setPicker(null)
          }}
        />
      )}

      {editing2 && (
        <ItemSheet
          p={editing2.p}
          isNew={editing2.isNew}
          onCancel={() => setEditing2(null)}
          onDelete={() => {
            update(editing2.sid, (t) => ({ ...t, items: t.items.filter((x) => x.id !== editing2.p.id) }))
            setEditing2(null)
          }}
          onSave={(q) => {
            update(editing2.sid, (t) => ({
              ...t,
              items: sortByBlock(editing2.isNew ? [...t.items, q] : t.items.map((x) => (x.id === q.id ? q : x))),
            }))
            setEditing2(null)
          }}
        />
      )}
    </main>
  )
}

function ExercisePicker({ onCancel, onPick }: { onCancel: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [mod, setMod] = useState<string>('forca')
  const list = useMemo(() => {
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    const nq = norm(q.trim())
    return CATALOG.filter((e) => (nq ? norm(e.name).includes(nq) : e.modality === mod)).sort((a, b) => a.name.localeCompare(b.name, 'ca'))
  }, [q, mod])
  return (
    <div className="overlay sheet" role="dialog" aria-label="Tria un exercici">
      <div className="sheet-card tall">
        <h2>Tria un exercici</h2>
        <label className="field">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca per nom…" autoComplete="off" />
        </label>
        {!q && (
          <div className="chips scroll">
            {MODALITIES.map((m) => (
              <button key={m.id} type="button" className={`chip ${mod === m.id ? 'on' : ''}`} onClick={() => setMod(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
        )}
        <div className="options picker-list">
          {list.map((e) => (
            <button key={e.id} type="button" className="option compact-text" onClick={() => onPick(e.id)}>
              <strong>{e.name}</strong>
              <small>{[...(e.needs ?? []), ...(e.needsAny ? [e.needsAny.join(' o ')] : [])].join(', ') || 'Sense material'}</small>
            </button>
          ))}
          {list.length === 0 && <p className="muted">Cap exercici amb aquest nom.</p>}
        </div>
        <button type="button" className="btn ghost block" onClick={onCancel}>
          Torna
        </button>
      </div>
    </div>
  )
}

function ItemSheet({
  p: p0,
  isNew,
  onCancel,
  onDelete,
  onSave,
}: {
  p: Prescription
  isNew: boolean
  onCancel: () => void
  onDelete: () => void
  onSave: (p: Prescription) => void
}) {
  const [p, setP] = useState<Prescription>(p0)
  const timed = p.track === 'time'
  const long = (p.durationS ?? 0) >= 300
  const set = (patch: Partial<Prescription>) => setP({ ...p, ...patch })
  return (
    <div className="overlay sheet" role="dialog" aria-label={p.exercise.name}>
      <div className="sheet-card tall">
        <h2>{p.exercise.name}</h2>
        <div className="chips tight">
          {BLOCKS.map((b) => (
            <button key={b.id} type="button" className={`chip ${p.block === b.id ? 'on' : ''}`} onClick={() => set({ block: b.id })}>
              {b.label}
            </button>
          ))}
        </div>
        <div className="entry">
          <Stepper label="Sèries" value={p.sets} step={1} min={1} max={20} onChange={(v) => set({ sets: v })} />
          {timed ? (
            long ? (
              <Stepper label="Durada" unit="min" value={Math.round((p.durationS ?? 0) / 60)} step={5} min={5} max={240} onChange={(v) => set({ durationS: v * 60 })} />
            ) : (
              <Stepper label="Durada" unit="s" value={p.durationS ?? 30} step={5} min={5} max={600} onChange={(v) => set({ durationS: v })} />
            )
          ) : (
            <>
              <Stepper label="Rep. mínimes" value={p.repsMin ?? 8} step={1} min={1} max={50} onChange={(v) => set({ repsMin: v, repsMax: Math.max(v, p.repsMax ?? v) })} />
              <Stepper label="Rep. màximes" value={p.repsMax ?? 12} step={1} min={1} max={50} onChange={(v) => set({ repsMax: v, repsMin: Math.min(v, p.repsMin ?? v) })} />
            </>
          )}
          <Stepper label="Descans" unit="s" value={p.restS} step={15} min={0} max={600} onChange={(v) => set({ restS: v })} />
        </div>
        {!timed && p.block === 'principal' && (
          <fieldset className="rir">
            <legend>
              Repeticions en reserva objectiu <small>(esforç)</small>
            </legend>
            <div className="chips">
              {[0, 1, 2, 3, 4].map((r) => (
                <button key={r} type="button" className={`chip ${p.rirTarget === r ? 'on' : ''}`} onClick={() => set({ rirTarget: r })}>
                  {r}
                </button>
              ))}
              <button type="button" className={`chip ${p.rirTarget == null ? 'on' : ''}`} onClick={() => set({ rirTarget: undefined })}>
                Sense
              </button>
            </div>
          </fieldset>
        )}
        {long && (
          <fieldset className="rir">
            <legend>Zona de freqüència cardíaca</legend>
            <div className="chips">
              {[1, 2, 3, 4, 5].map((z) => (
                <button key={z} type="button" className={`chip ${p.hrZone === z ? 'on' : ''}`} onClick={() => set({ hrZone: z })}>
                  Z{z}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <div className="overlay-actions">
          {!isNew && (
            <button type="button" className="btn ghost" onClick={onDelete}>
              Treu-lo
            </button>
          )}
          <button type="button" className="btn ghost" onClick={onCancel}>
            Torna
          </button>
          <button type="button" className="btn primary" onClick={() => onSave(p)}>
            {isNew ? 'Afegeix' : 'Desa'}
          </button>
        </div>
      </div>
    </div>
  )
}
