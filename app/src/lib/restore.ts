import { CATALOG } from '../data/catalog'
import { db, type DoneRow } from './db'
import type { HistoryEntry } from './loads'
import { supabase } from './supabase'
import type { Block, DailyStatus, GeneratorInputs, Measurement, Plan, PlannedSession, Prescription } from './types'

// =====================================================================
// Recupera al mòbil les dades d'un compte que ja existeix al núvol
// (en entrar amb el correu des d'un altre mòbil, o si s'han perdut les
// dades locals però la sessió continua activa).
// =====================================================================

const byId = new Map(CATALOG.map((e) => [e.id, e]))
const BLOCKS: Block[] = ['escalfament', 'principal', 'calma']
const chunks = <T,>(a: T[], n = 50) => Array.from({ length: Math.ceil(a.length / n) }, (_, k) => a.slice(k * n, k * n + n))

type Row = Record<string, unknown>

async function all(table: string, select = '*', filter?: (q: ReturnType<typeof base>) => ReturnType<typeof base>) {
  const out: Row[] = []
  for (let from = 0; ; from += 1000) {
    let q = base(table, select)
    if (filter) q = filter(q)
    const { data, error } = await q.range(from, from + 999)
    if (error) throw new Error(error.message)
    out.push(...((data ?? []) as unknown as Row[]))
    if (!data || data.length < 1000) return out
  }
}
const base = (table: string, select: string) => supabase.from(table).select(select)

async function inChunks(table: string, column: string, ids: string[]) {
  const out: Row[] = []
  for (const c of chunks(ids)) out.push(...(await all(table, '*', (q) => q.in(column, c))))
  return out
}

const num = (v: unknown) => (v == null ? undefined : Number(v))

export type RestoreResult = { alias: string; ageRange: string | null; hasPlan: boolean }

export async function restoreFromCloud(): Promise<RestoreResult> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Sense sessió')

  const [profile] = await all('profiles')
  if (!profile) throw new Error('Aquest compte no té perfil')
  const assessments = (await all('assessments')).sort((a, b) => String(b.taken_at).localeCompare(String(a.taken_at)))
  const goals = (await all('goals')).filter((g) => g.active && !g.deleted_at)

  // --- Pla actiu ---
  const [planRow] = await all('plans', '*', (q) => q.eq('status', 'actiu'))
  let plan: Plan | null = null
  if (planRow) {
    const gen = (planRow.generator ?? {}) as { inputs?: GeneratorInputs; template?: Plan['template']; deloadEvery4?: boolean }
    const manual = planRow.mode === 'manual'
    const weeks = Number(planRow.weeks)
    const mesos = (await all('mesocycles', '*', (q) => q.eq('plan_id', planRow.id as string))).sort(
      (a, b) => Number(a.position) - Number(b.position),
    )
    const mesoPos = new Map(mesos.map((m) => [m.id as string, Number(m.position)]))
    const sessRows = (await inChunks('planned_sessions', 'mesocycle_id', mesos.map((m) => m.id as string))).sort((a, b) =>
      String(a.scheduled_date).localeCompare(String(b.scheduled_date)),
    )
    const rxRows = await inChunks('prescriptions', 'planned_session_id', sessRows.map((s) => s.id as string))
    const rxBySession = new Map<string, Row[]>()
    for (const r of rxRows) (rxBySession.get(r.planned_session_id as string) ?? rxBySession.set(r.planned_session_id as string, []).get(r.planned_session_id as string)!).push(r)

    const sessions: PlannedSession[] = sessRows.map((s, order) => {
      const week = Number(s.week)
      const meso = mesoPos.get(s.mesocycle_id as string) ?? Math.ceil(week / 4)
      const deload = (manual ? !!gen.deloadEvery4 : true) && week % 4 === 0
      const prescriptions: Prescription[] = (rxBySession.get(s.id as string) ?? [])
        .sort((a, b) => Number(a.position) - Number(b.position))
        .map((r) => {
          const e = byId.get(r.exercise_id as string)
          const [blk, ...rest] = String(r.notes ?? '').split(' · ')
          return {
            id: r.id as string,
            exercise: { id: r.exercise_id as string, name: e?.name ?? 'Exercici', cue: e?.cue ?? '' },
            block: (BLOCKS as string[]).includes(blk) ? (blk as Block) : 'principal',
            track: e?.track ?? 'load_reps',
            sets: Number(r.sets ?? 1),
            repsMin: num(r.reps_min),
            repsMax: num(r.reps_max),
            rirTarget: num(r.rir_target),
            restS: Number(r.rest_s ?? 60),
            durationS: num(r.duration_s),
            hrZone: num(r.hr_zone),
            note: rest.join(' · ') || undefined,
          }
        })
      return {
        id: s.id as string,
        title: s.title as string,
        kind: s.kind as PlannedSession['kind'],
        focus: `Setmana ${week} de ${weeks} · ${deload ? 'descàrrega' : manual ? 'pla manual' : `mesocicle ${meso}`}`,
        prescriptions,
        week,
        mesocycle: meso,
        deload,
        date: s.scheduled_date as string,
        order,
      }
    })

    const latest = assessments[0]
    const inputs: GeneratorInputs = gen.inputs ?? {
      level: (profile.level as GeneratorInputs['level']) ?? 'principiant',
      goals: goals.map((g) => ({ id: g.id as string, type: g.type as GeneratorInputs['goals'][number]['type'], priority: Number(g.priority) })),
      days: Number(profile.days_per_week ?? 3),
      minutes: Number(profile.minutes_per_session ?? 60),
      equipment: (profile.equipment as string[]) ?? [],
      ageRange: (profile.age_range as string) ?? null,
      parqFlag: !!latest?.parq_flag,
      results: (latest?.results as Record<string, unknown>) ?? undefined,
      startDate: planRow.start_date as string,
    }
    plan = {
      id: planRow.id as string,
      createdAt: planRow.created_at as string,
      startDate: planRow.start_date as string,
      weeks,
      mode: manual ? 'manual' : 'automatic',
      template: manual ? gen.template : undefined,
      deloadEvery4: manual ? gen.deloadEvery4 : undefined,
      inputs,
      mesocycles: mesos.map((m) => ({ id: m.id as string, position: Number(m.position), phase: m.phase as Plan['mesocycles'][number]['phase'], weeks: Number(m.weeks) })),
      sessions,
    }
  }

  // --- Entrenaments fets i historial de sèries ---
  const logs = await all('session_logs')
  const sessionById = new Map((plan?.sessions ?? []).map((s) => [s.id, s]))
  const rxById = new Map((plan?.sessions ?? []).flatMap((s) => s.prescriptions.map((p) => [p.id, p] as const)))
  const logById = new Map(logs.map((l) => [l.id as string, l]))
  const done: DoneRow[] = logs
    .filter((l) => l.planned_session_id && sessionById.has(l.planned_session_id as string))
    .map((l) => ({
      plannedSessionId: l.planned_session_id as string,
      sessionLogId: l.id as string,
      date: (l.ended_at ?? l.started_at) as string,
      rpe: num(l.session_rpe) ?? null,
    }))
  const history: HistoryEntry[] = (await all('set_logs')).map((x) => {
    const log = logById.get(x.session_log_id as string)
    const rx = rxById.get(x.prescription_id as string)
    return {
      id: x.id as string,
      exerciseId: x.exercise_id as string,
      sessionLogId: x.session_log_id as string,
      date: x.completed_at as string,
      deload: !!sessionById.get(log?.planned_session_id as string)?.deload,
      repsMin: rx?.repsMin,
      repsMax: rx?.repsMax,
      rirTarget: rx?.rirTarget,
      loadKg: num(x.load_kg),
      reps: num(x.reps),
      rir: num(x.rir),
      durationS: num(x.duration_s),
    }
  })
  const daily: DailyStatus[] = (await all('daily_status')).map((d) => ({
    day: d.day as string,
    sleep: Number(d.sleep),
    fatigue: Number(d.fatigue),
    soreness: Number(d.soreness),
    mood: Number(d.mood),
  }))
  const measurements: Measurement[] = (await all('body_measurements')).map((m) => ({
    id: m.id as string,
    measured_at: m.measured_at as string,
    weight_kg: num(m.weight_kg) ?? null,
    waist_cm: num(m.waist_cm) ?? null,
    hip_cm: num(m.hip_cm) ?? null,
  }))

  // --- Escriu-ho tot al mòbil ---
  await db.transaction('rw', [db.plans, db.done, db.history, db.daily, db.measurements], async () => {
    await Promise.all([db.plans.clear(), db.done.clear(), db.history.clear(), db.daily.clear(), db.measurements.clear()])
    if (plan) await db.plans.put(plan)
    await db.done.bulkPut(done)
    await db.history.bulkPut(history)
    await db.daily.bulkPut(daily)
    await db.measurements.bulkPut(measurements)
  })
  const alias = profile.alias as string
  const ageRange = (profile.age_range as string) ?? null
  localStorage.setItem('emb.alias', alias)
  if (ageRange) localStorage.setItem('emb.age', ageRange)
  if (assessments[0])
    localStorage.setItem(
      'emb.assessment',
      JSON.stringify({ level: profile.level, parqFlag: !!assessments[0].parq_flag, takenAt: assessments[0].taken_at }),
    )
  return { alias, ageRange, hasPlan: !!plan }
}
