import { useEffect, useMemo, useState } from 'react'
import { db } from '../lib/db'
import { epley1RM, fmtKg, suggestNext } from '../lib/progression'
import type { PlannedSession, Prescription, SessionDraft, SetLog } from '../lib/types'
import { RestTimer } from './RestTimer'
import { Stepper } from './Stepper'

export type FinishData = {
  draft: SessionDraft
  sessionRpe: number | null
  feeling: number | null
  notes: string | null
}

type Props = {
  session: PlannedSession
  alias: string
  syncLabel: string
  onChipClick?: () => void
  assessed: boolean
  onAssess: () => void
  onFinish: (data: FinishData) => void
}

type Entry = { load: number; reps: number; rir: number; duration: number }

const today = new Intl.DateTimeFormat('ca', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

function prescriptionLabel(p: Prescription) {
  const reps = p.durationS
    ? `${p.durationS} s`
    : p.repsMin === p.repsMax
      ? `${p.repsMin}`
      : `${p.repsMin}–${p.repsMax}`
  const parts = [`${p.sets} × ${reps}`]
  if (p.loadKg) parts.push(`${fmtKg(p.loadKg)} kg`)
  if (p.rirTarget != null) parts.push(`RIR ${p.rirTarget}`)
  return parts.join(' · ')
}

function setLabel(s: SetLog) {
  if (s.durationS != null && s.reps == null) return `${s.durationS} s`
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

export function Today({ session, alias, syncLabel, onChipClick, assessed, onAssess, onFinish }: Props) {
  const [draft, setDraft] = useState<SessionDraft | null>(null)
  const [activeId, setActiveId] = useState<string>(session.prescriptions[0].id)
  const [entry, setEntry] = useState<Entry>({ load: 0, reps: 0, rir: 2, duration: 0 })
  const [rest, setRest] = useState<{ endAt: number; totalS: number; next: string } | null>(null)
  const [finishing, setFinishing] = useState(false)

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
  }, [session])

  const sets = useMemo(() => draft?.sets ?? [], [draft])
  const setsOf = (pid: string) => sets.filter((s) => s.prescriptionId === pid)
  const active = session.prescriptions.find((p) => p.id === activeId)!
  const totalSets = session.prescriptions.reduce((a, p) => a + p.sets, 0)
  const doneSets = session.prescriptions.reduce((a, p) => a + Math.min(p.sets, setsOf(p.id).length), 0)

  // Valors per defecte de l'entrada: l'última sèrie feta o la prescripció
  useEffect(() => {
    const last = sets.filter((s) => s.prescriptionId === active.id).at(-1)
    setEntry({
      load: last?.loadKg ?? active.loadKg ?? 0,
      reps: last?.reps ?? active.repsMax ?? 0,
      rir: last?.rir ?? active.rirTarget ?? 2,
      duration: last?.durationS ?? active.durationS ?? 0,
    })
    // només quan canvia l'exercici actiu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, draft?.id])

  const save = (d: SessionDraft) => {
    setDraft(d)
    db.drafts.put(d)
  }

  const register = () => {
    if (!draft) return
    const n = setsOf(active.id).length
    const isTimed = active.durationS != null
    const log: SetLog = {
      id: crypto.randomUUID(),
      prescriptionId: active.id,
      exerciseId: active.exercise.id,
      setIndex: n + 1,
      loadKg: !isTimed && entry.load > 0 ? entry.load : undefined,
      reps: isTimed ? undefined : entry.reps,
      rir: isTimed ? undefined : entry.rir,
      durationS: isTimed ? entry.duration : undefined,
      completedAt: new Date().toISOString(),
    }
    const next: SessionDraft = { ...draft, sets: [...draft.sets, log] }
    save(next)

    const exerciseDone = n + 1 >= active.sets
    const nextOpen = session.prescriptions.find(
      (p) => next.sets.filter((s) => s.prescriptionId === p.id).length < p.sets,
    )
    if (!nextOpen) return // entrenament complet: sense descans
    const label = exerciseDone ? nextOpen.exercise.name : `${active.exercise.name} · sèrie ${n + 2}`
    if (exerciseDone) setActiveId(nextOpen.id)
    setRest({ endAt: Date.now() + active.restS * 1000, totalS: active.restS, next: label })
  }

  const undo = () => {
    if (!draft) return
    const mine = setsOf(active.id)
    if (!mine.length) return
    const lastId = mine.at(-1)!.id
    save({ ...draft, sets: draft.sets.filter((s) => s.id !== lastId) })
  }

  if (!draft) return <main className="screen" aria-busy="true" />

  const pct = Math.round((doneSets / totalSets) * 100)

  return (
    <main className="screen today">
      <header className="today-head">
        <div>
          <p className="kicker">{today}</p>
          <h1>{session.title}</h1>
          <p className="muted">{session.focus}</p>
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

      {!assessed && (
        <button type="button" className="assess-card" onClick={onAssess}>
          <strong>Fes la valoració inicial</strong>
          <span>Uns minuts de preguntes i tests perquè el pla s’adapti a tu.</span>
        </button>
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
          const isActive = p.id === activeId
          const sug = complete ? suggestNext(p, sets) : null
          const best = Math.max(0, ...mine.map((s) => epley1RM(s.loadKg ?? 0, s.reps ?? 0) ?? 0))
          return (
            <li key={p.id} className={`ex ${isActive ? 'active' : ''} ${complete ? 'complete' : ''}`}>
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
                        {p.durationS != null ? (
                          <Stepper
                            label="Temps"
                            unit="s"
                            value={entry.duration}
                            step={5}
                            onChange={(v) => setEntry({ ...entry, duration: v })}
                          />
                        ) : (
                          <>
                            {p.loadKg != null && (
                              <Stepper
                                label="Càrrega"
                                unit="kg"
                                value={entry.load}
                                step={2.5}
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

                      {p.durationS == null && (
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
                        Registra la sèrie {mine.length + 1}
                      </button>
                    </>
                  )}

                  {complete && (
                    <div className="ex-result">
                      {sug && <p className={`sug ${sug.kind}`}>{sug.text}</p>}
                      {best > 0 && <p className="muted">1RM estimat: {fmtKg(best)} kg</p>}
                    </div>
                  )}

                  {mine.length > 0 && (
                    <button type="button" className="link" onClick={undo}>
                      Desfés l’última sèrie
                    </button>
                  )}
                </div>
              )}
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
