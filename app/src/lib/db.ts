import Dexie, { type Table } from 'dexie'
import type { HistoryEntry } from './loads'
import type { DailyStatus, Measurement, OutboxItem, Plan, SessionDraft } from './types'

// Base de dades local del mòbil (IndexedDB).
// - drafts: l'entrenament en curs, perquè no es perdi si es tanca l'app
// - outbox: dades pendents de pujar al núvol (sessions, valoracions, plans)
// - plans: plans generats (l'actiu és el més recent)
// - history: sèries fetes, per calcular les càrregues
// - done: sessions del pla ja completades (amb l'esforç de la sessió)
// - daily: estat diari (son, fatiga, molèsties, ànim)
// - measurements: mesures corporals
export type DoneRow = { plannedSessionId: string; sessionLogId: string; date: string; rpe?: number | null }

class LocalDB extends Dexie {
  drafts!: Table<SessionDraft, string>
  outbox!: Table<OutboxItem, string>
  plans!: Table<Plan, string>
  history!: Table<HistoryEntry, string>
  done!: Table<DoneRow, string>
  daily!: Table<DailyStatus, string>
  measurements!: Table<Measurement, string>

  constructor() {
    super('embranzida')
    this.version(1).stores({
      drafts: 'id, plannedSessionId',
      outbox: 'id, createdAt',
    })
    // v2: la cua admet sessions i valoracions (camp kind)
    this.version(2)
      .stores({ drafts: 'id, plannedSessionId', outbox: 'id, createdAt' })
      .upgrade((tx) =>
        tx
          .table('outbox')
          .toCollection()
          .modify((it: { kind?: string }) => {
            if (!it.kind) it.kind = 'session'
          }),
      )
    // v3: pla generat, historial de sèries i sessions fetes
    this.version(3).stores({
      drafts: 'id, plannedSessionId',
      outbox: 'id, createdAt',
      plans: 'id, createdAt',
      history: 'id, exerciseId, sessionLogId',
      done: 'plannedSessionId',
    })
    // v4: estat diari i mesures corporals
    this.version(4).stores({
      drafts: 'id, plannedSessionId',
      outbox: 'id, createdAt',
      plans: 'id, createdAt',
      history: 'id, exerciseId, sessionLogId',
      done: 'plannedSessionId',
      daily: 'day',
      measurements: 'id, measured_at',
    })
  }
}

export const db = new LocalDB()
