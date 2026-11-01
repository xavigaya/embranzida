import { db } from './db'
import { supabase } from './supabase'
import type { AssessmentPayload, DailyStatus, Measurement, OutboxItem, Plan, SessionPayload } from './types'

const isUuid = (v?: string | null) => !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
const chunks = <T,>(a: T[], n = 200) => Array.from({ length: Math.ceil(a.length / n) }, (_, k) => a.slice(k * n, k * n + n))

let syncing = false

async function pushSession(userId: string, p: SessionPayload) {
  const s = p.session
  const { error: e1 } = await supabase
    .from('session_logs')
    .upsert({ ...s, user_id: userId, planned_session_id: isUuid(s.planned_session_id) ? s.planned_session_id : null })
  if (e1) return e1.message
  const rows = p.sets.map((x) => ({
    id: x.id,
    session_log_id: s.id,
    user_id: userId,
    exercise_id: x.exerciseId,
    prescription_id: isUuid(x.prescriptionId) ? x.prescriptionId : null,
    set_index: x.setIndex,
    load_kg: x.loadKg ?? null,
    reps: x.reps ?? null,
    rir: x.rir ?? null,
    duration_s: x.durationS ?? null,
    completed_at: x.completedAt,
  }))
  if (rows.length) {
    const { error: e2 } = await supabase.from('set_logs').upsert(rows)
    if (e2) return e2.message
  }
  return null
}

async function pushAssessment(userId: string, p: AssessmentPayload) {
  const { error: e1 } = await supabase.from('profiles').update(p.profile).eq('user_id', userId)
  if (e1) return e1.message
  // Els objectius nous substitueixen els anteriors
  const { error: e2 } = await supabase
    .from('goals')
    .update({ active: false })
    .eq('user_id', userId)
    .not('id', 'in', `(${p.goals.map((g) => g.id).join(',')})`)
  if (e2) return e2.message
  const { error: e3 } = await supabase
    .from('goals')
    .upsert(p.goals.map((g) => ({ ...g, user_id: userId, active: true })))
  if (e3) return e3.message
  const { error: e4 } = await supabase.from('assessments').upsert({ ...p.assessment, user_id: userId })
  if (e4) return e4.message
  return null
}

async function pushPlan(userId: string, plan: Plan) {
  // Només un pla actiu per usuari: arxiva els anteriors
  const { error: e0 } = await supabase
    .from('plans')
    .update({ status: 'arxivat' })
    .eq('user_id', userId)
    .eq('status', 'actiu')
    .neq('id', plan.id)
  if (e0) return e0.message
  const { error: e1 } = await supabase.from('plans').upsert({
    id: plan.id,
    user_id: userId,
    name: 'Pla de 12 setmanes',
    mode: 'automatic',
    status: 'actiu',
    start_date: plan.startDate,
    weeks: plan.weeks,
    generator: { version: 1, inputs: plan.inputs },
  })
  if (e1) return e1.message
  const goals = plan.inputs.goals.filter((g) => isUuid(g.id))
  if (goals.length) {
    const others = Math.max(1, goals.length - 1)
    const { error } = await supabase.from('plan_goals').upsert(
      goals.map((g) => ({
        plan_id: plan.id,
        goal_id: g.id,
        user_id: userId,
        weight: goals.length === 1 ? 1 : g.priority === 1 ? 0.6 : Math.round((0.4 / others) * 100) / 100,
      })),
    )
    if (error) return error.message
  }
  const { error: e2 } = await supabase
    .from('mesocycles')
    .upsert(plan.mesocycles.map((m) => ({ id: m.id, plan_id: plan.id, user_id: userId, position: m.position, phase: m.phase, weeks: m.weeks })))
  if (e2) return e2.message
  const mesoId = (n: number) => plan.mesocycles[n - 1].id
  for (const c of chunks(plan.sessions)) {
    const { error } = await supabase.from('planned_sessions').upsert(
      c.map((s) => ({
        id: s.id,
        mesocycle_id: mesoId(s.mesocycle),
        user_id: userId,
        week: s.week,
        day_of_week: ((new Date(`${s.date}T00:00:00Z`).getUTCDay() + 6) % 7) + 1,
        scheduled_date: s.date,
        kind: s.kind,
        title: s.title,
      })),
    )
    if (error) return error.message
  }
  const rows = plan.sessions.flatMap((s) =>
    s.prescriptions.map((p, k) => ({
      id: p.id,
      planned_session_id: s.id,
      user_id: userId,
      exercise_id: p.exercise.id,
      position: k + 1,
      sets: p.sets,
      reps_min: p.repsMin ?? null,
      reps_max: p.repsMax ?? null,
      rir_target: p.rirTarget ?? null,
      rest_s: Math.min(900, p.restS),
      duration_s: p.durationS ?? null,
      hr_zone: p.hrZone ?? null,
      notes: [p.block, p.note].filter(Boolean).join(' · '),
    })),
  )
  for (const c of chunks(rows)) {
    const { error } = await supabase.from('prescriptions').upsert(c)
    if (error) return error.message
  }
  return null
}

async function pushDaily(userId: string, d: DailyStatus) {
  const { error } = await supabase.from('daily_status').upsert({ ...d, user_id: userId })
  return error?.message ?? null
}

async function pushMeasurement(userId: string, m: Measurement) {
  const { error } = await supabase.from('body_measurements').upsert({ ...m, user_id: userId })
  return error?.message ?? null
}

// Puja al núvol tot el que hi ha pendent. Idempotent: fa servir upsert
// amb els UUID generats al mòbil, de manera que repetir-ho no duplica res.
export async function syncOutbox(): Promise<{ pending: number; error?: string }> {
  if (syncing) return { pending: await db.outbox.count() }
  syncing = true
  try {
    if (!navigator.onLine) return { pending: await db.outbox.count() }
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id
    if (!userId) return { pending: await db.outbox.count(), error: 'Sense sessió iniciada' }

    const items: OutboxItem[] = await db.outbox.orderBy('createdAt').toArray()
    for (const item of items) {
      const err =
        item.kind === 'assessment'
          ? await pushAssessment(userId, item.payload)
          : item.kind === 'plan'
            ? await pushPlan(userId, item.payload)
            : item.kind === 'daily'
              ? await pushDaily(userId, item.payload)
              : item.kind === 'measurement'
                ? await pushMeasurement(userId, item.payload)
                : await pushSession(userId, item.payload)
      if (err) {
        await db.outbox.update(item.id, { lastError: err })
        return { pending: items.length, error: err }
      }
      await db.outbox.delete(item.id)
    }
    return { pending: 0 }
  } finally {
    syncing = false
  }
}
