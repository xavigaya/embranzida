import Dexie, { type Table } from 'dexie'
import type { HistoryEntry } from './loads'
import type { OutboxItem, Plan, SessionDraft } from './types'

// Base de dades local del mòbil (IndexedDB).
// - drafts: l'entrenament en curs, perquè no es perdi si es tanca l'app
// - outbox: dades pendents de pujar al núvol (sessions, valoracions, plans)
// - plans: plans generats (l'actiu és el més recent)
// - history: sèries fetes, per calcular les càrregues
// - done: sessions del pla ja completades
class LocalDB extends Dexie {
  drafts!: Table<SessionDraft, string>
  outbox!: Table<OutboxItem, string>
  plans!: Table<Plan, string>
  history!: Table<HistoryEntry, string>
  done!: Table<{ plannedSessionId: string; sessionLogId: string; date: string }, string>

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
  }
}

export const db = new LocalDB()
