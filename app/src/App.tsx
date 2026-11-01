import { useCallback, useEffect, useState } from 'react'
import { Assessment } from './components/Assessment'
import { Onboarding } from './components/Onboarding'
import { Today, type FinishData } from './components/Today'
import { CONSENT_VERSION } from './config'
import { demoSession } from './data/demoSession'
import { db } from './lib/db'
import { epley1RM, fmtKg } from './lib/progression'
import { supabase } from './lib/supabase'
import { syncOutbox } from './lib/sync'
import type { AssessmentPayload } from './lib/types'

type Stage = 'loading' | 'onboarding' | 'assessment' | 'today' | 'summary'
type LocalAssessment = { level: string; parqFlag: boolean; takenAt: string }
type Summary = { minutes: number; sets: number; volume: number; best: { name: string; kg: number }[] }

const LOCAL_ALIAS = 'emb.alias'
const LOCAL_AGE = 'emb.age'
const LOCAL_ASSESSMENT = 'emb.assessment'

function readAssessment(): LocalAssessment | null {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_ASSESSMENT) ?? 'null')
  } catch {
    return null
  }
}

function explain(msg: string) {
  if (/anonymous.*disabled/i.test(msg)) return 'L’inici de sessió anònim no està activat a Supabase.'
  if (/fetch|network/i.test(msg)) return 'Sense connexió. Pots continuar i se sincronitzarà més tard.'
  return msg
}

export default function App() {
  const [stage, setStage] = useState<Stage>('loading')
  const [alias, setAlias] = useState('')
  const [cloud, setCloud] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(0)
  const [syncError, setSyncError] = useState<string | undefined>()
  const [summary, setSummary] = useState<Summary | null>(null)
  const [assessment, setAssessment] = useState<LocalAssessment | null>(readAssessment)
  const ageRange = localStorage.getItem(LOCAL_AGE)

  const runSync = useCallback(async () => {
    const r = await syncOutbox()
    setPending(r.pending)
    setSyncError(r.error)
  }, [])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const local = localStorage.getItem(LOCAL_ALIAS)
      setPending(await db.outbox.count())
      if (data.session && local) {
        setCloud(true)
        setAlias(local)
        setStage('today')
        runSync()
      } else if (local) {
        setAlias(local)
        setStage('today')
      } else {
        setStage('onboarding')
      }
    })()
    const onOnline = () => runSync()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [runSync])

  const createAccount = async (name: string, ageRange: string | null): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      const { data, error: e } = await supabase.auth.signInAnonymously()
      if (e || !data.user) throw new Error(e?.message ?? 'No s’ha pogut crear el compte')
      const { error: e2 } = await supabase.from('profiles').upsert({
        user_id: data.user.id,
        alias: name,
        age_range: ageRange,
        consent_version: CONSENT_VERSION,
      })
      if (e2) throw new Error(e2.message)
      localStorage.setItem(LOCAL_ALIAS, name)
      if (ageRange) localStorage.setItem(LOCAL_AGE, ageRange)
      setAlias(name)
      setCloud(true)
      setStage(readAssessment() ? 'today' : 'assessment')
      runSync()
      return true
    } catch (err) {
      setError(explain((err as Error).message))
      return false
    } finally {
      setBusy(false)
    }
  }

  const goOffline = (name: string, age: string | null) => {
    localStorage.setItem(LOCAL_ALIAS, name)
    if (age) localStorage.setItem(LOCAL_AGE, age)
    setAlias(name)
    setCloud(false)
    setStage(readAssessment() ? 'today' : 'assessment')
  }

  const saveAssessment = async (payload: AssessmentPayload, s: { level: string; parqFlag: boolean }) => {
    await db.outbox.put({ id: payload.assessment.id, kind: 'assessment', payload, createdAt: payload.assessment.taken_at })
    const local: LocalAssessment = { level: s.level, parqFlag: s.parqFlag, takenAt: payload.assessment.taken_at }
    localStorage.setItem(LOCAL_ASSESSMENT, JSON.stringify(local))
    setAssessment(local)
    setStage('today')
    if (cloud) runSync()
    else setPending(await db.outbox.count())
  }

  const finish = async ({ draft, sessionRpe, feeling, notes }: FinishData) => {
    const ended = new Date()
    await db.outbox.put({
      id: draft.id,
      kind: 'session',
      createdAt: ended.toISOString(),
      payload: {
        session: {
          id: draft.id,
          started_at: draft.startedAt,
          ended_at: ended.toISOString(),
          session_rpe: sessionRpe,
          feeling,
          notes,
        },
        sets: draft.sets,
      },
    })
    await db.drafts.delete(draft.id)

    const byEx = new Map<string, number>()
    for (const s of draft.sets) {
      const e = epley1RM(s.loadKg ?? 0, s.reps ?? 0)
      if (e) byEx.set(s.exerciseId, Math.max(byEx.get(s.exerciseId) ?? 0, e))
    }
    setSummary({
      minutes: Math.max(1, Math.round((ended.getTime() - Date.parse(draft.startedAt)) / 60000)),
      sets: draft.sets.length,
      volume: Math.round(draft.sets.reduce((a, s) => a + (s.loadKg ?? 0) * (s.reps ?? 0), 0)),
      best: demoSession.prescriptions
        .filter((p) => byEx.has(p.exercise.id))
        .map((p) => ({ name: p.exercise.name, kg: byEx.get(p.exercise.id)! })),
    })
    setStage('summary')
    if (cloud) runSync()
    else setPending(await db.outbox.count())
  }

  const syncLabel = !cloud
    ? 'Només al mòbil'
    : pending > 0
      ? syncError
        ? 'Error de sincronització'
        : `${pending} pendent${pending > 1 ? 's' : ''}`
      : 'Sincronitzat'

  if (stage === 'loading') return <main className="screen" aria-busy="true" />

  if (stage === 'assessment')
    return <Assessment ageRange={ageRange} onCancel={() => setStage('today')} onSave={saveAssessment} />

  if (stage === 'onboarding')
    return <Onboarding busy={busy} error={error} onSubmit={createAccount} onOffline={goOffline} />

  if (stage === 'summary' && summary)
    return (
      <main className="screen summary">
        <p className="kicker">Entrenament desat</p>
        <h1>Bona feina, {alias}!</h1>
        <dl className="stats">
          <div>
            <dt>Durada</dt>
            <dd>
              {summary.minutes}
              <small>min</small>
            </dd>
          </div>
          <div>
            <dt>Sèries</dt>
            <dd>{summary.sets}</dd>
          </div>
          <div>
            <dt>Volum</dt>
            <dd>
              {summary.volume.toLocaleString('ca')}
              <small>kg</small>
            </dd>
          </div>
        </dl>
        {summary.best.length > 0 && (
          <section className="card">
            <h2>1RM estimat</h2>
            <ul className="best">
              {summary.best.map((b) => (
                <li key={b.name}>
                  <span>{b.name}</span>
                  <strong>{fmtKg(b.kg)} kg</strong>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="muted center">
          {cloud
            ? pending > 0
              ? 'Es pujarà al núvol quan hi hagi connexió.'
              : 'Desat al núvol.'
            : 'Desat al mòbil. Es pujarà quan activis el compte al núvol.'}
        </p>
        <button type="button" className="btn primary block" onClick={() => setStage('today')}>
          Torna a l’inici
        </button>
      </main>
    )

  return (
    <Today
      key={summary ? 'after' : 'first'}
      session={demoSession}
      alias={alias}
      syncLabel={syncLabel}
      assessed={assessment !== null}
      onAssess={() => setStage('assessment')}
      onChipClick={
        cloud
          ? undefined
          : () =>
              createAccount(alias, ageRange).then((ok) => {
                if (!ok) alert('Encara no s’ha pogut activar el núvol. Les dades es mantenen al mòbil.')
              })
      }
      onFinish={finish}
    />
  )
}
