import raw from './exercises.json'

// Catàleg d'exercicis. Font única: exercises.json
// (supabase/seed.sql es genera a partir d'aquest fitxer amb `npm run seed`).

export type Track = 'load_reps' | 'reps' | 'time'
export type LevelId = 'principiant' | 'intermedi' | 'avancat'

export type CatalogExercise = {
  id: string
  n: number
  name: string
  modality: 'forca' | 'cardio' | 'mobilitat' | 'flexibilitat'
  pattern: string
  needs?: string[]
  needsAny?: string[]
  minLevel: LevelId
  track: Track
  impact: 'baix' | 'alt'
  target?: string
  muscles: string[]
  cue: string
}

export const exerciseId = (n: number) => `0e5a0000-0000-4000-8000-${String(n).padStart(12, '0')}`

export const CATALOG: CatalogExercise[] = (raw as Omit<CatalogExercise, 'id'>[]).map((e) => ({
  ...e,
  id: exerciseId(e.n),
}))

const byN = new Map(CATALOG.map((e) => [e.n, e]))
export const ex = (n: number): CatalogExercise => {
  const e = byN.get(n)
  if (!e) throw new Error(`Exercici ${n} inexistent`)
  return e
}

const LEVELS: LevelId[] = ['principiant', 'intermedi', 'avancat']

export function available(e: CatalogExercise, equipment: string[], level: LevelId): boolean {
  if (LEVELS.indexOf(e.minLevel) > LEVELS.indexOf(level)) return false
  if (e.needs && !e.needs.every((x) => equipment.includes(x))) return false
  if (e.needsAny && !e.needsAny.some((x) => equipment.includes(x))) return false
  return true
}
