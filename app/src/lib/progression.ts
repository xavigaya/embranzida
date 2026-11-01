import type { Prescription, SetLog } from './types'

// 1RM estimat (fórmula d'Epley). Només té sentit fins a ~12 repeticions.
export function epley1RM(loadKg: number, reps: number): number | null {
  if (!loadKg || !reps || reps < 1 || reps > 12) return null
  return Math.round(loadKg * (1 + reps / 30) * 10) / 10
}

export type Suggestion =
  | { kind: 'pujar'; nextLoadKg?: number; text: string }
  | { kind: 'mantenir'; text: string }
  | { kind: 'baixar'; nextLoadKg: number; text: string }

// Salts de 2,5 kg (barra) o d'1 kg per a càrregues lleugeres (manuelles)
export const roundLoad = (kg: number) => (kg < 20 ? Math.max(1, Math.round(kg)) : Math.round(kg / 2.5) * 2.5)

export const fmtKg = (kg: number) =>
  Number.isInteger(kg) ? String(kg) : kg.toFixed(2).replace(/0$/, '').replace('.', ',')

// Regles del motor (document de plantilles):
// R01 totes les sèries al màxim del rang amb RIR >= objectiu → +2,5 % (+5 % si < 40 kg), mínim un salt
// R03 dues sèries o més per sota del mínim → -10 %
// R04 RIR 2 punts per sobre de l'objectiu (massa fàcil) → +5 %
// R02 altrament → mantenir
export function suggestNext(p: Prescription, sets: SetLog[]): Suggestion | null {
  if (!p.repsMin || !p.repsMax) return null
  const done = sets.filter((s) => s.prescriptionId === p.id && s.reps != null)
  if (done.length < p.sets) return null

  const load = done[0].loadKg
  const rirTarget = p.rirTarget ?? 2
  const allTop = done.every((s) => (s.reps ?? 0) >= p.repsMax! && (s.rir ?? 0) >= rirTarget)
  const misses = done.filter((s) => (s.reps ?? 0) < p.repsMin!).length
  const avgRir = done.reduce((a, s) => a + (s.rir ?? rirTarget), 0) / done.length
  const tooEasy = avgRir >= rirTarget + 2 && misses === 0

  if (!load) {
    if (allTop || tooEasy) return { kind: 'pujar', text: 'Molt bé: prova una variant més difícil o fes més repeticions' }
    return { kind: 'mantenir', text: 'Mantén l’exercici i busca més repeticions' }
  }
  if (allTop) {
    const step = load < 40 ? 0.05 : 0.025
    const next = Math.max(roundLoad(load * (1 + step)), roundLoad(load + (load < 20 ? 1 : 2.5)))
    return { kind: 'pujar', nextLoadKg: next, text: `Pròxima sessió: ${fmtKg(next)} kg` }
  }
  if (misses >= 2) {
    const next = roundLoad(load * 0.9)
    return { kind: 'baixar', nextLoadKg: next, text: `Pròxima sessió: baixa a ${fmtKg(next)} kg` }
  }
  if (tooEasy) {
    const next = Math.max(roundLoad(load * 1.05), roundLoad(load + (load < 20 ? 1 : 2.5)))
    return { kind: 'pujar', nextLoadKg: next, text: `Massa fàcil: pròxima sessió ${fmtKg(next)} kg` }
  }
  return { kind: 'mantenir', text: `Mantén ${fmtKg(load)} kg i busca més repeticions` }
}
