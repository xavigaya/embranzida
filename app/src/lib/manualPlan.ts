import { CATALOG } from '../data/catalog'
import type { Block, GeneratorInputs, Plan, PlannedSession, Prescription, TemplateSession } from './types'

// =====================================================================
// Pla manual: l'usuari defineix una setmana tipus (plantilla) i el pla la
// repeteix durant N setmanes. El motor no canvia sèries ni repeticions;
// només suggereix les càrregues (loads.ts) i, si es demana, aplica una
// setmana de descàrrega cada 4 (menys sèries i RIR 4).
// =====================================================================

const uuid = () => crypto.randomUUID()
const byId = new Map(CATALOG.map((e) => [e.id, e]))
const BLOCK_ORDER: Block[] = ['escalfament', 'principal', 'calma']
export const WEEKDAYS = ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg']

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const weekdayOf = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7
export const mondayOf = (iso: string) => addDays(iso, -weekdayOf(iso))

// Paràmetres per defecte en afegir un exercici a la plantilla
export function defaultPrescription(exerciseId: string): Prescription {
  const e = byId.get(exerciseId)
  if (!e) throw new Error(`Exercici ${exerciseId} inexistent`)
  const base = { id: uuid(), exercise: { id: e.id, name: e.name, cue: e.cue }, track: e.track }
  if (e.modality === 'cardio') return { ...base, block: 'principal', sets: 1, durationS: 30 * 60, hrZone: 2, restS: 0 }
  if (e.modality === 'mobilitat')
    return e.track === 'time'
      ? { ...base, block: 'escalfament', sets: 2, durationS: 30, restS: 30 }
      : { ...base, block: 'escalfament', sets: 2, repsMin: 8, repsMax: 8, restS: 20 }
  if (e.modality === 'flexibilitat') return { ...base, block: 'calma', sets: 2, durationS: 30, restS: 15 }
  if (e.track === 'time') return { ...base, block: 'principal', sets: 3, durationS: 30, restS: 60 }
  if (e.track === 'reps') return { ...base, block: 'principal', sets: 3, repsMin: 8, repsMax: 15, rirTarget: 2, restS: 90 }
  return { ...base, block: 'principal', sets: 3, repsMin: 8, repsMax: 12, rirTarget: 2, restS: 90 }
}

function sessionKind(items: Prescription[]): PlannedSession['kind'] {
  const kinds = new Set(items.filter((p) => p.block === 'principal').map((p) => byId.get(p.exercise.id)?.modality))
  if (kinds.size === 1) {
    const k = [...kinds][0]
    if (k === 'forca' || k === 'cardio' || k === 'mobilitat' || k === 'flexibilitat') return k
  }
  if (kinds.size === 0) {
    const all = new Set(items.map((p) => byId.get(p.exercise.id)?.modality))
    if (all.size === 1 && (all.has('mobilitat') || all.has('flexibilitat'))) return [...all][0] as 'mobilitat' | 'flexibilitat'
  }
  return 'mixta'
}

// Ordena els exercicis per bloc (escalfament → principal → calma) mantenint l'ordre dins de cada bloc
export const sortByBlock = (items: Prescription[]) =>
  [...items].sort((a, b) => BLOCK_ORDER.indexOf(a.block) - BLOCK_ORDER.indexOf(b.block))

function deloadOf(p: Prescription): Prescription {
  if (p.block !== 'principal') return p
  return { ...p, sets: Math.max(1, Math.round(p.sets * 0.55)), rirTarget: p.rirTarget != null ? 4 : undefined }
}

export type ManualPlanInput = {
  template: TemplateSession[]
  weeks: number
  deloadEvery4: boolean
  startDate: string // YYYY-MM-DD
  inputs: GeneratorInputs
  // En editar un pla: es conserven les sessions ja fetes (mateixa setmana i posició)
  previous?: { plan: Plan; done: Set<string> }
}

export type ManualPlanResult = {
  plan: Plan
  // sessions del pla anterior que ja estaven fetes → id equivalent al pla nou
  carriedDone: { oldId: string; newId: string }[]
}

export function buildManualPlan(i: ManualPlanInput): ManualPlanResult {
  const monday = mondayOf(i.startDate)
  const template = [...i.template]
    .filter((t) => t.items.length > 0)
    .sort((a, b) => a.weekday - b.weekday)
  const mesoCount = Math.ceil(i.weeks / 4)
  const phases = ['acumulacio', 'intensificacio', 'realitzacio'] as const
  const mesocycles = Array.from({ length: mesoCount }, (_, k) => ({
    id: uuid(),
    position: k + 1,
    phase: phases[k % 3],
    weeks: Math.min(4, i.weeks - 4 * k),
  }))

  // Sessions fetes del pla anterior, per setmana i posició dins la setmana
  const oldDone = new Map<string, string>()
  if (i.previous) {
    const byWeek = new Map<number, PlannedSession[]>()
    for (const s of [...i.previous.plan.sessions].sort((a, b) => a.order - b.order))
      (byWeek.get(s.week) ?? byWeek.set(s.week, []).get(s.week)!).push(s)
    for (const [w, list] of byWeek) list.forEach((s, k) => i.previous!.done.has(s.id) && oldDone.set(`${w}:${k}`, s.id))
  }

  const sessions: PlannedSession[] = []
  const carriedDone: ManualPlanResult['carriedDone'] = []
  let order = 0
  for (let week = 1; week <= i.weeks; week++) {
    const deload = i.deloadEvery4 && week % 4 === 0
    const meso = Math.ceil(week / 4)
    let pos = 0
    for (const t of template) {
      const date = addDays(monday, 7 * (week - 1) + t.weekday)
      const key = `${week}:${pos}`
      // Pla nou des de zero: no es proposen sessions de dies ja passats de la primera setmana
      if (!i.previous && week === 1 && date < i.startDate) continue
      const items = sortByBlock(t.items).map((p) => {
        const q: Prescription = { ...p, id: uuid(), loadKg: undefined, startKg: undefined }
        return deload ? deloadOf(q) : q
      })
      const s: PlannedSession = {
        id: uuid(),
        title: t.title.trim() || `Sessió ${WEEKDAYS[t.weekday]}`,
        kind: sessionKind(items),
        focus: `Setmana ${week} de ${i.weeks} · ${deload ? 'descàrrega' : 'pla manual'}`,
        prescriptions: items,
        week,
        mesocycle: meso,
        deload,
        date,
        order: order++,
      }
      sessions.push(s)
      const old = oldDone.get(key)
      if (old) carriedDone.push({ oldId: old, newId: s.id })
      pos++
    }
  }

  return {
    plan: {
      id: uuid(),
      createdAt: new Date().toISOString(),
      startDate: i.previous ? i.previous.plan.startDate : i.startDate,
      weeks: i.weeks,
      mode: 'manual',
      template: template.map((t) => ({ ...t, items: sortByBlock(t.items) })),
      deloadEvery4: i.deloadEvery4,
      inputs: { ...i.inputs, startDate: i.startDate },
      mesocycles,
      sessions,
    },
    carriedDone,
  }
}

// Converteix la setmana actual d'un pla (automàtic o manual) en plantilla editable
export function templateFromPlan(plan: Plan, week: number): TemplateSession[] {
  if (plan.template?.length) return plan.template.map((t) => ({ ...t, items: t.items.map((p) => ({ ...p })) }))
  const ref = plan.sessions.filter((s) => s.week === week && !s.deload)
  const source = ref.length ? ref : plan.sessions.filter((s) => s.week === 1)
  return source
    .sort((a, b) => a.order - b.order)
    .map((s) => ({
      id: uuid(),
      title: s.title.split(' · ')[0],
      weekday: weekdayOf(s.date),
      items: s.prescriptions.map((p) => ({ ...p, id: uuid(), loadKg: undefined, startKg: undefined })),
    }))
}
