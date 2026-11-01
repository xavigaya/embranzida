export type Exercise = {
  id: string
  name: string
  cue: string // indicació tècnica breu
}

export type Block = 'escalfament' | 'principal' | 'calma'
export type Track = 'load_reps' | 'reps' | 'time'

export type Prescription = {
  id: string
  exercise: Exercise
  block: Block
  track: Track
  sets: number
  repsMin?: number
  repsMax?: number
  durationS?: number
  hrZone?: number
  rirTarget?: number
  restS: number
  loadKg?: number // calculada en temps d'execució a partir de l'historial
  startKg?: number // càrrega inicial orientativa quan no hi ha historial
  note?: string
}

export type PlannedSession = {
  id: string
  title: string
  kind: 'forca' | 'cardio' | 'mobilitat' | 'flexibilitat' | 'mixta'
  focus: string
  prescriptions: Prescription[]
  week: number
  mesocycle: number
  deload: boolean
  date: string // YYYY-MM-DD
  order: number
}

export type GeneratorInputs = {
  level: 'principiant' | 'intermedi' | 'avancat'
  goals: { id: string; type: GoalType; priority: number }[]
  days: number
  minutes: number
  equipment: string[]
  ageRange: string | null
  parqFlag: boolean
  results?: Record<string, unknown>
  startDate: string
}

export type Plan = {
  id: string
  createdAt: string
  startDate: string
  weeks: number
  inputs: GeneratorInputs
  mesocycles: { id: string; position: number; phase: 'acumulacio' | 'intensificacio' | 'realitzacio'; weeks: number }[]
  sessions: PlannedSession[]
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
    planned_session_id?: string | null
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

export type DailyStatus = {
  day: string // YYYY-MM-DD
  sleep: number // 1 malament – 5 molt bé
  fatigue: number // 1 gens – 5 molta
  soreness: number // 1 gens – 5 molt
  mood: number // 1 baix – 5 molt bo
}

export type Measurement = {
  id: string
  measured_at: string
  weight_kg?: number | null
  waist_cm?: number | null
  hip_cm?: number | null
}

export type OutboxItem =
  | { id: string; kind: 'daily'; payload: DailyStatus; createdAt: string; lastError?: string }
  | { id: string; kind: 'measurement'; payload: Measurement; createdAt: string; lastError?: string }
  | { id: string; kind: 'plan'; payload: Plan; createdAt: string; lastError?: string }
  | { id: string; kind: 'session'; payload: SessionPayload; createdAt: string; lastError?: string }
  | { id: string; kind: 'assessment'; payload: AssessmentPayload; createdAt: string; lastError?: string }
