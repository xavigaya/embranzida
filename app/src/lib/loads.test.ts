import { describe, expect, it } from 'vitest'
import { adviseLoad, type HistoryEntry } from './loads'
import type { Prescription } from './types'

const p: Prescription = {
  id: 'p', exercise: { id: 'e', name: 'Sentadilla', cue: '' }, block: 'principal', track: 'load_reps',
  sets: 3, repsMin: 8, repsMax: 12, rirTarget: 2, restS: 120,
}
const now = Date.parse('2026-11-20T10:00:00Z')
const sess = (id: string, date: string, load: number, reps: number[], rir = 2, extra: Partial<HistoryEntry> = {}): HistoryEntry[] =>
  reps.map((r, k) => ({ id: `${id}-${k}`, exerciseId: 'e', sessionLogId: id, date, deload: false, repsMin: 8, repsMax: 12, rirTarget: 2, loadKg: load, reps: r, rir, ...extra }))

describe('adviseLoad', () => {
  it('sense historial no suggereix res', () => expect(adviseLoad(p, [], { beginner: false, deload: false, now })).toBeUndefined())
  it('rang complet → puja', () =>
    expect(adviseLoad(p, sess('s1', '2026-11-18T10:00:00Z', 60, [12, 12, 12]), { beginner: false, deload: false, now })?.loadKg).toBe(62.5))
  it('principiant: no puja si fa menys de 7 dies que va pujar', () => {
    const h = [...sess('s0', '2026-11-11T10:00:00Z', 57.5, [12, 12, 12]), ...sess('s1', '2026-11-18T10:00:00Z', 60, [12, 12, 12])]
    expect(adviseLoad(p, h, { beginner: true, deload: false, now })?.loadKg).toBe(60)
  })
  it('principiant: puja si porta 7 dies o més amb la mateixa càrrega', () => {
    const h = [...sess('s0', '2026-11-11T10:00:00Z', 60, [10, 10, 10]), ...sess('s1', '2026-11-18T10:00:00Z', 60, [12, 12, 12])]
    expect(adviseLoad(p, h, { beginner: true, deload: false, now })?.loadKg).toBe(62.5)
  })
  it('dues sèries per sota del mínim → baixa un 10 %', () =>
    expect(adviseLoad(p, sess('s1', '2026-11-18T10:00:00Z', 60, [6, 5, 8], 0), { beginner: false, deload: false, now })?.loadKg).toBe(55))
  it('canvi de rang → recalcula des del 1RM estimat', () => {
    const heavy = { ...p, repsMin: 4, repsMax: 6, rirTarget: 1 }
    // 60 kg × 12 → 1RM ≈ 84 kg; objectiu 5 + 1 = 6 reps → 84 / 1,2 = 70 kg
    expect(adviseLoad(heavy, sess('s1', '2026-11-18T10:00:00Z', 60, [12, 12, 12]), { beginner: false, deload: false, now })?.loadKg).toBe(70)
  })
  it('descàrrega → 90 %', () =>
    expect(adviseLoad(p, sess('s1', '2026-11-18T10:00:00Z', 60, [10, 10, 10]), { beginner: false, deload: true, now })?.loadKg).toBe(55))
  it('ignora les sessions de descàrrega per decidir', () => {
    const h = [...sess('s0', '2026-11-11T10:00:00Z', 60, [10, 10, 10]), ...sess('s1', '2026-11-18T10:00:00Z', 55, [12, 12], 4, { deload: true })]
    expect(adviseLoad(p, h, { beginner: false, deload: false, now })?.loadKg).toBe(60)
  })
})
