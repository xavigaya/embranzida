import { describe, expect, it } from 'vitest'
import { computeLevel, pushCategory } from './level'

describe('pushCategory (normes ACSM)', () => {
  it('home 30–39 amb 22 flexions és mitjana', () => expect(pushCategory(22, 'home', '30-39')).toBe('mitjana'))
  it('dona 30–39 amb 30 flexions és bona', () => expect(pushCategory(30, 'dona', '30-39')).toBe('bona'))
  it('home 60+ amb 5 flexions és molt per sota', () => expect(pushCategory(5, 'home', '70+')).toBe('molt_baixa'))
  it('sexe no indicat fa servir les normes de dones', () =>
    expect(pushCategory(30, 'no_ho_dic', '30-39')).toBe(pushCategory(30, 'dona', '30-39')))
})

describe('computeLevel', () => {
  it('experiència curta → principiant encara que faci moltes flexions', () => {
    expect(computeLevel({ experience: 'menys_6m', pushups: 45, sex: 'home', ageRange: '30-39' }).level).toBe('principiant')
  })
  it('molta experiència però poques flexions → principiant, amb explicació', () => {
    const r = computeLevel({ experience: 'mes_2a', pushups: 10, sex: 'home', ageRange: '30-39', barbellTechnique: true })
    expect(r.level).toBe('principiant')
    expect(r.reasons.length).toBe(1)
  })
  it('avançat només amb flexions bones i tècnica amb barra', () => {
    expect(computeLevel({ experience: 'mes_2a', pushups: 36, sex: 'home', ageRange: '30-39', barbellTechnique: true }).level).toBe('avancat')
    expect(computeLevel({ experience: 'mes_2a', pushups: 36, sex: 'home', ageRange: '30-39', barbellTechnique: false }).level).toBe('intermedi')
  })
  it('sense test de flexions el màxim és intermedi', () => {
    expect(computeLevel({ experience: 'mes_2a', sex: 'home', ageRange: '30-39', barbellTechnique: true }).level).toBe('intermedi')
  })
})
