import { available, ex, type CatalogExercise, type LevelId } from '../data/catalog'
import type { Block, GeneratorInputs, GoalType, Plan, PlannedSession, Prescription } from './types'

// =====================================================================
// Generador del pla (macrocicle de 12 setmanes = 3 mesocicles de 4).
// Implementa el document «Embranzida – Plantilles d'entrenament» revisat:
// RIR per a tothom, descàrrega fixa la setmana 4 de cada mesocicle,
// intervals per a principiants a partir de la setmana 9, adaptacions 60+
// i limitació d'intensitat si el PAR-Q+ indica risc.
// Les càrregues NO es fixen aquí: es calculen en cada sessió a partir de
// l'historial (vegeu loads.ts).
// =====================================================================

export const PLAN_WEEKS = 12
const WEEKS_PER_MESO = 4

type SlotType = 'forca' | 'z2' | 'intervals' | 'mob'

const DAY_OFFSETS: Record<number, number[]> = {
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 5],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
}
const STRENGTH_CAP: Record<LevelId, number> = { principiant: 3, intermedi: 4, avancat: 5 }
const EXERCISES_BY_MINUTES = (m: number) => (m <= 30 ? 3 : m <= 45 ? 4 : m <= 60 ? 5 : 6)

const uuid = () => crypto.randomUUID()

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export const mainGoalOf = (i: GeneratorInputs): GoalType =>
  [...i.goals].sort((a, b) => a.priority - b.priority)[0]?.type ?? 'forca'

const isSenior = (age: string | null) => age === '60-69' || age === '70+'

// --------------------------------------------------------------------
// Repartiment setmanal de sessions
// --------------------------------------------------------------------
export function weeklySlots(i: GeneratorInputs): SlotType[] {
  const d = Math.min(6, Math.max(2, i.days))
  const main = mainGoalOf(i)
  const has = (g: GoalType) => i.goals.some((x) => x.type === g)
  const cardioGoal = has('resistencia') || has('perdua_greix')

  let S: number
  switch (main) {
    case 'forca':
      S = cardioGoal ? Math.max(2, Math.round(d * 0.6)) : d
      break
    case 'perdua_greix':
      S = d <= 2 ? 1 : i.level === 'principiant' ? 2 : d >= 4 ? 3 : 2
      break
    case 'resistencia':
      S = d >= 4 ? 2 : has('forca') || d >= 3 ? 1 : 0
      break
    default:
      S = has('forca') ? Math.min(2, d - 1) : 0
  }
  S = Math.min(S, STRENGTH_CAP[i.level])
  const rest = d - S
  let C = 0
  let M = 0
  if (main === 'mobilitat' || main === 'flexibilitat') {
    C = cardioGoal ? Math.min(1, Math.max(0, rest - 1)) : 0
    M = rest - C
  } else if (cardioGoal) {
    C = rest
  } else {
    M = rest
  }

  // Intercala els tipus perquè la força no caigui en dies seguits si es pot evitar
  const counts: Record<'forca' | 'z2' | 'mob', number> = { forca: S, z2: C, mob: M }
  const seq: SlotType[] = []
  while (seq.length < d) {
    const last = seq.at(-1)
    const opts = (['forca', 'z2', 'mob'] as const).filter((t) => counts[t] > 0)
    const pool = opts.filter((t) => t !== last)
    const pick = (pool.length ? pool : opts).sort((a, b) => counts[b] - counts[a])[0]
    counts[pick]--
    seq.push(pick)
  }
  return seq
}

function intervalsAllowed(i: GeneratorInputs, week: number) {
  const main = mainGoalOf(i)
  if (i.parqFlag) return false
  if (main !== 'resistencia' && main !== 'perdua_greix') return false
  if (i.level === 'principiant' && week < 9) return false
  return true
}

// --------------------------------------------------------------------
// Selecció d'exercicis
// --------------------------------------------------------------------
const PREFS = {
  SQ_A: [1, 2, 13],
  SQ_B: [2, 21, 44, 13],
  HI_A: [22, 3, 15, 14],
  HI_B: [4, 25, 15, 14],
  PH_A: [5, 16, 6, 18],
  PH_B: [16, 6, 18],
  PV: [7, 17],
  PL_H: [8, 20, 19],
  PL_V: [9, 10],
  CORE_A: [11, 24],
  CORE_B: [23, 24],
}
type PrefKey = keyof typeof PREFS

const FULL_A: PrefKey[][] = [['SQ_A'], ['PH_A'], ['HI_A'], ['PL_H'], ['CORE_A'], ['PV']]
const FULL_B: PrefKey[][] = [['HI_B'], ['PV', 'PH_B'], ['SQ_B'], ['PL_V', 'PL_H'], ['CORE_B'], ['PH_B']]
const TORSO_A: PrefKey[][] = [['PH_A'], ['PL_H'], ['PV'], ['PL_V', 'PL_H'], ['CORE_A'], ['PH_B']]
const TORSO_B: PrefKey[][] = [['PV', 'PH_B'], ['PL_V', 'PL_H'], ['PH_B'], ['PL_H'], ['CORE_B'], ['PH_A']]
const LEGS_A: PrefKey[][] = [['SQ_A'], ['HI_A'], ['SQ_B'], ['HI_B'], ['CORE_B'], ['CORE_A']]
const LEGS_B: PrefKey[][] = [['HI_A'], ['SQ_A'], ['HI_B'], ['SQ_B'], ['CORE_A'], ['CORE_B']]

function pickFrom(keys: PrefKey[], ctx: Ctx, used: Set<number>): CatalogExercise | null {
  for (const k of keys) {
    let prefs = PREFS[k]
    // Flexions: si costen (o 60+), primer les inclinades
    if (ctx.weakPush) prefs = prefs.map((n) => (n === 6 ? 18 : n === 18 ? 6 : n))
    for (const n of prefs) {
      const e = ex(n)
      if (!used.has(n) && available(e, ctx.i.equipment, ctx.i.level)) return e
    }
  }
  return null
}

const MOB_TARGET_EX: Record<string, number[]> = { maluc: [31, 35], toracica: [32, 34], turmell: [33], espatlla: [36] }
const FLEX_TARGET_EX: Record<string, number> = { isquios: 37, flexors: 38, pectoral: 39, panxells: 40, glutis: 41 }

function mobilityTargets(results?: Record<string, unknown>): string[] {
  const order = ['maluc', 'toracica', 'turmell', 'espatlla']
  const r = results ?? {}
  const front: string[] = []
  if (typeof r.kneeWallCm === 'number' && r.kneeWallCm < 10) front.push('turmell')
  if (typeof r.squat === 'number' && r.squat <= 1) front.push('maluc', 'toracica')
  return [...new Set([...front, ...order])]
}

function flexTargets(results?: Record<string, unknown>): string[] {
  const order = ['isquios', 'flexors', 'pectoral', 'panxells', 'glutis']
  const r = results ?? {}
  return typeof r.sitReachCm === 'number' && r.sitReachCm < 0 ? order : ['flexors', 'isquios', 'pectoral', 'glutis', 'panxells']
}

// --------------------------------------------------------------------
// Context i paràmetres
// --------------------------------------------------------------------
type Ctx = {
  i: GeneratorInputs
  main: GoalType
  senior: boolean
  weakPush: boolean
  has: (g: GoalType) => boolean
}

type WeekInfo = { week: number; meso: number; wim: number; deload: boolean; progress: number }

function weekInfo(week: number): WeekInfo {
  const meso = Math.ceil(week / WEEKS_PER_MESO)
  const wim = ((week - 1) % WEEKS_PER_MESO) + 1
  // setmanes de càrrega completades abans d'aquesta (per a la progressió del cardio)
  const progress = week - 1 - Math.floor((week - 1) / WEEKS_PER_MESO)
  return { week, meso, wim, deload: wim === WEEKS_PER_MESO, progress }
}

function rx(e: CatalogExercise, block: Block, p: Partial<Prescription>): Prescription {
  return {
    id: uuid(),
    exercise: { id: e.id, name: e.name, cue: e.cue },
    block,
    track: e.track,
    sets: 2,
    restS: 60,
    ...p,
  }
}

function strengthParams(ctx: Ctx, w: WeekInfo, e: CatalogExercise, isMain: boolean, heavy: boolean): Partial<Prescription> {
  const lvl: LevelId = ctx.i.parqFlag ? 'principiant' : ctx.i.level
  const waveRir = lvl === 'principiant' ? [3, 2, 2] : lvl === 'intermedi' ? [3, 2, 1] : [2, 1, 1]
  // la setmana 4 (descàrrega) parteix del valor de la setmana 3 i després passa a RIR 4
  let rir = lvl === 'avancat' ? waveRir[w.meso - 1] : waveRir[Math.min(w.wim, 3) - 1]
  let p: Partial<Prescription>

  if (e.track === 'time') {
    const base = lvl === 'principiant' ? 30 : lvl === 'intermedi' ? 40 : 45
    const dur = Math.min(90, base + 5 * (w.deload ? 0 : w.wim - 1) + 10 * (w.meso - 1))
    p = { sets: 3, durationS: dur, restS: 60 }
  } else if (e.track === 'reps') {
    p = { sets: 3, repsMin: 8, repsMax: 15, rirTarget: rir, restS: 90 }
  } else if (lvl === 'principiant') {
    p = { sets: 3, repsMin: 8, repsMax: 12, rirTarget: rir, restS: isMain ? 120 : 90 }
  } else if (lvl === 'intermedi') {
    p =
      isMain && heavy
        ? { sets: 4, repsMin: 4, repsMax: 6, rirTarget: rir, restS: 180 }
        : { sets: 3, repsMin: 8, repsMax: 12, rirTarget: rir, restS: isMain ? 120 : 90 }
  } else {
    const blocks: [number, number, number, number][] = [
      [4, 6, 8, 180],
      [5, 3, 5, 210],
      [3, 1, 3, 240],
    ]
    const [s, a, b, r] = blocks[w.meso - 1]
    p = isMain ? { sets: s, repsMin: a, repsMax: b, rirTarget: rir, restS: r } : { sets: 3, repsMin: 8, repsMax: 10, rirTarget: rir, restS: 90 }
  }

  // Ona de volum: la setmana 3 suma una sèrie als bàsics (no principiants)
  if (!w.deload && w.wim === 3 && isMain && lvl !== 'principiant' && p.sets) p.sets += 1
  // 60+: primeres 4 setmanes amb 2 sèries i RIR 3
  if (ctx.senior && w.week <= 4) {
    p.sets = 2
    if (p.rirTarget != null) rir = Math.max(rir, 3)
  }
  if (p.rirTarget != null) p.rirTarget = ctx.i.parqFlag ? Math.max(rir, 3) : rir
  // Descàrrega: ~55 % de les sèries i RIR 4
  if (w.deload) {
    p.sets = Math.max(2, Math.round((p.sets ?? 3) * 0.55))
    if (p.rirTarget != null) p.rirTarget = 4
  }
  return p
}

function warmup(ctx: Ctx, w: WeekInfo, order: number, mobCount: number): Prescription[] {
  const out: Prescription[] = []
  const targets = mobilityTargets(ctx.i.results)
  for (let k = 0; k < mobCount; k++) {
    const t = targets[(order + k) % targets.length]
    const opts = MOB_TARGET_EX[t]
    const e = ex(opts[order % opts.length])
    const reps = w.meso >= 2 ? 10 : 8
    out.push(rx(e, 'escalfament', { sets: 2, repsMin: reps, repsMax: reps, restS: 20 }))
  }
  if (ctx.senior) {
    const dur = 20 + 5 * (w.meso - 1)
    for (const n of [42, 43]) out.push(rx(ex(n), 'escalfament', { sets: w.meso === 3 ? 3 : 2, durationS: dur, restS: 30 }))
  }
  return out
}

function cooldown(ctx: Ctx, w: WeekInfo, order: number, count: number): Prescription[] {
  const targets = flexTargets(ctx.i.results)
  const out: Prescription[] = []
  for (let k = 0; k < count; k++) {
    const e = ex(FLEX_TARGET_EX[targets[(order + k) % targets.length]])
    out.push(rx(e, 'calma', { sets: w.meso === 3 ? 3 : 2, durationS: 30, restS: 15 }))
  }
  return out
}

// --------------------------------------------------------------------
// Constructors de sessions
// --------------------------------------------------------------------
function strengthSession(ctx: Ctx, w: WeekInfo, order: number, strengthIndex: number, split: 'full' | 'tl') {
  let layout: PrefKey[][]
  let title: string
  let heavy: boolean
  if (split === 'full') {
    const A = strengthIndex % 2 === 0
    layout = A ? FULL_A : FULL_B
    heavy = A
    title = `Força ${A ? 'A' : 'B'} · cos sencer`
    if (ctx.i.level === 'intermedi' && !ctx.i.parqFlag) title += A ? ' · dia pesat' : ' · dia de volum'
  } else {
    const k = strengthIndex % 4
    layout = [TORSO_A, LEGS_A, TORSO_B, LEGS_B][k]
    heavy = k < 2
    title = ['Força · tors A', 'Força · cames A', 'Força · tors B', 'Força · cames B'][k]
  }
  const n = EXERCISES_BY_MINUTES(ctx.i.minutes)
  const used = new Set<number>()
  const main: Prescription[] = []
  for (const keys of layout) {
    if (main.length >= n) break
    const e = pickFrom(keys, ctx, used)
    if (!e) continue
    used.add(e.n)
    main.push(rx(e, 'principal', strengthParams(ctx, w, e, main.length < 2, heavy)))
  }
  const prescriptions = [
    ...warmup(ctx, w, order, ctx.has('mobilitat') ? 2 : 1),
    ...main,
    ...cooldown(ctx, w, order, ctx.has('flexibilitat') ? 2 : 0),
  ]
  return { title, kind: 'forca' as const, prescriptions }
}

function lowImpact(ctx: Ctx) {
  return ctx.senior || ctx.i.parqFlag || ctx.main === 'forca' || ctx.main === 'mobilitat' || ctx.main === 'flexibilitat'
}

function cardioExercise(ctx: Ctx, order: number): CatalogExercise {
  const hasMachine = ctx.i.equipment.includes('cardio')
  if (lowImpact(ctx)) return hasMachine ? ex(order % 2 === 0 ? 28 : 29) : ex(26)
  if (ctx.main === 'resistencia') return ctx.i.level === 'principiant' ? ex(30) : ex(27)
  return ctx.i.level === 'principiant' ? ex(26) : ex(27)
}

function z2Session(ctx: Ctx, w: WeekInfo, order: number) {
  const e = cardioExercise(ctx, order)
  let main: Prescription
  if (e.n === 30) {
    // Caminar i córrer: blocs de carrera que s'allarguen cada setmana
    const run = Math.min(600, 120 + 30 * w.progress)
    main = rx(e, 'principal', { sets: w.deload ? 4 : 6, durationS: run, hrZone: 2, restS: 120, note: 'Recuperació caminant' })
  } else {
    const base = ctx.i.level === 'principiant' ? 25 : ctx.i.level === 'intermedi' ? 35 : 45
    const cap = Math.max(20, ctx.i.minutes - 10)
    let min = Math.min(cap, Math.round(base * Math.pow(1.07, w.progress)))
    if (w.deload) min = Math.round(min * 0.7)
    main = rx(e, 'principal', { sets: 1, durationS: min * 60, hrZone: 2, restS: 0 })
  }
  return {
    title: e.n === 30 ? 'Caminar i córrer' : 'Cardio suau · zona 2',
    kind: 'cardio' as const,
    prescriptions: [...warmup(ctx, w, order, 1), main, ...cooldown(ctx, w, order, ctx.has('flexibilitat') ? 2 : 1)],
  }
}

function intervalSession(ctx: Ctx, w: WeekInfo, order: number) {
  const hasMachine = ctx.i.equipment.includes('cardio')
  if (lowImpact(ctx) && !hasMachine) return z2Session(ctx, w, order)
  const e = lowImpact(ctx) ? ex(order % 2 === 0 ? 28 : 29) : ex(27)
  let main: Prescription
  if (ctx.main === 'resistencia') {
    const base = ctx.i.level === 'avancat' ? 5 : 4
    const reps = w.deload ? base - 1 : Math.min(8, base + (w.wim - 1) + (w.meso - 1))
    main = rx(e, 'principal', { sets: reps, durationS: 240, hrZone: 4, restS: 180, note: 'Recuperació en zona 1' })
  } else {
    const reps = w.deload ? 5 : Math.min(10, 6 + (w.wim - 1) + (w.meso - 1))
    main = rx(e, 'principal', { sets: reps, durationS: 30, hrZone: 4, restS: 90, note: 'Recuperació suau' })
  }
  const warm = rx(e, 'escalfament', { sets: 1, durationS: 300, hrZone: 1, restS: 0, note: 'Escalfament suau' })
  return {
    title: 'Intervals',
    kind: 'cardio' as const,
    prescriptions: [...warmup(ctx, w, order, 1), warm, main, ...cooldown(ctx, w, order, ctx.has('flexibilitat') ? 2 : 1)],
  }
}

function mobSession(ctx: Ctx, w: WeekInfo, mobIndex: number) {
  const both = ctx.has('mobilitat') && ctx.has('flexibilitat')
  const flexFocus = both ? mobIndex % 2 === 1 : ctx.main === 'flexibilitat' || (!ctx.has('mobilitat') && ctx.has('flexibilitat'))
  const reps = w.meso >= 2 ? 10 : 8
  const drills = mobilityTargets(ctx.i.results).map((t) => ex(MOB_TARGET_EX[t][mobIndex % MOB_TARGET_EX[t].length]))
  const mob = drills.map((e) => rx(e, 'principal', { sets: 2, repsMin: reps, repsMax: reps, restS: 20 }))
  const stretchCount = flexFocus ? 5 : 3
  const flexSets = (w.meso === 3 ? 3 : 2) + (flexFocus ? 1 : 0)
  const stretches = flexTargets(ctx.i.results)
    .slice(0, stretchCount)
    .map((t) => rx(ex(FLEX_TARGET_EX[t]), flexFocus ? 'principal' : 'calma', { sets: flexSets, durationS: 30, restS: 15 }))
  const balance = ctx.senior
    ? [42, 43].map((n) => rx(ex(n), 'principal', { sets: w.meso === 3 ? 3 : 2, durationS: 20 + 5 * (w.meso - 1), restS: 30 }))
    : []
  return {
    title: flexFocus ? 'Flexibilitat' : 'Mobilitat',
    kind: (flexFocus ? 'flexibilitat' : 'mobilitat') as PlannedSession['kind'],
    prescriptions: flexFocus ? [...mob.slice(0, 2), ...balance, ...stretches] : [...mob, ...balance, ...stretches],
  }
}

// --------------------------------------------------------------------
// Generador principal
// --------------------------------------------------------------------
export function generatePlan(i: GeneratorInputs): Plan {
  const ctx: Ctx = {
    i,
    main: mainGoalOf(i),
    senior: isSenior(i.ageRange),
    weakPush:
      isSenior(i.ageRange) || (typeof i.results?.pushups === 'number' ? (i.results.pushups as number) < 10 : i.level === 'principiant'),
    has: (g) => i.goals.some((x) => x.type === g),
  }
  const slots = weeklySlots(i)
  const offsets = DAY_OFFSETS[slots.length]
  const strengthPerWeek = slots.filter((s) => s === 'forca').length
  const split: 'full' | 'tl' = i.level !== 'principiant' && strengthPerWeek >= 4 ? 'tl' : 'full'

  const mesocycles = (['acumulacio', 'intensificacio', 'realitzacio'] as const).map((phase, k) => ({
    id: uuid(),
    position: k + 1,
    phase,
    weeks: WEEKS_PER_MESO,
  }))

  const sessions: PlannedSession[] = []
  let order = 0
  let strengthIndex = 0
  let mobIndex = 0
  for (let week = 1; week <= PLAN_WEEKS; week++) {
    const w = weekInfo(week)
    const weekSlots = [...slots]
    if (intervalsAllowed(i, week)) {
      const lastZ2 = weekSlots.lastIndexOf('z2')
      // sempre queda almenys una sessió de zona 2
      if (lastZ2 >= 0 && weekSlots.filter((s) => s === 'z2').length >= 2) weekSlots[lastZ2] = 'intervals'
    }
    weekSlots.forEach((slot, k) => {
      const built =
        slot === 'forca'
          ? strengthSession(ctx, w, order, strengthIndex++, split)
          : slot === 'z2'
            ? z2Session(ctx, w, order)
            : slot === 'intervals'
              ? intervalSession(ctx, w, order)
              : mobSession(ctx, w, mobIndex++)
      sessions.push({
        id: uuid(),
        ...built,
        focus: `Setmana ${week} de ${PLAN_WEEKS} · ${w.deload ? 'descàrrega' : `mesocicle ${w.meso}`}`,
        week,
        mesocycle: w.meso,
        deload: w.deload,
        date: addDays(i.startDate, 7 * (week - 1) + offsets[k]),
        order: order++,
      })
    })
  }

  return { id: uuid(), createdAt: new Date().toISOString(), startDate: i.startDate, weeks: PLAN_WEEKS, inputs: i, mesocycles, sessions }
}

