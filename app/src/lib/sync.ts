import { db } from './db'
import { supabase } from './supabase'
import type { AssessmentPayload, OutboxItem, SessionPayload } from './types'

let syncing = false

async function pushSession(userId: string, p: SessionPayload) {
  const s = p.session
  const { error: e1 } = await supabase.from('session_logs').upsert({ ...s, user_id: userId, planned_session_id: null })
  if (e1) return e1.message
  const rows = p.sets.map((x) => ({
    id: x.id,
    session_log_id: s.id,
    user_id: userId,
    exercise_id: x.exerciseId,
    prescription_id: null,
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
        item.kind === 'assessment' ? await pushAssessment(userId, item.payload) : await pushSession(userId, item.payload)
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
