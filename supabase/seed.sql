-- =====================================================================
-- Embranzida · Biblioteca inicial d'exercicis (provisional)
-- Executar al SQL Editor de Supabase DESPRÉS de schema.sql.
-- Es pot tornar a executar: actualitza els exercicis existents.
-- Més endavant se substituirà o s'ampliarà amb una base oberta.
-- =====================================================================

insert into public.exercises
  (id, is_public, name, modality, movement_pattern, muscle_groups, equipment, instructions, source, license)
values
  ('0e5a0000-0000-4000-8000-000000000001', true, 'Sentadilla amb barra', 'forca', 'sentadilla',
   '{quàdriceps,glutis,adductors}', '{barra,rack}',
   'Peus a l''amplada de les espatlles, genolls en la línia dels peus, baixa fins que el maluc passi el genoll.', 'Embranzida', 'pròpia'),
  ('0e5a0000-0000-4000-8000-000000000002', true, 'Sentadilla goblet', 'forca', 'sentadilla',
   '{quàdriceps,glutis}', '{manuella,kettlebell}',
   'Pes davant del pit, colzes per dins dels genolls, tronc vertical.', 'Embranzida', 'pròpia'),
  ('0e5a0000-0000-4000-8000-000000000003', true, 'Pes mort romanès', 'forca', 'frontissa',
   '{isquiotibials,glutis,lumbars}', '{barra}',
   'Esquena neutra, maluc enrere, barra a frec de les cames. Para quan notis tensió als isquiotibials.', 'Embranzida', 'pròpia'),
  ('0e5a0000-0000-4000-8000-000000000004', true, 'Hip thrust', 'forca', 'frontissa',
   '{glutis,isquiotibials}', '{barra,banc}',
   'Esquena recolzada al banc, empeny amb els talons i bloqueja amb els glutis a dalt.', 'Embranzida', 'pròpia'),
  ('0e5a0000-0000-4000-8000-000000000005', true, 'Press de banca', 'forca', 'empenta_horitzontal',
   '{pectoral,tríceps,deltoide anterior}', '{barra,banc}',
   'Escàpules juntes i avall, peus fixos, barra al pit a l''altura de l''estèrnum.', 'Embranzida', 'pròpia'),
  ('0e5a0000-0000-4000-8000-000000000006', true, 'Flexions', 'forca', 'empenta_horitzontal',
   '{pectoral,tríceps,core}', '{}',
   'Mans sota les espatlles, cos recte, baixa fins que el pit quasi toqui el terra.', 'Embranzida', 'pròpia'),
  ('0e5a0000-0000-4000-8000-000000000007', true, 'Press militar', 'forca', 'empenta_vertical',
   '{deltoides,tríceps}', '{barra}',
   'Glutis i abdomen actius, barra en línia recta per damunt del cap.', 'Embranzida', 'pròpia'),
  ('0e5a0000-0000-4000-8000-000000000008', true, 'Rem amb manuella', 'forca', 'estirada_horitzontal',
   '{dorsal,romboides,bíceps}', '{manuella,banc}',
   'Esquena paral·lela al terra, porta el colze cap al maluc sense girar el tronc.', 'Embranzida', 'pròpia'),
  ('0e5a0000-0000-4000-8000-000000000009', true, 'Dominades', 'forca', 'estirada_vertical',
   '{dorsal,bíceps}', '{barra fixa}',
   'Des de braços estirats, puja fins que la barbeta passi la barra sense balanceig.', 'Embranzida', 'pròpia'),
  ('0e5a0000-0000-4000-8000-000000000010', true, 'Jalon al pit', 'forca', 'estirada_vertical',
   '{dorsal,bíceps}', '{politja}',
   'Pit amunt, porta la barra fins a la part alta del pit amb els colzes cap avall.', 'Embranzida', 'pròpia'),
  ('0e5a0000-0000-4000-8000-000000000011', true, 'Planxa frontal', 'forca', 'core',
   '{abdominals,core}', '{}',
   'Cos recte del cap als talons, abdomen i glutis actius. No deixis caure el maluc.', 'Embranzida', 'pròpia'),
  ('0e5a0000-0000-4000-8000-000000000012', true, 'Passejada del granger', 'forca', 'carregada',
   '{avantbraços,trapezi,core}', '{manuella,kettlebell}',
   'Pes a cada mà, espatlles avall, camina amb passes curtes i tronc estable.', 'Embranzida', 'pròpia')
on conflict (id) do update set
  name = excluded.name, modality = excluded.modality, movement_pattern = excluded.movement_pattern,
  muscle_groups = excluded.muscle_groups, equipment = excluded.equipment,
  instructions = excluded.instructions, is_public = excluded.is_public;
