import type { Exercise, PlannedSession } from '../lib/types'

// Exercicis de la biblioteca inicial (mateixos UUID que supabase/seed.sql)
const EX = {
  sentadilla: { id: '0e5a0000-0000-4000-8000-000000000001', name: 'Sentadilla amb barra', cue: 'Peus a l’amplada de les espatlles, genolls en la línia dels peus, baixa fins que el maluc passi el genoll.' },
  pesMortRomanes: { id: '0e5a0000-0000-4000-8000-000000000003', name: 'Pes mort romanès', cue: 'Esquena neutra, maluc enrere, barra a frec de les cames. Para quan notis tensió als isquiotibials.' },
  pressBanca: { id: '0e5a0000-0000-4000-8000-000000000005', name: 'Press de banca', cue: 'Escàpules juntes i avall, peus fixos, barra al pit a l’altura de l’estèrnum.' },
  remManuella: { id: '0e5a0000-0000-4000-8000-000000000008', name: 'Rem amb manuella', cue: 'Esquena paral·lela al terra, porta el colze cap al maluc sense girar el tronc.' },
  planxa: { id: '0e5a0000-0000-4000-8000-000000000011', name: 'Planxa frontal', cue: 'Cos recte del cap als talons, abdomen i glutis actius. No deixis caure el maluc.' },
} satisfies Record<string, Exercise>

export const demoSession: PlannedSession = {
  id: 'demo-forca-a',
  title: 'Força A',
  kind: 'forca',
  focus: 'Cos sencer · setmana 1 de 4',
  prescriptions: [
    { id: 'p1', exercise: EX.sentadilla, sets: 3, repsMin: 6, repsMax: 8, loadKg: 60, rirTarget: 2, restS: 150 },
    { id: 'p2', exercise: EX.pressBanca, sets: 3, repsMin: 6, repsMax: 8, loadKg: 50, rirTarget: 2, restS: 150 },
    { id: 'p3', exercise: EX.pesMortRomanes, sets: 3, repsMin: 8, repsMax: 10, loadKg: 50, rirTarget: 2, restS: 120 },
    { id: 'p4', exercise: EX.remManuella, sets: 3, repsMin: 10, repsMax: 12, loadKg: 20, rirTarget: 2, restS: 90 },
    { id: 'p5', exercise: EX.planxa, sets: 3, durationS: 40, restS: 60 },
  ],
}
