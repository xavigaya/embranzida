import { describe, expect, it } from 'vitest'
import { fatigueFlag, reducedSets, wellness } from './fatigue'
import type { DailyStatus } from './types'

const d = (day: string, v: number): DailyStatus => ({ day, sleep: v, fatigue: 6 - v, soreness: 6 - v, mood: v })

describe('R05 fatiga', () => {
  it('benestar calculat amb les escales invertides', () => expect(wellness(d('2026-11-01', 2))).toBe(2))
  it('3 dies dolents en 5 → fatiga', () =>
    expect(fatigueFlag([d('2026-11-05', 2), d('2026-11-04', 1), d('2026-11-02', 2)], [], '2026-11-05')).not.toBeNull())
  it('dies dolents fa més de 5 dies no compten', () =>
    expect(fatigueFlag([d('2026-11-05', 2), d('2026-10-30', 1), d('2026-10-29', 2)], [], '2026-11-05')).toBeNull())
  it('dues sessions seguides amb esforç ≥ 9 → fatiga', () => expect(fatigueFlag([], [7, 9, 10], '2026-11-05')).not.toBeNull())
  it('una sola sessió dura no n’hi ha prou', () => expect(fatigueFlag([], [9, 6], '2026-11-05')).toBeNull())
  it('redueix les sèries un 25 %', () => {
    expect(reducedSets(4)).toBe(3)
    expect(reducedSets(3)).toBe(2)
    expect(reducedSets(1)).toBe(1)
  })
})
