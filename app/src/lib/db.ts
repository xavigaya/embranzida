import Dexie, { type Table } from 'dexie'
import type { OutboxItem, SessionDraft } from './types'

// Base de dades local del mòbil (IndexedDB).
// - drafts: l'entrenament en curs, perquè no es perdi si es tanca l'app
// - outbox: entrenaments acabats pendents de pujar al núvol
class LocalDB extends Dexie {
  drafts!: Table<SessionDraft, string>
  outbox!: Table<OutboxItem, string>

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
  }
}

export const db = new LocalDB()
