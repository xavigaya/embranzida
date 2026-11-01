// Genera supabase/seed.sql a partir de src/data/exercises.json
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const list = JSON.parse(readFileSync(resolve(here, '../src/data/exercises.json'), 'utf8'))
const id = (n) => `0e5a0000-0000-4000-8000-${String(n).padStart(12, '0')}`
const q = (s) => (s == null ? 'null' : `'${String(s).replace(/'/g, "''")}'`)
const arr = (a) => `'{${(a ?? []).map((x) => `"${x.replace(/"/g, '')}"`).join(',')}}'`

const rows = list.map(
  (e) =>
    `  (${q(id(e.n))}, true, ${q(e.name)}, ${q(e.modality)}, ${q(e.pattern)},\n   ${arr(e.muscles)}, ${arr(e.needs ?? e.needsAny ?? [])}, ${q(e.cue)}, 'Embranzida', 'pròpia')`,
)

const sql = `-- =====================================================================
-- Embranzida · Biblioteca d'exercicis (${list.length} exercicis)
-- FITXER GENERAT amb \`npm run seed\` a partir de app/src/data/exercises.json.
-- No l'editis a mà: edita el JSON i torna'l a generar.
-- Executar al SQL Editor de Supabase després de schema.sql.
-- Es pot tornar a executar: actualitza els exercicis existents.
-- =====================================================================

insert into public.exercises
  (id, is_public, name, modality, movement_pattern, muscle_groups, equipment, instructions, source, license)
values
${rows.join(',\n')}
on conflict (id) do update set
  name = excluded.name, modality = excluded.modality, movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups, equipment = excluded.equipment,
  instructions = excluded.instructions, is_public = excluded.is_public;
`
writeFileSync(resolve(here, '../../supabase/seed.sql'), sql)
console.log(`seed.sql generat amb ${list.length} exercicis`)
