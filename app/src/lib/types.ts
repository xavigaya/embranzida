export type Exercise = {
  id: string
  name: string
  cue: string // indicació tècnica breu
}

export type Prescription = {
  id: string
  exercise: Exercise
  sets: number
  repsMin?: number
  repsMax?: number
  loadKg?: number
  durationS?: number
  rirTarget?: number
  restS: number
}

export type PlannedSession = {
  id: string
  title: string
  kind: 'forca' | 'cardio' | 'mobilitat' | 'flexibilitat' | 'mixta'
  focus: string
  prescriptions: Prescription[]
}

export type SetLog = {
  id: string
  prescriptionId: string
  exerciseId: string
  setIndex: number
  loadKg?: number
  reps?: number
  rir?: number
  durationS?: number
  completedAt: string
}

export type SessionDraft = {
  id: string // = id del session_log
  plannedSessionId: string
  startedAt: string
  sets: SetLog[]
}

export type OutboxItem = {
  id: string // id del session_log
  payload: {
    session: {
      id: string
      started_at: string
      ended_at: string
      session_rpe: number | null
      feeling: number | null
      notes: string | null
    }
    sets: SetLog[]
  }
  createdAt: string
  lastError?: string
}
