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

export type SessionPayload = {
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

export type GoalType = 'forca' | 'perdua_greix' | 'resistencia' | 'mobilitat' | 'flexibilitat'

export type AssessmentPayload = {
  profile: {
    sex: string | null
    level: string
    days_per_week: number
    minutes_per_session: number
    equipment: string[]
    limitations: string | null
  }
  goals: { id: string; type: GoalType; priority: number }[]
  assessment: {
    id: string
    taken_at: string
    kind: 'inicial' | 'periodica'
    parq_flag: boolean
    results: Record<string, unknown>
  }
}

export type OutboxItem =
  | { id: string; kind: 'session'; payload: SessionPayload; createdAt: string; lastError?: string }
  | { id: string; kind: 'assessment'; payload: AssessmentPayload; createdAt: string; lastError?: string }
