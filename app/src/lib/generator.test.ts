import { describe, expect, it } from 'vitest'
import { available, CATALOG } from '../data/catalog'
import { generatePlan, weeklySlots } from './generator'
import type { GeneratorInputs, GoalType } from './types'

const base = (o: Partial<GeneratorInputs> = {}): GeneratorInputs => ({
  level: 'principiant',
  goals: [{ id: 'g1', type: 'forca', priority: 1 }],
  days: 3,
  minutes: 60,
  equipment: ['manuella', 'banc'],
  ageRange: '30-39',
  parqFlag: false,
  startDate: '2026-11-02',
  ...o,
})
const goals = (...t: GoalType[]) => t.map((type, k) => ({ id: `g${k}`, type, priority: k === 0 ? 1 : 2 }))
const byId = new Map(CATALOG.map((e) => [e.id, e]))
const all = (p: ReturnType<typeof generatePlan>) => p.sessions.flatMap((s) => s.prescriptions)

describe('estructura del pla', () => {
  const p = generatePlan(base())
  it('12 setmanes × dies disponibles', () => expect(p.sessions.length).toBe(36))
  it('3 mesocicles', () => expect(p.mesocycles.map((m) => m.phase)).toEqual(['acumulacio', 'intensificacio', 'realitzacio']))
  it('la primera sessió és el dia d’inici i les dates avancen', () => {
    expect(p.sessions[0].date).toBe('2026-11-02')
    expect(p.sessions[3].date).toBe('2026-11-09')
  })
  it('setmanes 4, 8 i 12 són de descàrrega', () =>
    expect([...new Set(p.sessions.filter((s) => s.deload).map((s) => s.week))]).toEqual([4, 8, 12]))
  it('a la descàrrega, RIR 4 i menys sèries', () => {
    const w1 = p.sessions.find((s) => s.week === 1)!.prescriptions.filter((x) => x.block === 'principal' && x.rirTarget != null)
    const w4 = p.sessions.find((s) => s.week === 4)!.prescriptions.filter((x) => x.block === 'principal' && x.rirTarget != null)
    expect(w4.length).toBeGreaterThan(0)
    expect(w4.every((x) => x.rirTarget === 4)).toBe(true)
    expect(w4.reduce((a, x) => a + x.sets, 0)).toBeLessThan(w1.reduce((a, x) => a + x.sets, 0))
  })
})

describe('restriccions', () => {
  it('només exercicis amb el material disponible i del nivell', () => {
    const i = base()
    const ok = all(generatePlan(i)).every((x) => available(byId.get(x.exercise.id)!, i.equipment, i.level))
    expect(ok).toBe(true)
  })
  it('sense material també genera sessions de força', () => {
    const p = generatePlan(base({ equipment: [] }))
    expect(p.sessions[0].prescriptions.filter((x) => x.block === 'principal').length).toBeGreaterThanOrEqual(4)
  })
  it('PAR-Q+ amb risc: sense intervals i RIR mínim 3', () => {
    const p = generatePlan(base({ level: 'intermedi', parqFlag: true, goals: goals('resistencia', 'forca'), days: 5 }))
    expect(p.sessions.some((s) => s.title === 'Intervals')).toBe(false)
    expect(all(p).filter((x) => x.rirTarget != null && x.rirTarget !== 4).every((x) => x.rirTarget! >= 3)).toBe(true)
  })
  it('60+: exercicis d’equilibri a les sessions', () => {
    const p = generatePlan(base({ ageRange: '70+' }))
    expect(p.sessions.every((s) => s.prescriptions.some((x) => x.exercise.name === 'Suport sobre una cama'))).toBe(true)
  })
  it('principiants sense intervals fins a la setmana 9', () => {
    const p = generatePlan(base({ goals: goals('perdua_greix'), days: 5 }))
    const weeks = p.sessions.filter((s) => s.title === 'Intervals').map((s) => s.week)
    expect(weeks.length).toBeGreaterThan(0)
    expect(Math.min(...weeks)).toBe(9)
  })
})

describe('repartiment setmanal', () => {
  it('força principal + resistència, 5 dies: 3 força i 2 cardio intercalats', () => {
    expect(weeklySlots(base({ level: 'intermedi', goals: goals('forca', 'resistencia'), days: 5 }))).toEqual([
      'forca', 'z2', 'forca', 'z2', 'forca',
    ])
  })
  it('resistència principal, intermedi 4 dies: intervals des de la setmana 1', () => {
    const p = generatePlan(base({ level: 'intermedi', goals: goals('resistencia'), days: 4, equipment: [] }))
    expect(p.sessions.filter((s) => s.week === 1).map((s) => s.title)).toContain('Intervals')
  })
  it('mobilitat principal: sessions de mobilitat', () => {
    const p = generatePlan(base({ goals: goals('mobilitat', 'flexibilitat'), days: 3 }))
    expect(p.sessions.filter((s) => s.week === 1).every((s) => s.kind === 'mobilitat' || s.kind === 'flexibilitat')).toBe(true)
  })
  it('intermedi amb 4 dies de força fa tors/cames', () => {
    const p = generatePlan(base({ level: 'intermedi', days: 4, equipment: ['barra', 'rack', 'banc', 'manuella'] }))
    expect(p.sessions.slice(0, 4).map((s) => s.title)).toEqual(['Força · tors A', 'Força · cames A', 'Força · tors B', 'Força · cames B'])
  })
})
