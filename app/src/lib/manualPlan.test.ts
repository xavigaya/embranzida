import { describe, expect, it } from 'vitest'
import { exerciseId } from '../data/catalog'
import { generatePlan } from './generator'
import { buildManualPlan, defaultPrescription, templateFromPlan } from './manualPlan'
import type { GeneratorInputs, TemplateSession } from './types'

const inputs: GeneratorInputs = {
  level: 'intermedi', goals: [], days: 3, minutes: 60, equipment: ['manuella', 'banc'], ageRange: '30-39', parqFlag: false, startDate: '2026-11-04',
}
// Dilluns i dijous; cada sessió amb mobilitat, força i estirament (desordenats a propòsit)
const tpl = (): TemplateSession[] => [
  { id: 't2', title: 'Cames', weekday: 3, items: [defaultPrescription(exerciseId(37)), defaultPrescription(exerciseId(2)), defaultPrescription(exerciseId(31))] },
  { id: 't1', title: 'Tors', weekday: 0, items: [defaultPrescription(exerciseId(16)), defaultPrescription(exerciseId(8))] },
]

describe('pla manual', () => {
  // 4 de novembre de 2026 és dimecres
  const { plan } = buildManualPlan({ template: tpl(), weeks: 8, deloadEvery4: true, startDate: '2026-11-04', inputs })

  it('repeteix la plantilla setmana rere setmana, ordenada per dia', () => {
    expect(plan.mode).toBe('manual')
    expect(plan.sessions.filter((s) => s.week === 2).map((s) => [s.title, s.date])).toEqual([
      ['Tors', '2026-11-09'],
      ['Cames', '2026-11-12'],
    ])
  })
  it('no proposa sessions de dies ja passats de la primera setmana', () => {
    expect(plan.sessions.filter((s) => s.week === 1).map((s) => s.date)).toEqual(['2026-11-05'])
  })
  it('ordena els exercicis per bloc', () => {
    const cames = plan.sessions.find((s) => s.title === 'Cames')!
    expect(cames.prescriptions.map((p) => p.block)).toEqual(['escalfament', 'principal', 'calma'])
  })
  it('descàrrega a les setmanes 4 i 8: menys sèries i RIR 4', () => {
    const w4 = plan.sessions.filter((s) => s.week === 4)
    expect(w4.every((s) => s.deload)).toBe(true)
    const main = w4[0].prescriptions.filter((p) => p.block === 'principal')
    expect(main.every((p) => p.sets === 2 && p.rirTarget === 4)).toBe(true)
    expect(plan.mesocycles.length).toBe(2)
  })
  it('sense descàrrega, totes les setmanes iguals', () => {
    const r = buildManualPlan({ template: tpl(), weeks: 4, deloadEvery4: false, startDate: '2026-11-02', inputs })
    expect(r.plan.sessions.some((s) => s.deload)).toBe(false)
    expect(r.plan.sessions.length).toBe(8)
  })
  it('en editar, conserva les sessions fetes per setmana i posició', () => {
    const done = new Set(plan.sessions.slice(0, 2).map((s) => s.id))
    const r = buildManualPlan({ template: tpl(), weeks: 8, deloadEvery4: true, startDate: '2026-11-04', inputs, previous: { plan, done } })
    expect(r.carriedDone.length).toBe(2)
    expect(r.plan.startDate).toBe(plan.startDate)
  })
  it('converteix un pla automàtic en plantilla', () => {
    const auto = generatePlan({ ...inputs, goals: [{ id: 'g', type: 'forca', priority: 1 }], startDate: '2026-11-02' })
    const t = templateFromPlan(auto, 1)
    expect(t.length).toBe(3)
    expect(t.map((x) => x.weekday)).toEqual([0, 2, 4])
    expect(t[0].items.every((p) => p.loadKg === undefined)).toBe(true)
  })
})
