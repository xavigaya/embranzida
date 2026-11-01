import type { DailyStatus } from './types'

// Puntuació de benestar d'un dia (1–5, més alt = millor)
export const wellness = (d: DailyStatus) => (d.sleep + (6 - d.fatigue) + (6 - d.soreness) + d.mood) / 4

const DAY = 864e5

// Regla R05: fatiga acumulada si
// - el benestar és ≤ 2 sobre 5 en 3 o més dels últims 5 dies, o
// - les dues últimes sessions es van valorar amb un esforç ≥ 9
// Conseqüència: la sessió següent redueix el volum un 20–30 % (la descàrrega segueix fixa).
export function fatigueFlag(daily: DailyStatus[], lastRpes: (number | null | undefined)[], todayIso: string): string | null {
  const t = Date.parse(`${todayIso}T00:00:00Z`)
  const recent = daily.filter((d) => {
    const age = (t - Date.parse(`${d.day}T00:00:00Z`)) / DAY
    return age >= 0 && age < 5
  })
  if (recent.filter((d) => wellness(d) <= 2).length >= 3) return 'Fa dies que et notes cansat'
  const two = lastRpes.slice(-2)
  if (two.length === 2 && two.every((r) => (r ?? 0) >= 9)) return 'Les dues últimes sessions van ser molt dures'
  return null
}

// Redueix les sèries de la part principal un 25 % (mínim 1)
export const reducedSets = (sets: number) => Math.max(1, Math.round(sets * 0.75))
