import { epley1RM, roundLoad, suggestNext } from './progression'
import type { Prescription, SetLog } from './types'

// Una sèrie feta, guardada a l'historial local per calcular les càrregues següents
export type HistoryEntry = {
  id: string
  exerciseId: string
  sessionLogId: string
  date: string // ISO
  deload: boolean
  repsMin?: number
  repsMax?: number
  rirTarget?: number
  loadKg?: number
  reps?: number
  rir?: number
  durationS?: number
}

export type LoadAdvice = { loadKg: number; reason: string }

const DAY = 864e5

// Càrrega suggerida per a una prescripció a partir de l'historial d'aquell exercici.
// - Sense historial: undefined (l'usuari tria una càrrega que li deixi el RIR objectiu)
// - Mateix rang de repeticions: regles R01/R03/R04 sobre l'última sessió
// - Rang diferent (canvi de mesocicle o de dia): es recalcula des del 1RM estimat
// - Principiants: la càrrega només puja un cop per setmana
// - Setmana de descàrrega: 90 % de la càrrega habitual
// Les sessions de descàrrega no compten per decidir la progressió.
export function adviseLoad(
  p: Prescription,
  history: HistoryEntry[],
  opts: { beginner: boolean; deload: boolean; now?: number },
): LoadAdvice | undefined {
  if (p.track !== 'load_reps') return undefined
  const now = opts.now ?? Date.now()
  const rel = history
    .filter((h) => h.exerciseId === p.exercise.id && h.loadKg && !h.deload)
    .sort((a, b) => b.date.localeCompare(a.date))
  if (!rel.length) return undefined

  const sessions: HistoryEntry[][] = []
  for (const h of rel) {
    const s = sessions.find((g) => g[0].sessionLogId === h.sessionLogId)
    if (s) s.push(h)
    else sessions.push([h])
  }
  const last = sessions[0]
  const lastLoad = Math.max(...last.map((h) => h.loadKg ?? 0))
  let advice: LoadAdvice

  const sameRange = last[0].repsMin === p.repsMin && last[0].repsMax === p.repsMax
  if (!sameRange && p.repsMin && p.repsMax) {
    const best = Math.max(0, ...last.map((h) => epley1RM(h.loadKg ?? 0, h.reps ?? 0) ?? 0))
    if (best > 0) {
      const target = (p.repsMin + p.repsMax) / 2 + (p.rirTarget ?? 2)
      advice = { loadKg: roundLoad(best / (1 + target / 30)), reason: 'Calculada amb el teu 1RM estimat' }
    } else {
      advice = { loadKg: lastLoad, reason: 'Última càrrega utilitzada' }
    }
  } else {
    const pseudo: Prescription = { ...p, id: 'hist', sets: last.length }
    const sets: SetLog[] = last.map((h, k) => ({
      id: h.id,
      prescriptionId: 'hist',
      exerciseId: h.exerciseId,
      setIndex: k + 1,
      loadKg: h.loadKg,
      reps: h.reps,
      rir: h.rir,
      completedAt: h.date,
    }))
    const sug = suggestNext({ ...pseudo, rirTarget: last[0].rirTarget ?? p.rirTarget }, sets)
    if (sug?.kind === 'pujar' && sug.nextLoadKg) {
      // Principiants: comprova que fa almenys 7 dies que treballa amb aquesta càrrega
      let since = Date.parse(last[0].date)
      for (const s of sessions) {
        if (Math.max(...s.map((h) => h.loadKg ?? 0)) !== lastLoad) break
        since = Date.parse(s[0].date)
      }
      if (opts.beginner && now - since < 7 * DAY) advice = { loadKg: lastLoad, reason: 'Mantens la càrrega fins a completar la setmana' }
      else advice = { loadKg: sug.nextLoadKg, reason: 'Puges: la última sessió vas completar el rang' }
    } else if (sug?.kind === 'baixar') {
      advice = { loadKg: sug.nextLoadKg, reason: 'Baixes un 10 %: la última sessió va costar massa' }
    } else {
      advice = { loadKg: lastLoad, reason: 'Mateixa càrrega: busca més repeticions' }
    }
  }
  if (opts.deload) advice = { loadKg: roundLoad(advice.loadKg * 0.9), reason: 'Setmana de descàrrega: 90 % de la càrrega' }
  return advice
}
