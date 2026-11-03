import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { CATALOG } from '../data/catalog'
import { db } from '../lib/db'
import type { HistoryEntry } from '../lib/loads'
import { epley1RM, fmtKg, suggestNext } from '../lib/progression'
import type { Block, PlannedSession, Prescription, SessionDraft, SetLog } from '../lib/types'
import { ExerciseMedia } from './ExerciseMedia'
import { PlanLane } from './PlanLane'
import { Plates } from './Plates'
import { RestTimer } from './RestTimer'
import { Stepper } from './Stepper'
import { WorkTimer } from './WorkTimer'

const needsBar = new Set(CATALOG.filter((e) => e.needs?.includes('barra')).map((e) => e.id))

export type FinishData = {
  draft: SessionDraft
  sessionRpe: number | null
  feeling: number | null
  notes: string | null
}

export type WeekDay = { id: string; date: string; title: string; state: 'fet' | 'actual' | 'pendent' }
export type Alternative = { id: string; name: string }
export type DoneInfo = { date: string; rpe?: number | null; sets: HistoryEntry[] }

type Props = {
  session: PlannedSession
  advice: Record<string, string> // prescriptionId → motiu de la càrrega suggerida
  week: WeekDay[]
  selectedId: string
  onSelectDay: (id: string) => void
  weekNav: { week: number; weeks: number; deloadWeeks: number[]; onPrev?: () => void; onNext?: () => void }
  isNext: boolean // és la sessió que toca
  done?: DoneInfo // si ja està feta: vista de només lectura
  syncLabel: string
  onChipClick?: () => void
  alternatives: (p: Prescription) => Alternative[]
  onSwap: (p: Prescription, toId: string, permanent: boolean) => void
  onFinish: (data: FinishData) => void
  topSlot?: ReactNode
  notice?: string | null
}

type Entry = { load: number; reps: number; rir: number; duration: number }

const todayIso = () => new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD en hora local
const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ca', { ...opts, timeZone: 'UTC' }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`))
const cap = (s: string) => s.replace(/^./, (c) => c.toUpperCase())

const BLOCK_LABEL: Record<Block, string> = {
  escalfament: 'Escalfament i mobilitat',
  principal: 'Part principal',
  calma: 'Tornada a la calma',
}

const isLong = (p: Prescription) => (p.durationS ?? 0) >= 300
const fmtDur = (s: number) => (s >= 300 ? `${Math.round(s / 60)} min` : s >= 60 && s % 60 === 0 ? `${s / 60} min` : `${s} s`)

function prescriptionLabel(p: Prescription): string[] {
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
  return parts
}

// Durada estimada: treball (≈4 s per repetició o la durada indicada) + descansos + 1 min de canvi per exercici
export function estimateMinutes(s: PlannedSession) {
  const secs = s.prescriptions.reduce((a, p) => {
    const work = p.durationS ?? ((p.repsMin ?? 8) + (p.repsMax ?? 12)) * 2
    return a + p.sets * work + Math.max(0, p.sets - 1) * p.restS + 60
  }, 0)
  return Math.max(5, Math.round(secs / 60 / 5) * 5)
}

const Meta = ({ parts }: { parts: string[] }) => (
  <span className="meta">
    {parts.map((t) => (
      <span key={t}>{t}</span>
    ))}
  </span>
)

function setLabel(s: { durationS?: number; reps?: number; loadKg?: number; rir?: number }) {
  if (s.durationS != null && s.reps == null) return <b>{fmtDur(s.durationS)}</b>
  return (
    <>
      <b>{s.loadKg ? `${fmtKg(s.loadKg)} × ${s.reps}` : s.reps}</b>
      {s.rir != null && <small>RIR {s.rir}</small>}
    </>
  )
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

export function Today(props: Props) {
  const { session, advice, week, selectedId, onSelectDay, weekNav, isNext, done, syncLabel, onChipClick, alternatives, onSwap, onFinish, topSlot, notice } = props
  const [draft, setDraft] = useState<SessionDraft | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [entry, setEntry] = useState<Entry>({ load: 0, reps: 0, rir: 2, duration: 0 })
  const [rest, setRest] = useState<{ endAt: number; totalS: number; next: string; nextId?: string } | null>(null)
  const [timing, setTiming] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [swapping, setSwapping] = useState<Prescription | null>(null)
  const listRef = useRef<HTMLOListElement>(null)

  const started = !!draft
  useWakeLock(started)

  // Recupera l'entrenament en curs d'aquesta sessió, si n'hi ha
  useEffect(() => {
    setLoaded(false)
    setDraft(null)
    setActiveId(null)
    db.drafts
      .where('plannedSessionId')
      .equals(session.id)
      .first()
      .then((d) => {
        setDraft(d ?? null)
        if (d) {
          const firstOpen = session.prescriptions.find((p) => d.sets.filter((s) => s.prescriptionId === p.id).length < p.sets)
          setActiveId(firstOpen?.id ?? null)
        }
        setLoaded(true)
      })
    // només en canviar de sessió
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id])

  const sets = useMemo(() => draft?.sets ?? [], [draft])
  const setsOf = (pid: string) => sets.filter((s) => s.prescriptionId === pid)
  const active = session.prescriptions.find((p) => p.id === activeId) ?? null
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

  // En canviar d'exercici actiu, el porta a la vista
  useEffect(() => {
    if (!activeId || !started) return
    const el = listRef.current?.querySelector(`[data-pid="${activeId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [activeId, started])

  const save = (d: SessionDraft) => {
    setDraft(d)
    db.drafts.put(d)
  }

  const start = () => {
    const d: SessionDraft = { id: crypto.randomUUID(), plannedSessionId: session.id, startedAt: new Date().toISOString(), sets: [] }
    save(d)
    setActiveId(session.prescriptions[0]?.id ?? null)
  }

  const register = (durationOverride?: number) => {
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
      durationS: timed ? (durationOverride ?? entry.duration) : undefined,
      completedAt: new Date().toISOString(),
    }
    const next: SessionDraft = { ...draft, sets: [...draft.sets, log] }
    save(next)
    navigator.vibrate?.(30)

    const exerciseDone = n + 1 >= active.sets
    const nextOpen = session.prescriptions.find((p) => next.sets.filter((s) => s.prescriptionId === p.id).length < p.sets)
    if (exerciseDone) setActiveId(nextOpen?.id ?? null)
    if (!nextOpen || active.restS <= 0) return
    const label = exerciseDone ? nextOpen.exercise.name : `${active.exercise.name}, sèrie ${n + 2}`
    setRest({ endAt: Date.now() + active.restS * 1000, totalS: active.restS, next: label, nextId: nextOpen.exercise.id })
  }

  const undo = () => {
    if (!draft || !active) return
    const mine = setsOf(active.id)
    if (!mine.length) return
    const lastId = mine.at(-1)!.id
    save({ ...draft, sets: draft.sets.filter((s) => s.id !== lastId) })
  }

  const discard = () => {
    if (!draft) return
    db.drafts.delete(draft.id)
    setDraft(null)
    setActiveId(null)
  }

  if (!loaded) return <main className="screen" aria-busy="true" />

  const pct = Math.round((doneSets / Math.max(1, totalSets)) * 100)
  const tIso = todayIso()
  const [titleMain, ...titleRest] = session.title.split(' · ')
  const status = done
    ? `Feta el ${fmtDay(done.date, { weekday: 'long', day: 'numeric' })}`
    : session.date === tIso
      ? 'Avui'
      : session.date < tIso
        ? 'Pendent d’un dia anterior'
        : `Prevista per al ${fmtDay(session.date, { weekday: 'long', day: 'numeric' })}`
  const doneSetsOf = (exId: string) => (done?.sets ?? []).filter((h) => h.exerciseId === exId)

  return (
    <main className="screen today">
      <header className="today-head">
        <div className="today-top">
          <p className="today-date">{cap(fmtDay(tIso, { weekday: 'long', day: 'numeric', month: 'long' }))}</p>
          {onChipClick ? (
            <button type="button" className="sync-chip action" onClick={onChipClick}>
              {syncLabel}: activa el núvol
            </button>
          ) : (
            <span className="sync-chip">{syncLabel}</span>
          )}
        </div>
        <PlanLane
          weeks={weekNav.weeks}
          current={weekNav.week}
          deloadWeeks={weekNav.deloadWeeks}
          deload={weekNav.deloadWeeks.includes(weekNav.week)}
          onPrev={weekNav.onPrev}
          onNext={weekNav.onNext}
        />

        <ol className="week-strip" aria-label="Sessions de la setmana">
          {week.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                className={`${d.state} ${d.id === selectedId ? 'sel' : ''} ${d.date === tIso ? 'today' : ''}`}
                aria-current={d.id === selectedId ? 'true' : undefined}
                onClick={() => onSelectDay(d.id)}
              >
                <span className="wd">{fmtDay(d.date, { weekday: 'short' }).replace('.', '')}</span>
                <span className="wn">{fmtDay(d.date, { day: 'numeric' })}</span>
                <span className="wt">{d.state === 'fet' ? 'Feta' : d.title.split(' · ')[0]}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="session-title">
          <p className={`session-status ${done ? 'done' : isNext ? 'next' : ''}`}>{cap(status)}</p>
          <h1>{titleMain}</h1>
          {titleRest.length > 0 && <p className="today-sub">{cap(titleRest.join(', '))}</p>}
        </div>
      </header>

      {isNext && !done && topSlot}

      {!done && notice && <p className="date-note">{notice}</p>}
      {session.deload && !done && <p className="date-note deload">Setmana de descàrrega: menys sèries i càrregues una mica més baixes per recuperar.</p>}

      {!done && !started && (
        <dl className="session-facts">
          <div>
            <dt>Durada</dt>
            <dd>
              {estimateMinutes(session)}
              <small>min aprox.</small>
            </dd>
          </div>
          <div>
            <dt>Exercicis</dt>
            <dd>{session.prescriptions.length}</dd>
          </div>
          <div>
            <dt>Sèries</dt>
            <dd>{totalSets}</dd>
          </div>
        </dl>
      )}

      {done && (
        <dl className="session-facts">
          <div>
            <dt>Sèries fetes</dt>
            <dd>{done.sets.length}</dd>
          </div>
          <div>
            <dt>Volum</dt>
            <dd>
              {Math.round(done.sets.reduce((a, s) => a + (s.loadKg ?? 0) * (s.reps ?? 0), 0)).toLocaleString('ca')}
              <small>kg</small>
            </dd>
          </div>
          <div>
            <dt>Esforç</dt>
            <dd>{done.rpe ?? '—'}</dd>
          </div>
        </dl>
      )}

      {started && !done && (
        <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div className="progress-bar" style={{ width: `${pct}%` }} />
          <span className="progress-label">
            {doneSets} de {totalSets} sèries
          </span>
        </div>
      )}

      <ol className="exercises" ref={listRef}>
        {session.prescriptions.map((p, i) => {
          const mine = setsOf(p.id)
          const complete = mine.length >= p.sets
          const isActive = p.id === activeId
          const sug = complete && p.track !== 'time' ? suggestNext(p, sets) : null
          const best = Math.max(0, ...mine.map((s) => epley1RM(s.loadKg ?? 0, s.reps ?? 0) ?? 0))
          const newBlock = i === 0 || session.prescriptions[i - 1].block !== p.block
          const history = done ? doneSetsOf(p.exercise.id) : []
          const timed = p.track === 'time'
          return (
            <li key={p.id} className="ex-wrap" data-pid={p.id}>
              {newBlock && <h2 className="block-head">{BLOCK_LABEL[p.block]}</h2>}
              <div className={`ex ${isActive ? 'active' : ''} ${complete ? 'complete' : ''} ${started ? '' : 'preview'}`}>
                <button type="button" className="ex-head" onClick={() => setActiveId(isActive && !started ? null : p.id)} aria-expanded={isActive}>
                  <span className="ex-num">{complete ? '✓' : i + 1}</span>
                  <span className="ex-title">
                    <strong>{p.exercise.name}</strong>
                    <Meta parts={prescriptionLabel(p)} />
                  </span>
                  {started ? (
                    <span className="ex-count">
                      {Math.min(mine.length, p.sets)}/{p.sets}
                    </span>
                  ) : (
                    <span className="ex-chev" aria-hidden="true">
                      {isActive ? '−' : '+'}
                    </span>
                  )}
                </button>

                {isActive && (
                  <div className="ex-body">
                    <ExerciseMedia exerciseId={p.exercise.id} />
                    <p className="cue">{p.exercise.cue}</p>
                    {p.note && <p className="muted small">{p.note}</p>}

                    {done && history.length > 0 && (
                      <ul className="done-sets">
                        {history.map((s, k) => (
                          <li key={s.id}>
                            <span className="set-n">{k + 1}</span> {setLabel(s)}
                          </li>
                        ))}
                      </ul>
                    )}

                    {started && p.track === 'load_reps' && !complete && (
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
                            <span className="set-n">{s.setIndex}</span> {setLabel(s)}
                          </li>
                        ))}
                      </ul>
                    )}

                    {started && !complete && (
                      <>
                        <div className="entry">
                          {timed ? (
                            isLong(p) ? (
                              <Stepper label="Temps" unit="min" value={Math.round(entry.duration / 60)} step={1} min={1} onChange={(v) => setEntry({ ...entry, duration: v * 60 })} />
                            ) : (
                              <Stepper label="Temps" unit="s" value={entry.duration} step={5} min={5} onChange={(v) => setEntry({ ...entry, duration: v })} />
                            )
                          ) : (
                            <>
                              {p.track === 'load_reps' && (
                                <div className="load-box">
                                  <Stepper
                                    label="Càrrega"
                                    unit="kg"
                                    value={entry.load}
                                    step={entry.load < 20 ? 1 : 2.5}
                                    format={fmtKg}
                                    onChange={(v) => setEntry({ ...entry, load: v })}
                                  />
                                  {needsBar.has(p.exercise.id) && <Plates totalKg={entry.load} />}
                                </div>
                              )}
                              <Stepper label="Repeticions" value={entry.reps} step={1} max={100} onChange={(v) => setEntry({ ...entry, reps: v })} />
                            </>
                          )}
                        </div>

                        {p.rirTarget != null && !timed && (
                          <fieldset className="rir">
                            <legend>
                              Repeticions en reserva <small>(quantes més n’hauries pogut fer)</small>
                            </legend>
                            <div className="chips">
                              {[0, 1, 2, 3, 4].map((r) => (
                                <button key={r} type="button" className={`chip ${entry.rir === r ? 'on' : ''}`} onClick={() => setEntry({ ...entry, rir: r })}>
                                  {r === 4 ? '4+' : r}
                                </button>
                              ))}
                            </div>
                          </fieldset>
                        )}

                        {timed ? (
                          <>
                            <button type="button" className="btn primary block big" onClick={() => setTiming(true)}>
                              Inicia el temporitzador ({fmtDur(entry.duration)})
                            </button>
                            <button type="button" className="link" onClick={() => register()}>
                              Registra-la sense temporitzador
                            </button>
                          </>
                        ) : (
                          <button type="button" className="btn primary block big" onClick={() => register()}>
                            Registra la sèrie {mine.length + 1}
                          </button>
                        )}
                      </>
                    )}

                    {started && complete && (
                      <div className="ex-result">
                        {sug && <p className={`sug ${sug.kind}`}>{sug.text}</p>}
                        {best > 0 && <p className="muted">1RM estimat: {fmtKg(best)} kg</p>}
                      </div>
                    )}

                    {started && (
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
                    )}
                  </div>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {!done && (
        <div className="finish-bar">
          {!started ? (
            <button type="button" className="btn primary block big" onClick={start}>
              {isNext ? 'Comença la sessió' : 'Fes aquesta sessió ara'}
            </button>
          ) : (
            <div className="finish-row">
              {doneSets === 0 ? (
                <button type="button" className="btn ghost" onClick={discard}>
                  Cancel·la
                </button>
              ) : null}
              <button type="button" className={`btn block ${doneSets === totalSets ? 'primary' : 'ghost'}`} onClick={() => setFinishing(true)} disabled={doneSets === 0}>
                Acaba l’entrenament
              </button>
            </div>
          )}
        </div>
      )}

      {rest && (
        <RestTimer
          endAt={rest.endAt}
          totalS={rest.totalS}
          nextLabel={rest.next}
          nextExerciseId={rest.nextId}
          onAdd={(s) => setRest({ ...rest, endAt: rest.endAt + s * 1000, totalS: rest.totalS + s })}
          onDone={() => setRest(null)}
        />
      )}

      {timing && active && (
        <WorkTimer
          exerciseId={active.exercise.id}
          label={`Sèrie ${setsOf(active.id).length + 1} de ${active.sets}`}
          targetS={entry.duration || active.durationS || 30}
          onCancel={() => setTiming(false)}
          onDone={(secs) => {
            setTiming(false)
            register(secs)
          }}
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

      {finishing && draft && (
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
