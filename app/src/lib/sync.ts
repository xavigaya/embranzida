import { db } from './db'
import { supabase } from './supabase'

let syncing = false

// Puja al núvol els entrenaments pendents. Idempotent: fa servir upsert
// amb els UUID generats al mòbil, de manera que repetir-ho no duplica res.
export async function syncOutbox(): Promise<{ pending: number; error?: string }> {
  if (syncing) return { pending: await db.outbox.count() }
  syncing = true
  try {
    if (!navigator.onLine) return { pending: await db.outbox.count() }
    const { data: auth } = await supabase.auth.getUser()
    const userId = auth.user?.id
    if (!userId) return { pending: await db.outbox.count(), error: 'Sense sessió iniciada' }

    const items = await db.outbox.orderBy('createdAt').toArray()
    for (const item of items) {
      const s = item.payload.session
      const { error: e1 } = await supabase
        .from('session_logs')
        .upsert({ ...s, user_id: userId, planned_session_id: null })
      if (e1) {
        await db.outbox.update(item.id, { lastError: e1.message })
        return { pending: items.length, error: e1.message }
      }
      const rows = item.payload.sets.map((x) => ({
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
        if (e2) {
          await db.outbox.update(item.id, { lastError: e2.message })
          return { pending: items.length, error: e2.message }
        }
      }
      await db.outbox.delete(item.id)
    }
    return { pending: 0 }
  } finally {
    syncing = false
  }
}
