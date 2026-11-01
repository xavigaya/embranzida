import { describe, expect, it } from 'vitest'
import { epley1RM, suggestNext } from './progression'
import type { Prescription, SetLog } from './types'

const p: Prescription = {
  id: 'p1',
  exercise: { id: 'e1', name: 'Sentadilla', cue: '' },
  block: 'principal',
  track: 'load_reps',
  sets: 3, repsMin: 6, repsMax: 8, loadKg: 60, rirTarget: 2, restS: 120,
}
const mk = (reps: number, rir: number, loadKg = 60): SetLog => ({
  id: crypto.randomUUID(), prescriptionId: 'p1', exerciseId: 'e1', setIndex: 1, loadKg, reps, rir, completedAt: '',
})

describe('epley1RM', () => {
  it('calcula el 1RM estimat', () => expect(epley1RM(100, 5)).toBe(116.7))
  it('ignora sèries de més de 12 repeticions', () => expect(epley1RM(50, 15)).toBeNull())
})

describe('suggestNext', () => {
  it('no suggereix res fins acabar totes les sèries', () => {
    expect(suggestNext(p, [mk(8, 2)])).toBeNull()
  })
  it('puja càrrega si totes les sèries arriben al màxim amb el RIR objectiu', () => {
    const s = suggestNext(p, [mk(8, 2), mk(8, 2), mk(8, 3)])
    expect(s).toMatchObject({ kind: 'pujar', nextLoadKg: 62.5 })
  })
  it('massa fàcil (RIR 2 per sobre) → puja un 5 %', () => {
    expect(suggestNext(p, [mk(10, 4), mk(10, 4), mk(9, 4)])).toMatchObject({ kind: 'pujar', nextLoadKg: 62.5 })
  })
  it('manté si falta esforç de reserva', () => {
    expect(suggestNext(p, [mk(8, 1), mk(8, 2), mk(8, 2)])?.kind).toBe('mantenir')
  })
  it('baixa un 10 % amb dues sèries per sota del mínim', () => {
    expect(suggestNext(p, [mk(5, 0), mk(4, 0), mk(6, 0)])).toMatchObject({ kind: 'baixar', nextLoadKg: 55 })
  })
  it('puja un 5 % amb càrregues lleugeres', () => {
    const light = { ...p, loadKg: 20 }
    expect(suggestNext(light, [mk(8, 2, 20), mk(8, 2, 20), mk(8, 2, 20)])?.kind).toBe('pujar')
  })
})
