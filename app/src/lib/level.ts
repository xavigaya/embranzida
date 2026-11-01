// Classificació del nivell a partir de l'experiència i del test de flexions.
// Normes de flexions completes (sobre les puntes dels peus), per edat i sexe.
// Font: ACSM, Guidelines for Exercise Testing and Prescription, 11a ed. (2022),
// segons Topend Sports. PENDENT DE VERIFICAR amb el llibre original.

export type Level = 'principiant' | 'intermedi' | 'avancat'
export type Experience = 'menys_6m' | '6m_2a' | 'mes_2a'
export type PushCategory = 'molt_baixa' | 'per_sota' | 'mitjana' | 'per_sobre' | 'bona' | 'excellent'
export type Sex = 'home' | 'dona' | 'altre' | 'no_ho_dic'

type AgeBand = '17-19' | '20-29' | '30-39' | '40-49' | '50-59' | '60+'

// Mínim de repeticions per entrar a cada categoria:
// [per sota de la mitjana, mitjana, per sobre de la mitjana, bona, excel·lent]
const NORMS: Record<'home' | 'dona', Record<AgeBand, [number, number, number, number, number]>> = {
  home: {
    '17-19': [25, 31, 35, 47, 56],
    '20-29': [20, 24, 30, 39, 47],
    '30-39': [15, 20, 25, 34, 41],
    '40-49': [12, 16, 21, 28, 34],
    '50-59': [9, 13, 18, 25, 31],
    '60+': [6, 11, 17, 24, 30],
  },
  dona: {
    '17-19': [12, 18, 21, 27, 35],
    '20-29': [12, 17, 23, 30, 36],
    '30-39': [10, 14, 22, 30, 37],
    '40-49': [8, 11, 17, 24, 31],
    '50-59': [7, 10, 14, 21, 25],
    '60+': [3, 5, 12, 19, 23],
  },
}

const CATS: PushCategory[] = ['per_sota', 'mitjana', 'per_sobre', 'bona', 'excellent']

export const PUSH_LABEL: Record<PushCategory, string> = {
  molt_baixa: 'Molt per sota de la mitjana',
  per_sota: 'Per sota de la mitjana',
  mitjana: 'Mitjana',
  per_sobre: 'Per sobre de la mitjana',
  bona: 'Bona',
  excellent: 'Excel·lent',
}

export const LEVEL_LABEL: Record<Level, string> = {
  principiant: 'Principiant',
  intermedi: 'Intermedi',
  avancat: 'Avançat',
}

function ageBand(ageRange: string | null): AgeBand {
  switch (ageRange) {
    case '<18':
      return '17-19'
    case '30-39':
    case '40-49':
    case '50-59':
      return ageRange
    case '60-69':
    case '70+':
      return '60+'
    default:
      return '20-29' // 18-29 o desconeguda (la més exigent: criteri prudent)
  }
}

// Sexe "altre" o "no ho dic" → normes de dones (més baixes: criteri prudent)
export function pushCategory(reps: number, sex: Sex | null, ageRange: string | null): PushCategory {
  const table = NORMS[sex === 'home' ? 'home' : 'dona'][ageBand(ageRange)]
  let cat: PushCategory = 'molt_baixa'
  table.forEach((min, i) => {
    if (reps >= min) cat = CATS[i]
  })
  return cat
}

const ORDER: Level[] = ['principiant', 'intermedi', 'avancat']
const minLevel = (a: Level, b: Level) => ORDER[Math.min(ORDER.indexOf(a), ORDER.indexOf(b))]

export type LevelInput = {
  experience: Experience
  pushups?: number | null
  sex: Sex | null
  ageRange: string | null
  barbellTechnique?: boolean
}

export type LevelResult = { level: Level; pushCat: PushCategory | null; reasons: string[] }

export function computeLevel(i: LevelInput): LevelResult {
  const reasons: string[] = []
  const byExp: Level = i.experience === 'menys_6m' ? 'principiant' : i.experience === '6m_2a' ? 'intermedi' : 'avancat'

  let byTest: Level
  let pushCat: PushCategory | null = null
  if (i.pushups == null) {
    byTest = 'intermedi'
    if (byExp === 'avancat') reasons.push('Sense test de flexions, el nivell màxim és intermedi.')
  } else {
    pushCat = pushCategory(i.pushups, i.sex, i.ageRange)
    byTest =
      pushCat === 'molt_baixa' || pushCat === 'per_sota'
        ? 'principiant'
        : pushCat === 'mitjana' || pushCat === 'per_sobre'
          ? 'intermedi'
          : 'avancat'
  }

  let level = minLevel(byExp, byTest)
  if (level === 'avancat' && !i.barbellTechnique) {
    level = 'intermedi'
    reasons.push('Per al nivell avançat cal dominar la tècnica dels bàsics amb barra.')
  }
  if (pushCat && ORDER.indexOf(byTest) < ORDER.indexOf(byExp)) {
    reasons.push('El test de flexions indica un nivell més baix que l’experiència declarada.')
  }
  return { level, pushCat, reasons }
}
