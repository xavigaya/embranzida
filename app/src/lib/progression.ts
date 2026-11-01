import type { Prescription, SetLog } from './types'

// 1RM estimat (fórmula d'Epley). Només té sentit fins a ~12 repeticions.
export function epley1RM(loadKg: number, reps: number): number | null {
  if (!loadKg || !reps || reps < 1 || reps > 12) return null
  return Math.round(loadKg * (1 + reps / 30) * 10) / 10
}

export type Suggestion =
  | { kind: 'pujar'; nextLoadKg: number; text: string }
  | { kind: 'mantenir'; text: string }
  | { kind: 'baixar'; nextLoadKg: number; text: string }

// Arrodoneix a discos de 1,25 kg per costat (salts de 2,5 kg)
const roundPlate = (kg: number) => Math.round(kg / 2.5) * 2.5

// Doble progressió amb control d'esforç (RIR):
// - Totes les sèries al màxim del rang i amb RIR >= objectiu → +2,5–5 %
// - Alguna sèrie per sota del mínim del rang → mantenir; si és més d'una, baixar 10 %
// - Altrament → mantenir càrrega i intentar més repeticions
export function suggestNext(p: Prescription, sets: SetLog[]): Suggestion | null {
  if (!p.repsMin || !p.repsMax || !p.loadKg) return null
  const done = sets.filter((s) => s.prescriptionId === p.id && s.reps != null)
  if (done.length < p.sets) return null

  const load = done[0].loadKg ?? p.loadKg
  const rirTarget = p.rirTarget ?? 2
  const allTop = done.every((s) => (s.reps ?? 0) >= p.repsMax! && (s.rir ?? 0) >= rirTarget)
  const misses = done.filter((s) => (s.reps ?? 0) < p.repsMin!).length

  if (allTop) {
    const step = load < 40 ? 0.05 : 0.025
    const next = Math.max(load + 2.5, roundPlate(load * (1 + step)))
    return { kind: 'pujar', nextLoadKg: next, text: `Pròxima sessió: ${fmtKg(next)} kg` }
  }
  if (misses >= 2) {
    const next = roundPlate(load * 0.9)
    return { kind: 'baixar', nextLoadKg: next, text: `Pròxima sessió: baixa a ${fmtKg(next)} kg` }
  }
  return { kind: 'mantenir', text: `Mantén ${fmtKg(load)} kg i busca més repeticions` }
}

export const fmtKg = (kg: number) =>
  Number.isInteger(kg) ? String(kg) : kg.toFixed(2).replace(/0$/, '').replace('.', ',')
