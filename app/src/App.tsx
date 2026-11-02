import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Account } from './components/Account'
import { Assessment } from './components/Assessment'
import { DailyCheck } from './components/DailyCheck'
import { Legal } from './components/Legal'
import { PlanEditor } from './components/PlanEditor'
import { Progress } from './components/Progress'
import { TabBar, type Tab } from './components/TabBar'
import { Onboarding } from './components/Onboarding'
import { Today, type Alternative, type FinishData, type WeekDay } from './components/Today'
import { CONSENT_VERSION } from './config'
import { available, CATALOG } from './data/catalog'
import { db, type DoneRow } from './lib/db'
import { fatigueFlag, reducedSets } from './lib/fatigue'
import { LEVEL_LABEL } from './lib/level'
import { buildManualPlan, templateFromPlan } from './lib/manualPlan'
import { generatePlan } from './lib/generator'
import { adviseLoad, type HistoryEntry } from './lib/loads'
import { epley1RM, fmtKg } from './lib/progression'
import { accountInfo, touchLastSeen, type AccountInfo } from './lib/auth'
import { restoreFromCloud } from './lib/restore'
import { supabase } from './lib/supabase'
import { syncOutbox } from './lib/sync'
import type { AssessmentPayload, DailyStatus, GeneratorInputs, Measurement, Plan, PlannedSession, Prescription, TemplateSession } from './lib/types'

type Stage = 'loading' | 'onboarding' | 'assessment' | 'today' | 'summary' | 'editor'
type Summary = { minutes: number; sets: number; volume: number; best: { name: string; kg: number }[] }

const LOCAL_ALIAS = 'emb.alias'
const LOCAL_AGE = 'emb.age'
const LOCAL_ASSESSMENT = 'emb.assessment'
const LOCAL_SWAPS = 'emb.swaps'

const todayIso = () => new Date().toLocaleDateString('sv-SE')
const byId = new Map(CATALOG.map((e) => [e.id, e]))

function readJson<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback
  } catch {
    return fallback
  }
}

function explain(msg: string) {
  if (/anonymous.*disabled/i.test(msg)) return 'L’inici de sessió anònim no està activat a Supabase.'
  if (/fetch|network/i.test(msg)) return 'Sense connexió. Pots continuar i se sincronitzarà més tard.'
  return msg
}

// Substitueix un exercici per un altre adaptant el tipus de registre
function swapExercise(p: Prescription, toId: string): Prescription {
  const e = byId.get(toId)
  if (!e) return p
  let q: Prescription = { ...p, exercise: { id: e.id, name: e.name, cue: e.cue }, track: e.track }
  if (e.track === 'time' && p.track !== 'time') q = { ...q, durationS: 30, repsMin: undefined, repsMax: undefined, rirTarget: undefined }
  if (e.track !== 'time' && p.track === 'time') q = { ...q, durationS: undefined, repsMin: 8, repsMax: 12, rirTarget: 2 }
  return q
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
  const [plan, setPlan] = useState<Plan | null>(null)
  const [doneRows, setDoneRows] = useState<DoneRow[]>([])
  const done = useMemo(() => new Set(doneRows.map((d) => d.plannedSessionId)), [doneRows])
  const [daily, setDaily] = useState<DailyStatus[]>([])
  const [measurements, setMeasurements] = useState<Measurement[]>([])
  const [dailySkipped, setDailySkipped] = useState(false)
  const [tab, setTab] = useState<Tab>('avui')
  const [showLegal, setShowLegal] = useState(false)
  const [account, setAccount] = useState<AccountInfo | null>(null)
  const [protectDismissed, setProtectDismissed] = useState(() => localStorage.getItem('emb.protectDismissed') === '1')
  const [editorFrom, setEditorFrom] = useState<'new' | 'edit' | 'auto'>('new')
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const [swaps, setSwaps] = useState<Record<string, string>>(() => readJson(LOCAL_SWAPS, {}))
  const [sessionSwaps, setSessionSwaps] = useState<Record<string, string>>({})
  const ageRange = localStorage.getItem(LOCAL_AGE)

  const runSync = useCallback(async () => {
    const r = await syncOutbox()
    setPending(r.pending)
    setSyncError(r.error)
  }, [])

  useEffect(() => {
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      await loadLocal()
      const local = localStorage.getItem(LOCAL_ALIAS)
      if (local) {
        setAlias(local)
        setCloud(!!data.session)
        setStage('today')
        if (data.session) afterSignIn()
      } else if (data.session) {
        // Hi ha sessió però no dades locals: es recuperen del núvol
        try {
          const r = await restoreFromCloud()
          await loadLocal()
          setAlias(r.alias)
          setCloud(true)
          setStage('today')
          afterSignIn()
        } catch {
          setStage('onboarding')
        }
      } else {
        setStage('onboarding')
      }
    })()
    const onOnline = () => runSync()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [runSync])

  // Carrega a l'estat de l'app les dades guardades al mòbil
  async function loadLocal() {
    const [lastPlan, rows, hist, count, dailyRows, meas] = await Promise.all([
      db.plans.orderBy('createdAt').last(),
      db.done.toArray(),
      db.history.toArray(),
      db.outbox.count(),
      db.daily.toArray(),
      db.measurements.toArray(),
    ])
    setPlan(lastPlan ?? null)
    setDoneRows(rows)
    setDaily(dailyRows)
    setMeasurements(meas)
    setHistory(hist)
    setPending(count)
  }

  // Amb sessió al núvol: sincronitza, actualitza la darrera activitat i el tipus de compte
  async function afterSignIn() {
    runSync()
    const info = await accountInfo()
    setAccount(info)
    if (info) touchLastSeen(info.id)
  }

  // Entrada amb correu des d'un altre mòbil: recupera totes les dades del compte
  const onLoggedIn = async () => {
    setStage('loading')
    try {
      const r = await restoreFromCloud()
      await loadLocal()
      setAlias(r.alias)
      setCloud(true)
      setTab('avui')
      setStage('today')
      afterSignIn()
    } catch (e) {
      setError(`No s’han pogut recuperar les dades: ${(e as Error).message}`)
      setStage('onboarding')
    }
  }

  const createAccount = async (name: string, age: string | null): Promise<boolean> => {
    setBusy(true)
    setError(null)
    try {
      const { data, error: e } = await supabase.auth.signInAnonymously()
      if (e || !data.user) throw new Error(e?.message ?? 'No s’ha pogut crear el compte')
      const { error: e2 } = await supabase.from('profiles').upsert({
        user_id: data.user.id,
        alias: name,
        age_range: age,
        consent_version: CONSENT_VERSION,
      })
      if (e2) throw new Error(e2.message)
      localStorage.setItem(LOCAL_ALIAS, name)
      if (age) localStorage.setItem(LOCAL_AGE, age)
      setAlias(name)
      setCloud(true)
      setStage(plan ? 'today' : 'assessment')
      afterSignIn()
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
    setStage(plan ? 'today' : 'assessment')
  }

  const afterLocalSave = async () => {
    if (cloud) runSync()
    else setPending(await db.outbox.count())
  }

  const saveDaily = async (d: DailyStatus) => {
    await db.daily.put(d)
    await db.outbox.put({ id: `daily-${d.day}`, kind: 'daily', payload: d, createdAt: new Date().toISOString() })
    setDaily([...daily.filter((x) => x.day !== d.day), d])
    afterLocalSave()
  }

  const addMeasurement = async (m: { weight_kg?: number; waist_cm?: number; hip_cm?: number }, when?: string) => {
    const row: Measurement = { id: crypto.randomUUID(), measured_at: when ?? new Date().toISOString(), ...m }
    await db.measurements.put(row)
    await db.outbox.put({ id: row.id, kind: 'measurement', payload: row, createdAt: new Date(Date.parse(row.measured_at) + 2).toISOString() })
    setMeasurements((prev) => [...prev, row])
    afterLocalSave()
  }

  const saveAssessment = async (payload: AssessmentPayload, s: { level: string; parqFlag: boolean }) => {
    const takenAt = payload.assessment.taken_at
    await db.outbox.put({ id: payload.assessment.id, kind: 'assessment', payload, createdAt: takenAt })
    localStorage.setItem(LOCAL_ASSESSMENT, JSON.stringify({ level: s.level, parqFlag: s.parqFlag, takenAt }))

    const newPlan = generatePlan({
      level: payload.profile.level as Plan['inputs']['level'],
      goals: payload.goals,
      days: payload.profile.days_per_week,
      minutes: payload.profile.minutes_per_session,
      equipment: payload.profile.equipment,
      ageRange,
      parqFlag: s.parqFlag,
      results: payload.assessment.results,
      startDate: todayIso(),
    })
    await db.plans.put(newPlan)
    // El pla es puja després de la valoració (els objectius han d'existir abans)
    await db.outbox.put({ id: newPlan.id, kind: 'plan', payload: newPlan, createdAt: new Date(Date.parse(takenAt) + 1).toISOString() })
    setPlan(newPlan)
    setSessionSwaps({})
    const r = payload.assessment.results as Record<string, number | undefined>
    if (r.weightKg != null || r.waistCm != null || r.hipCm != null)
      await addMeasurement({ weight_kg: r.weightKg, waist_cm: r.waistCm, hip_cm: r.hipCm }, takenAt)
    setTab('avui')
    setStage('today')
    if (cloud) runSync()
    else setPending(await db.outbox.count())
  }

  // Pla manual: crea'l, edita'l o converteix el pla automàtic
  const openEditor = (from: 'new' | 'edit' | 'auto') => {
    setEditorFrom(from)
    setStage('editor')
    window.scrollTo(0, 0)
  }

  const saveManualPlan = async (r: { template: TemplateSession[]; weeks: number; deloadEvery4: boolean }) => {
    const keep = editorFrom !== 'new' && plan ? { plan, done } : undefined
    const assessed = readJson<{ level?: string; parqFlag?: boolean } | null>('emb.assessment', null)
    const inputs: GeneratorInputs = plan?.inputs ?? {
      level: (assessed?.level as GeneratorInputs['level']) ?? 'principiant',
      goals: [],
      days: r.template.length,
      minutes: 60,
      equipment: ['barra', 'rack', 'banc', 'manuella', 'kettlebell', 'politja', 'barra fixa', 'cardio'],
      ageRange,
      parqFlag: assessed?.parqFlag ?? false,
      startDate: todayIso(),
    }
    const { plan: newPlan, carriedDone } = buildManualPlan({
      template: r.template,
      weeks: r.weeks,
      deloadEvery4: r.deloadEvery4,
      startDate: keep ? keep.plan.startDate : todayIso(),
      inputs,
      previous: keep,
    })
    // Les sessions ja fetes es conserven en el pla nou
    const carried: DoneRow[] = carriedDone.map(({ oldId, newId }) => {
      const old = doneRows.find((d) => d.plannedSessionId === oldId)!
      return { ...old, plannedSessionId: newId }
    })
    await db.plans.put(newPlan)
    if (carried.length) await db.done.bulkPut(carried)
    await db.outbox.put({ id: newPlan.id, kind: 'plan', payload: newPlan, createdAt: new Date().toISOString() })
    setPlan(newPlan)
    setDoneRows([...doneRows, ...carried])
    setSessionSwaps({})
    setTab('avui')
    setStage('today')
    afterLocalSave()
  }

  // Sessió que toca: la primera del pla que encara no s'ha fet
  const next = useMemo(
    () => (plan ? [...plan.sessions].sort((a, b) => a.order - b.order).find((s) => !done.has(s.id)) ?? null : null),
    [plan, done],
  )

  // Regla R05: fatiga acumulada segons l'estat diari i l'esforç de les últimes sessions
  const fatigue = useMemo(() => {
    const rpes = [...doneRows].sort((a, b) => a.date.localeCompare(b.date)).map((d) => d.rpe)
    return fatigueFlag(daily, rpes, todayIso())
  }, [daily, doneRows])

  // Aplica substitucions d'exercicis, reducció per fatiga i càrregues suggerides
  const prepared = useMemo((): { session: PlannedSession; advice: Record<string, string> } | null => {
    if (!next || !plan) return null
    const reduce = !!fatigue && !next.deload
    const advice: Record<string, string> = {}
    const prescriptions = next.prescriptions.map((p0) => {
      let p = p0
      let guard = 0
      while (swaps[p.exercise.id] && guard++ < 5) p = swapExercise(p, swaps[p.exercise.id])
      if (sessionSwaps[p0.id]) p = swapExercise(p, sessionSwaps[p0.id])
      if (reduce && p.block === 'principal') p = { ...p, sets: reducedSets(p.sets) }
      const a = adviseLoad(p, history, { beginner: plan.inputs.level === 'principiant', deload: next.deload })
      if (a) {
        advice[p.id] = a.reason
        p = { ...p, loadKg: a.loadKg }
      } else if (p.track === 'load_reps') {
        // Sense historial: barra buida, o una càrrega lleugera de manuella o màquina
        const needs = byId.get(p.exercise.id)?.needs ?? []
        p = { ...p, startKg: needs.includes('barra') ? 20 : needs.includes('politja') ? 15 : 6 }
      }
      return p
    })
    return { session: { ...next, prescriptions }, advice }
  }, [next, plan, swaps, sessionSwaps, history, fatigue])

  const week: WeekDay[] = useMemo(() => {
    if (!plan || !next) return []
    return plan.sessions
      .filter((s) => s.week === next.week)
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ id: s.id, date: s.date, title: s.title, state: done.has(s.id) ? 'fet' : s.id === next.id ? 'actual' : 'pendent' }))
  }, [plan, next, done])

  const alternatives = useCallback(
    (p: Prescription): Alternative[] => {
      const cur = byId.get(p.exercise.id)
      if (!cur || !plan) return []
      return CATALOG.filter(
        (e) =>
          e.id !== cur.id &&
          e.modality === cur.modality &&
          (cur.modality === 'forca' || cur.modality === 'cardio' ? e.pattern === cur.pattern : true) &&
          (e.target === 'equilibri') === (cur.target === 'equilibri') &&
          available(e, plan.inputs.equipment, plan.inputs.level),
      ).map((e) => ({ id: e.id, name: e.name }))
    },
    [plan],
  )

  const onSwap = (p: Prescription, toId: string, permanent: boolean) => {
    if (permanent) {
      const nextSwaps = { ...swaps, [p.exercise.id]: toId }
      delete nextSwaps[toId] // evita cicles
      setSwaps(nextSwaps)
      localStorage.setItem(LOCAL_SWAPS, JSON.stringify(nextSwaps))
    } else {
      setSessionSwaps({ ...sessionSwaps, [p.id]: toId })
    }
  }

  const finish = async ({ draft, sessionRpe, feeling, notes }: FinishData) => {
    if (!prepared) return
    const s = prepared.session
    const ended = new Date()
    await db.outbox.put({
      id: draft.id,
      kind: 'session',
      createdAt: ended.toISOString(),
      payload: {
        session: {
          id: draft.id,
          planned_session_id: s.id,
          started_at: draft.startedAt,
          ended_at: ended.toISOString(),
          session_rpe: sessionRpe,
          feeling,
          notes,
        },
        sets: draft.sets,
      },
    })
    const rxById = new Map(s.prescriptions.map((p) => [p.id, p]))
    const entries: HistoryEntry[] = draft.sets.map((x) => {
      const p = rxById.get(x.prescriptionId)
      return {
        id: x.id,
        exerciseId: x.exerciseId,
        sessionLogId: draft.id,
        date: x.completedAt,
        deload: s.deload,
        repsMin: p?.repsMin,
        repsMax: p?.repsMax,
        rirTarget: p?.rirTarget,
        loadKg: x.loadKg,
        reps: x.reps,
        rir: x.rir,
        durationS: x.durationS,
      }
    })
    await db.history.bulkPut(entries)
    const doneRow: DoneRow = { plannedSessionId: s.id, sessionLogId: draft.id, date: ended.toISOString(), rpe: sessionRpe }
    await db.done.put(doneRow)
    await db.drafts.delete(draft.id)
    setHistory([...history, ...entries])
    setDoneRows([...doneRows, doneRow])
    setSessionSwaps({})

    const byEx = new Map<string, number>()
    for (const x of draft.sets) {
      const e = epley1RM(x.loadKg ?? 0, x.reps ?? 0)
      if (e) byEx.set(x.exerciseId, Math.max(byEx.get(x.exerciseId) ?? 0, e))
    }
    setSummary({
      minutes: Math.max(1, Math.round((ended.getTime() - Date.parse(draft.startedAt)) / 60000)),
      sets: draft.sets.length,
      volume: Math.round(draft.sets.reduce((a, x) => a + (x.loadKg ?? 0) * (x.reps ?? 0), 0)),
      best: [...byEx].map(([id, kg]) => ({ name: byId.get(id)?.name ?? '', kg })),
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

  const activateCloud = cloud
    ? undefined
    : () =>
        createAccount(alias, ageRange).then((ok) => {
          if (!ok) alert('Encara no s’ha pogut activar el núvol. Les dades es mantenen al mòbil.')
        })

  if (stage === 'loading') return <main className="screen" aria-busy="true" />

  if (stage === 'assessment')
    return <Assessment ageRange={ageRange} onCancel={() => setStage('today')} onSave={saveAssessment} />

  const legal = showLegal ? <Legal onBack={() => setShowLegal(false)} /> : null

  if (stage === 'editor') {
    const currentWeek = next?.week ?? 1
    const initial: TemplateSession[] =
      editorFrom === 'new' || !plan
        ? [{ id: crypto.randomUUID(), title: 'Sessió 1', weekday: 0, items: [] }]
        : templateFromPlan(plan, currentWeek)
    return (
      <PlanEditor
        initial={initial}
        initialWeeks={editorFrom === 'new' || !plan ? 8 : plan.weeks}
        initialDeload={editorFrom === 'edit' ? (plan?.deloadEvery4 ?? true) : true}
        editing={editorFrom !== 'new'}
        fromAutomatic={editorFrom === 'auto'}
        onCancel={() => setStage('today')}
        onSave={saveManualPlan}
      />
    )
  }

  if (stage === 'onboarding')
    return (
      <>
        <Onboarding busy={busy} error={error} onSubmit={createAccount} onOffline={goOffline} onShowLegal={() => setShowLegal(true)} onLoggedIn={onLoggedIn} />
        {legal}
      </>
    )

  if (stage === 'summary' && summary)
    return (
      <main className="screen summary">
        <h1>Bona feina, {alias}!</h1>
        <p className="muted">L’entrenament s’ha desat.</p>
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
        {next && <p className="muted center">Propera sessió: {next.title}</p>}
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

  const protectCard =
    account?.isAnonymous && doneRows.length > 0 && !protectDismissed ? (
      <section className="protect-note">
        <p>
          <strong>El teu compte només existeix en aquest mòbil.</strong> Vincula-hi un correu per no perdre l’historial si
          canvies de mòbil o esborres les dades.
        </p>
        <div className="overlay-actions">
          <button
            type="button"
            className="btn ghost"
            onClick={() => (localStorage.setItem('emb.protectDismissed', '1'), setProtectDismissed(true))}
          >
            Ara no
          </button>
          <button type="button" className="btn primary" onClick={() => (setTab('compte'), window.scrollTo(0, 0))}>
            Vincula un correu
          </button>
        </div>
      </section>
    ) : null

  const dailyCard =
    !dailySkipped && !daily.some((d) => d.day === todayIso()) ? (
      <DailyCheck day={todayIso()} onSave={saveDaily} onSkip={() => setDailySkipped(true)} />
    ) : null

  let screen: ReactNode
  if (tab === 'progres') {
    screen = <Progress plan={plan} done={doneRows} history={history} measurements={measurements} onAddMeasurement={addMeasurement} />
  } else if (tab === 'compte') {
    screen = (
      <Account
        alias={alias}
        cloud={cloud}
        syncLabel={syncLabel}
        pending={pending}
        syncError={syncError}
        levelLabel={plan ? LEVEL_LABEL[plan.inputs.level] : null}
        onRetrySync={runSync}
        onActivateCloud={activateCloud}
        onReassess={() => setStage('assessment')}
        planMode={plan ? (plan.mode ?? 'automatic') : null}
        onEditPlan={() => openEditor(plan?.mode === 'manual' ? 'edit' : 'auto')}
        onNewPlan={() => openEditor('new')}
        onShowLegal={() => setShowLegal(true)}
        account={account}
        onLinked={async () => setAccount(await accountInfo())}
      />
    )
  } else if (!plan || !prepared) {
    screen = (
      <main className="screen today">
        <header className="today-head">
          <div>
            <h1>Hola, {alias}</h1>
          </div>
          <div className="head-side">
            {activateCloud ? (
              <button type="button" className="sync-chip action" onClick={activateCloud}>
                {syncLabel} · Activa el núvol
              </button>
            ) : (
              <span className="sync-chip">{syncLabel}</span>
            )}
          </div>
        </header>
        <button type="button" className="assess-card" onClick={() => setStage('assessment')}>
          <strong>{plan ? `Has completat el pla de ${plan.weeks} setmanes!` : 'Fes la valoració inicial'}</strong>
          <span>
            {plan
              ? 'Repeteix la valoració per veure el teu progrés i generar el pla següent.'
              : 'Uns minuts de preguntes i tests per generar el teu pla de 12 setmanes.'}
          </span>
        </button>
        <button type="button" className="btn ghost block" onClick={() => openEditor('new')}>
          {plan ? 'O crea un pla manual' : 'O crea el teu propi pla'}
        </button>
      </main>
    )
  } else {
    screen = (
      <Today
        key={prepared.session.id}
        session={prepared.session}
        advice={prepared.advice}
        week={week}
        alias={alias}
        syncLabel={syncLabel}
        onChipClick={activateCloud}
        alternatives={alternatives}
        onSwap={onSwap}
        onFinish={finish}
        topSlot={
          <>
            {protectCard}
            {dailyCard}
          </>
        }
        lane={{ weeks: plan.weeks, deloadWeeks: [...new Set(plan.sessions.filter((x) => x.deload).map((x) => x.week))] }}
        notice={fatigue && !prepared.session.deload ? `${fatigue}: avui farem un 25 % menys de sèries a la part principal.` : null}
      />
    )
  }

  return (
    <>
      {screen}
      <TabBar tab={tab} onChange={(t) => (setTab(t), window.scrollTo(0, 0))} />
      {legal}
    </>
  )
}
