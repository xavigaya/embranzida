import { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/db'
import { epley1RM, fmtKg, suggestNext } from '../lib/progression'
import type { Block, PlannedSession, Prescription, SessionDraft, SetLog } from '../lib/types'
import { RestTimer } from './RestTimer'
import { Stepper } from './Stepper'

export type FinishData = {
  draft: SessionDraft
  sessionRpe: number | null
  feeling: number | null
  notes: string | null
}

export type WeekDay = { id: string; date: string; title: string; state: 'fet' | 'actual' | 'pendent' }
export type Alternative = { id: string; name: string }

type Props = {
  session: PlannedSession
  advice: Record<string, string> // prescriptionId → motiu de la càrrega suggerida
  week: WeekDay[]
  alias: string
  syncLabel: string
  onChipClick?: () => void
  alternatives: (p: Prescription) => Alternative[]
  onSwap: (p: Prescription, toId: string, permanent: boolean) => void
  onFinish: (data: FinishData) => void
}

type Entry = { load: number; reps: number; rir: number; duration: number }

const todayIso = () => new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD en hora local
const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ca', { ...opts, timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`))

const BLOCK_LABEL: Record<Block, string> = {
  escalfament: 'Escalfament i mobilitat',
  principal: 'Part principal',
  calma: 'Tornada a la calma',
}

const isLong = (p: Prescription) => (p.durationS ?? 0) >= 300
const fmtDur = (s: number) => (s >= 300 ? `${Math.round(s / 60)} min` : s >= 60 && s % 60 === 0 ? `${s / 60} min` : `${s} s`)

function prescriptionLabel(p: Prescription) {
  let main: string
  if (p.track === 'time' || p.durationS) {
    main = p.sets > 1 ? `${p.sets} × ${fmtDur(p.durationS ?? 0)}` : fmtDur(p.durationS ?? 0)
  } else {
    main = `${p.sets} × ${p.repsMin === p.repsMax ? p.repsMin : `${p.repsMin}–${p.repsMax}`}`
  }
  const parts = [main]
  if (p.loadKg) parts.push(`${fmtKg(p.loadKg)} kg`)
  if (p.rirTarget != null) parts.push(`RIR ${p.rirTarget}`)
  if (p.hrZone) parts.push(`zona ${p.hrZone}`)
  if (p.sets > 1 && p.restS >= 60 && p.durationS) parts.push(`rec. ${fmtDur(p.restS)}`)
  return parts.join(' · ')
}

function setLabel(s: SetLog) {
  if (s.durationS != null && s.reps == null) return fmtDur(s.durationS)
  const kg = s.loadKg ? `${fmtKg(s.loadKg)} kg × ` : ''
  return `${kg}${s.reps}${s.rir != null ? ` · RIR ${s.rir}` : ''}`
}

function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    const req = () =>
      navigator.wakeLock
        .request('screen')
        .then((l) => (lock = l))
        .catch(() => {})
    req()
    const onVis = () => document.visibilityState === 'visible' && req()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      lock?.release().catch(() => {})
    }
  }, [active])
}

export function Today({ session, advice, week, alias, syncLabel, onChipClick, alternatives, onSwap, onFinish }: Props) {
  const [draft, setDraft] = useState<SessionDraft | null>(null)
  const [activeId, setActiveId] = useState<string>(session.prescriptions[0]?.id)
  const [entry, setEntry] = useState<Entry>({ load: 0, reps: 0, rir: 2, duration: 0 })
  const [rest, setRest] = useState<{ endAt: number; totalS: number; next: string } | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [swapping, setSwapping] = useState<Prescription | null>(null)

  useWakeLock(true)

  // Recupera l'entrenament en curs (si n'hi ha) o en comença un de nou
  useEffect(() => {
    db.drafts
      .where('plannedSessionId')
      .equals(session.id)
      .first()
      .then((d) => {
        const fresh: SessionDraft = d ?? {
          id: crypto.randomUUID(),
          plannedSessionId: session.id,
          startedAt: new Date().toISOString(),
          sets: [],
        }
        if (!d) db.drafts.put(fresh)
        setDraft(fresh)
        const firstOpen = session.prescriptions.find(
          (p) => fresh.sets.filter((s) => s.prescriptionId === p.id).length < p.sets,
        )
        if (firstOpen) setActiveId(firstOpen.id)
      })
    // només en canviar de sessió
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id])

  const sets = useMemo(() => draft?.sets ?? [], [draft])
  const setsOf = (pid: string) => sets.filter((s) => s.prescriptionId === pid)
  const active = session.prescriptions.find((p) => p.id === activeId) ?? session.prescriptions[0]
  const totalSets = session.prescriptions.reduce((a, p) => a + p.sets, 0)
  const doneSets = session.prescriptions.reduce((a, p) => a + Math.min(p.sets, setsOf(p.id).length), 0)

  // Valors per defecte de l'entrada: l'última sèrie feta o la prescripció
  useEffect(() => {
    if (!active) return
    const last = sets.filter((s) => s.prescriptionId === active.id).at(-1)
    setEntry({
      load: last?.loadKg ?? active.loadKg ?? active.startKg ?? 0,
      reps: last?.reps ?? active.repsMax ?? 0,
      rir: last?.rir ?? active.rirTarget ?? 2,
      duration: last?.durationS ?? active.durationS ?? 0,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, draft?.id, active?.exercise.id, active?.loadKg])

  const save = (d: SessionDraft) => {
    setDraft(d)
    db.drafts.put(d)
  }

  const register = () => {
    if (!draft || !active) return
    const n = setsOf(active.id).length
    const timed = active.track === 'time'
    const log: SetLog = {
      id: crypto.randomUUID(),
      prescriptionId: active.id,
      exerciseId: active.exercise.id,
      setIndex: n + 1,
      loadKg: active.track === 'load_reps' && entry.load > 0 ? entry.load : undefined,
      reps: timed ? undefined : entry.reps,
      rir: timed || active.rirTarget == null ? undefined : entry.rir,
      durationS: timed ? entry.duration : undefined,
      completedAt: new Date().toISOString(),
    }
    const next: SessionDraft = { ...draft, sets: [...draft.sets, log] }
    save(next)

    const exerciseDone = n + 1 >= active.sets
    const nextOpen = session.prescriptions.find(
      (p) => next.sets.filter((s) => s.prescriptionId === p.id).length < p.sets,
    )
    if (exerciseDone && nextOpen) setActiveId(nextOpen.id)
    if (!nextOpen || active.restS <= 0) return
    const label = exerciseDone ? nextOpen.exercise.name : `${active.exercise.name} · sèrie ${n + 2}`
    setRest({ endAt: Date.now() + active.restS * 1000, totalS: active.restS, next: label })
  }

  const undo = () => {
    if (!draft || !active) return
    const mine = setsOf(active.id)
    if (!mine.length) return
    const lastId = mine.at(-1)!.id
    save({ ...draft, sets: draft.sets.filter((s) => s.id !== lastId) })
  }

  if (!draft) return <main className="screen" aria-busy="true" />

  const pct = Math.round((doneSets / Math.max(1, totalSets)) * 100)
  const tIso = todayIso()
  const dateNote =
    session.date === tIso ? null : session.date < tIso ? 'Sessió pendent d’un dia anterior' : `Prevista per al ${fmtDay(session.date, { weekday: 'long', day: 'numeric' })}`

  return (
    <main className="screen today">
      <header className="today-head">
        <div>
          <p className="kicker">{fmtDay(tIso, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
          <h1>{session.title.split(' · ')[0]}</h1>
          <p className="muted">
            {[...session.title.split(' · ').slice(1), session.focus]
              .join(' · ')
              .replace(/^./, (c) => c.toUpperCase())}
          </p>
        </div>
        <div className="head-side">
          {onChipClick ? (
            <button type="button" className="sync-chip action" onClick={onChipClick}>
              {syncLabel} · Activa el núvol
            </button>
          ) : (
            <span className="sync-chip">{syncLabel}</span>
          )}
          <span className="hello">Hola, {alias}</span>
        </div>
      </header>

      <ol className="week-strip" aria-label="Sessions d’aquesta setmana">
        {week.map((d) => (
          <li key={d.id} className={d.state}>
            <span className="wd">{fmtDay(d.date, { weekday: 'short' }).replace('.', '')}</span>
            <span className="wn">{fmtDay(d.date, { day: 'numeric' })}</span>
            <span className="wt">{d.title.split(' · ')[0]}</span>
          </li>
        ))}
      </ol>

      {dateNote && <p className="date-note">{dateNote}. La pots fer ara.</p>}
      {session.deload && (
        <p className="date-note deload">Setmana de descàrrega: menys sèries i càrregues una mica més baixes per recuperar.</p>
      )}

      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="progress-bar" style={{ width: `${pct}%` }} />
        <span className="progress-label">
          {doneSets} de {totalSets} sèries
        </span>
      </div>

      <ol className="exercises">
        {session.prescriptions.map((p, i) => {
          const mine = setsOf(p.id)
          const complete = mine.length >= p.sets
          const isActive = p.id === active?.id
          const sug = complete && p.track !== 'time' ? suggestNext(p, sets) : null
          const best = Math.max(0, ...mine.map((s) => epley1RM(s.loadKg ?? 0, s.reps ?? 0) ?? 0))
          const newBlock = i === 0 || session.prescriptions[i - 1].block !== p.block
          return (
            <li key={p.id} className="ex-wrap">
              {newBlock && <h2 className="block-head">{BLOCK_LABEL[p.block]}</h2>}
              <div className={`ex ${isActive ? 'active' : ''} ${complete ? 'complete' : ''}`}>
                <button type="button" className="ex-head" onClick={() => setActiveId(p.id)} aria-expanded={isActive}>
                  <span className="ex-num">{complete ? '✓' : i + 1}</span>
                  <span className="ex-title">
                    <strong>{p.exercise.name}</strong>
                    <small>{prescriptionLabel(p)}</small>
                  </span>
                  <span className="ex-count">
                    {Math.min(mine.length, p.sets)}/{p.sets}
                  </span>
                </button>

                {isActive && (
                  <div className="ex-body">
                    <p className="cue">{p.exercise.cue}</p>
                    {p.note && <p className="muted small">{p.note}</p>}
                    {p.track === 'load_reps' && !complete && (
                      <p className="advice">
                        {p.loadKg
                          ? `Càrrega suggerida: ${fmtKg(p.loadKg)} kg. ${advice[p.id] ?? ''}`
                          : `Primer cop: ajusta la càrrega perquè et quedin unes ${p.rirTarget ?? 2} repeticions en reserva. La propera sessió ja te la proposarem.`}
                      </p>
                    )}

                    {mine.length > 0 && (
                      <ul className="done-sets">
                        {mine.map((s) => (
                          <li key={s.id}>
                            <span>S{s.setIndex}</span> {setLabel(s)}
                          </li>
                        ))}
                      </ul>
                    )}

                    {!complete && (
                      <>
                        <div className="entry">
                          {p.track === 'time' ? (
                            isLong(p) ? (
                              <Stepper
                                label="Temps"
                                unit="min"
                                value={Math.round(entry.duration / 60)}
                                step={1}
                                min={1}
                                onChange={(v) => setEntry({ ...entry, duration: v * 60 })}
                              />
                            ) : (
                              <Stepper
                                label="Temps"
                                unit="s"
                                value={entry.duration}
                                step={5}
                                onChange={(v) => setEntry({ ...entry, duration: v })}
                              />
                            )
                          ) : (
                            <>
                              {p.track === 'load_reps' && (
                                <Stepper
                                  label="Càrrega"
                                  unit="kg"
                                  value={entry.load}
                                  step={entry.load < 20 ? 1 : 2.5}
                                  format={fmtKg}
                                  onChange={(v) => setEntry({ ...entry, load: v })}
                                />
                              )}
                              <Stepper
                                label="Repeticions"
                                value={entry.reps}
                                step={1}
                                max={100}
                                onChange={(v) => setEntry({ ...entry, reps: v })}
                              />
                            </>
                          )}
                        </div>

                        {p.rirTarget != null && p.track !== 'time' && (
                          <fieldset className="rir">
                            <legend>
                              Repeticions en reserva <small>(quantes més n’hauries pogut fer)</small>
                            </legend>
                            <div className="chips">
                              {[0, 1, 2, 3, 4].map((r) => (
                                <button
                                  key={r}
                                  type="button"
                                  className={`chip ${entry.rir === r ? 'on' : ''}`}
                                  onClick={() => setEntry({ ...entry, rir: r })}
                                >
                                  {r === 4 ? '4+' : r}
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        )}

                        <button type="button" className="btn primary block big" onClick={register}>
                          {p.track === 'time' && p.sets === 1 ? 'Fet' : `Registra la sèrie ${mine.length + 1}`}
                        </button>
                      </>
                    )}

                    {complete && (
                      <div className="ex-result">
                        {sug && <p className={`sug ${sug.kind}`}>{sug.text}</p>}
                        {best > 0 && <p className="muted">1RM estimat: {fmtKg(best)} kg</p>}
                      </div>
                    )}

                    <div className="ex-links">
                      {mine.length > 0 && (
                        <button type="button" className="link" onClick={undo}>
                          Desfés l’última sèrie
                        </button>
                      )}
                      {mine.length === 0 && alternatives(p).length > 0 && (
                        <button type="button" className="link" onClick={() => setSwapping(p)}>
                          No puc o no vull fer aquest exercici
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      <div className="finish-bar">
        <button
          type="button"
          className={`btn block ${doneSets === totalSets ? 'primary' : 'ghost'}`}
          onClick={() => setFinishing(true)}
          disabled={doneSets === 0}
        >
          Acaba l’entrenament
        </button>
      </div>

      {rest && (
        <RestTimer
          endAt={rest.endAt}
          totalS={rest.totalS}
          nextLabel={rest.next}
          onAdd={(s) => setRest({ ...rest, endAt: rest.endAt + s * 1000, totalS: rest.totalS + s })}
          onDone={() => setRest(null)}
        />
      )}

      {swapping && (
        <SwapSheet
          p={swapping}
          options={alternatives(swapping)}
          onCancel={() => setSwapping(null)}
          onPick={(id, permanent) => {
            onSwap(swapping, id, permanent)
            setSwapping(null)
          }}
        />
      )}

      {finishing && (
        <FinishSheet
          incomplete={doneSets < totalSets}
          onCancel={() => setFinishing(false)}
          onConfirm={(rpe, feeling, notes) => onFinish({ draft, sessionRpe: rpe, feeling, notes })}
        />
      )}
    </main>
  )
}

function SwapSheet({
  p,
  options,
  onCancel,
  onPick,
}: {
  p: Prescription
  options: Alternative[]
  onCancel: () => void
  onPick: (id: string, permanent: boolean) => void
}) {
  const [choice, setChoice] = useState<string | null>(null)
  const [permanent, setPermanent] = useState(true)
  return (
    <div className="overlay sheet" role="dialog" aria-label="Canviar l’exercici">
      <div className="sheet-card">
        <h2>Alternatives a {p.exercise.name}</h2>
        <p className="muted">Exercicis del mateix patró de moviment amb el material que tens.</p>
        <div className="options">
          {options.map((o) => (
            <button key={o.id} type="button" className={`option compact-text ${choice === o.id ? 'on' : ''}`} onClick={() => setChoice(o.id)}>
              <strong>{o.name}</strong>
            </button>
          ))}
        </div>
        <label className="consent">
          <input type="checkbox" checked={permanent} onChange={(e) => setPermanent(e.target.checked)} />
          <span>Fes servir aquesta alternativa també a les properes sessions</span>
        </label>
        <div className="overlay-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Torna
          </button>
          <button type="button" className="btn primary" disabled={!choice} onClick={() => choice && onPick(choice, permanent)}>
            Canvia
          </button>
        </div>
      </div>
    </div>
  )
}

function FinishSheet({
  incomplete,
  onCancel,
  onConfirm,
}: {
  incomplete: boolean
  onCancel: () => void
  onConfirm: (rpe: number | null, feeling: number | null, notes: string | null) => void
}) {
  const [rpe, setRpe] = useState<number | null>(null)
  const [feeling, setFeeling] = useState<number | null>(null)
  const [notes, setNotes] = useState('')
  const FEEL = ['Molt malament', 'Malament', 'Normal', 'Bé', 'Molt bé']

  return (
    <div className="overlay sheet" role="dialog" aria-label="Acabar l’entrenament">
      <div className="sheet-card">
        <h2>Com ha anat?</h2>
        {incomplete && <p className="warn">Encara tens sèries pendents. Es guardarà el que has fet.</p>}

        <fieldset className="field">
          <legend>Esforç global de la sessió (1–10)</legend>
          <div className="chips tight">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" className={`chip ${rpe === n ? 'on' : ''}`} onClick={() => setRpe(n)}>
                {n}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Sensacions</legend>
          <div className="chips">
            {FEEL.map((f, i) => (
              <button
                key={f}
                type="button"
                className={`chip ${feeling === i + 1 ? 'on' : ''}`}
                onClick={() => setFeeling(i + 1)}
              >
                {f}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>Notes (opcional)</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Molèsties, sensacions, material…" />
        </label>

        <div className="overlay-actions">
          <button type="button" className="btn ghost" onClick={onCancel}>
            Torna
          </button>
          <button type="button" className="btn primary" onClick={() => onConfirm(rpe, feeling, notes.trim() || null)}>
            Desa l’entrenament
          </button>
        </div>
      </div>
    </div>
  )
}
