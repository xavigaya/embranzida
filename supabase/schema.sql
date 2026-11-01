-- =====================================================================
-- Embranzida · Esquema de base de dades (Supabase / PostgreSQL)
-- Versió 0.1 · 2026-11-01
--
-- Com aplicar-lo: Supabase → SQL Editor → enganxa tot el fitxer → Run.
-- Requisit previ: Authentication → Sign In / Providers → activar
-- "Allow anonymous sign-ins".
--
-- Principis:
--  · Pseudonimització: cap taula guarda nom real ni correu.
--  · Cada fila d'usuari porta user_id i Row Level Security (RLS)
--    garanteix que només el seu propietari la pot llegir o modificar.
--  · Preparat per treballar sense connexió: UUID generats al mòbil,
--    updated_at per sincronitzar i deleted_at (esborrat lògic).
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Funció comuna: actualitzar updated_at automàticament
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 1. Perfil (1 per usuari)
-- ---------------------------------------------------------------------
create table public.profiles (
  user_id             uuid primary key references auth.users (id) on delete cascade,
  alias               text not null check (char_length(alias) between 2 and 30),
  age_range           text check (age_range in ('<18','18-29','30-39','40-49','50-59','60-69','70+')),
  sex                 text check (sex in ('home','dona','altre','no_ho_dic')),
  height_cm           numeric(5,1) check (height_cm between 100 and 250),
  level               text check (level in ('principiant','intermedi','avancat')),
  days_per_week       smallint check (days_per_week between 1 and 7),
  minutes_per_session smallint check (minutes_per_session between 10 and 240),
  equipment           text[] not null default '{}',
  limitations         text,
  consent_version     text not null,
  consent_at          timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

-- ---------------------------------------------------------------------
-- 2. Valoracions (PAR-Q+ i tests inicials/periòdics)
-- ---------------------------------------------------------------------
create table public.assessments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  taken_at    timestamptz not null default now(),
  kind        text not null check (kind in ('inicial','periodica')),
  parq        jsonb,            -- respostes del PAR-Q+
  parq_flag   boolean not null default false,  -- true = recomanar consulta sanitària
  results     jsonb not null default '{}',     -- {"1rm_est":{"sentadilla":80}, "cooper_m":2400, ...}
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- ---------------------------------------------------------------------
-- 3. Objectius
-- ---------------------------------------------------------------------
create table public.goals (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  type         text not null check (type in ('forca','perdua_greix','resistencia','mobilitat','flexibilitat')),
  priority     smallint not null default 1 check (priority between 1 and 5),
  target_date  date,
  target       jsonb,           -- p. ex. {"metrica":"pes_kg","valor":75}
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

-- ---------------------------------------------------------------------
-- 4. Biblioteca d'exercicis
--    · is_public = true  → exercici de la base oberta, visible per a tothom
--    · owner_id         → exercici personalitzat d'un usuari
-- ---------------------------------------------------------------------
create table public.exercises (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid references auth.users (id) on delete cascade,
  is_public         boolean not null default false,
  name              text not null,
  modality          text not null check (modality in ('forca','cardio','mobilitat','flexibilitat')),
  movement_pattern  text check (movement_pattern in
                      ('sentadilla','frontissa','empenta_horitzontal','empenta_vertical',
                       'estirada_horitzontal','estirada_vertical','core','carregada',
                       'locomocio','altre')),
  muscle_groups     text[] not null default '{}',
  equipment         text[] not null default '{}',
  instructions      text,
  media_url         text,
  variant_of        uuid references public.exercises (id) on delete set null,
  source            text,       -- base oberta d'origen
  license           text,       -- llicència de text i imatges (p. ex. CC BY-SA 4.0)
  attribution       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  deleted_at        timestamptz,
  check (is_public or owner_id is not null)
);

-- ---------------------------------------------------------------------
-- 5. Pla (macrocicle) i relació amb objectius
-- ---------------------------------------------------------------------
create table public.plans (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null,
  mode        text not null check (mode in ('automatic','manual')),
  status      text not null default 'actiu' check (status in ('esborrany','actiu','completat','arxivat')),
  start_date  date not null,
  weeks       smallint not null check (weeks between 1 and 52),
  generator   jsonb,            -- versió de plantilla i regles que l'han generat
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

-- Només un pla actiu per usuari
create unique index plans_one_active_per_user
  on public.plans (user_id) where status = 'actiu' and deleted_at is null;

create table public.plan_goals (
  plan_id     uuid not null references public.plans (id) on delete cascade,
  goal_id     uuid not null references public.goals (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  weight      numeric(4,2) not null default 1,  -- repartiment del volum entre objectius
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (plan_id, goal_id)
);

-- ---------------------------------------------------------------------
-- 6. Mesocicles
-- ---------------------------------------------------------------------
create table public.mesocycles (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references public.plans (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  position    smallint not null,
  phase       text not null check (phase in ('acumulacio','intensificacio','realitzacio','descarrega','transicio')),
  weeks       smallint not null check (weeks between 1 and 8),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  unique (plan_id, position)
);

-- ---------------------------------------------------------------------
-- 7. Sessions previstes i prescripcions
-- ---------------------------------------------------------------------
create table public.planned_sessions (
  id              uuid primary key default gen_random_uuid(),
  mesocycle_id    uuid not null references public.mesocycles (id) on delete cascade,
  user_id         uuid not null references auth.users (id) on delete cascade,
  week            smallint not null,
  day_of_week     smallint check (day_of_week between 1 and 7),
  scheduled_date  date,
  kind            text not null check (kind in ('forca','cardio','mobilitat','flexibilitat','mixta')),
  title           text not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create table public.prescriptions (
  id                  uuid primary key default gen_random_uuid(),
  planned_session_id  uuid not null references public.planned_sessions (id) on delete cascade,
  user_id             uuid not null references auth.users (id) on delete cascade,
  exercise_id         uuid not null references public.exercises (id),
  position            smallint not null,
  sets                smallint check (sets between 1 and 20),
  reps_min            smallint check (reps_min between 1 and 100),
  reps_max            smallint check (reps_max between 1 and 100),
  load_kg             numeric(6,2) check (load_kg >= 0),
  pct_1rm             numeric(5,2) check (pct_1rm between 0 and 110),
  rir_target          smallint check (rir_target between 0 and 5),
  rest_s              smallint check (rest_s between 0 and 900),
  duration_s          integer check (duration_s >= 0),
  distance_m          integer check (distance_m >= 0),
  hr_zone             smallint check (hr_zone between 1 and 5),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz,
  check (reps_max is null or reps_min is null or reps_max >= reps_min)
);

-- ---------------------------------------------------------------------
-- 8. Registres reals (el que s'ha fet)
-- ---------------------------------------------------------------------
create table public.session_logs (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id) on delete cascade,
  planned_session_id  uuid references public.planned_sessions (id) on delete set null,
  started_at          timestamptz not null,
  ended_at            timestamptz,
  session_rpe         smallint check (session_rpe between 1 and 10),
  avg_hr              smallint check (avg_hr between 30 and 230),
  feeling             smallint check (feeling between 1 and 5),
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);

create table public.set_logs (
  id               uuid primary key default gen_random_uuid(),
  session_log_id   uuid not null references public.session_logs (id) on delete cascade,
  user_id          uuid not null references auth.users (id) on delete cascade,
  exercise_id      uuid not null references public.exercises (id),
  prescription_id  uuid references public.prescriptions (id) on delete set null,
  set_index        smallint not null,
  load_kg          numeric(6,2) check (load_kg >= 0),
  reps             smallint check (reps between 0 and 200),
  rpe              numeric(3,1) check (rpe between 1 and 10),
  rir              smallint check (rir between 0 and 10),
  duration_s       integer check (duration_s >= 0),
  distance_m       integer check (distance_m >= 0),
  completed_at     timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

-- ---------------------------------------------------------------------
-- 9. Mesures corporals (les fotos queden al mòbil: només una referència local)
-- ---------------------------------------------------------------------
create table public.body_measurements (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  measured_at      timestamptz not null default now(),
  weight_kg        numeric(5,2) check (weight_kg between 20 and 400),
  waist_cm         numeric(5,1),
  hip_cm           numeric(5,1),
  chest_cm         numeric(5,1),
  arm_cm           numeric(5,1),
  thigh_cm         numeric(5,1),
  body_fat_pct     numeric(4,1) check (body_fat_pct between 2 and 70),
  resting_hr       smallint check (resting_hr between 25 and 150),
  photo_local_ref  text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  deleted_at       timestamptz
);

-- ---------------------------------------------------------------------
-- 10. Estat diari (escala 1–5)
-- ---------------------------------------------------------------------
create table public.daily_status (
  user_id     uuid not null references auth.users (id) on delete cascade,
  day         date not null,
  sleep       smallint check (sleep between 1 and 5),
  fatigue     smallint check (fatigue between 1 and 5),
  soreness    smallint check (soreness between 1 and 5),
  mood        smallint check (mood between 1 and 5),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz,
  primary key (user_id, day)
);

-- ---------------------------------------------------------------------
-- 11. Regles de progressió (compartides i versionades; només lectura per a usuaris)
-- ---------------------------------------------------------------------
create table public.progression_rules (
  id          uuid primary key default gen_random_uuid(),
  code        text not null,
  version     integer not null default 1,
  applies_to  text not null check (applies_to in ('forca','perdua_greix','resistencia','mobilitat','flexibilitat','general')),
  description text not null,
  conditions  jsonb not null,
  actions     jsonb not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (code, version)
);

-- ---------------------------------------------------------------------
-- Índexs per a consultes habituals i sincronització
-- ---------------------------------------------------------------------
create index on public.assessments       (user_id, taken_at desc);
create index on public.goals             (user_id) where deleted_at is null;
create index on public.exercises         (owner_id);
create index on public.exercises         (modality);
create index on public.plan_goals        (user_id);
create index on public.mesocycles        (user_id);
create index on public.planned_sessions  (user_id, scheduled_date);
create index on public.prescriptions     (planned_session_id, position);
create index on public.prescriptions     (user_id);
create index on public.session_logs      (user_id, started_at desc);
create index on public.set_logs          (session_log_id, set_index);
create index on public.set_logs          (user_id, exercise_id, completed_at desc);
create index on public.body_measurements (user_id, measured_at desc);

-- ---------------------------------------------------------------------
-- Triggers updated_at, índex de sincronització i RLS per a les taules d'usuari
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  user_tables text[] := array[
    'profiles','assessments','goals','plans','plan_goals','mesocycles',
    'planned_sessions','prescriptions','session_logs','set_logs',
    'body_measurements','daily_status'
  ];
begin
  foreach t in array user_tables loop
    execute format(
      'create trigger %1$s_set_updated_at before update on public.%1$I
         for each row execute function public.set_updated_at()', t);

    execute format(
      'create index %1$s_sync_idx on public.%1$I (user_id, updated_at)', t);

    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy "propietari_pot_tot" on public.%I
         for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
  end loop;
end;
$$;

-- Exercicis: públics visibles per a tothom; personalitzats només per al propietari
create trigger exercises_set_updated_at before update on public.exercises
  for each row execute function public.set_updated_at();

alter table public.exercises enable row level security;

create policy "exercicis_lectura" on public.exercises
  for select to authenticated
  using (is_public or owner_id = (select auth.uid()));

create policy "exercicis_propis_insercio" on public.exercises
  for insert to authenticated
  with check (owner_id = (select auth.uid()) and not is_public);

create policy "exercicis_propis_modificacio" on public.exercises
  for update to authenticated
  using (owner_id = (select auth.uid()) and not is_public)
  with check (owner_id = (select auth.uid()) and not is_public);

create policy "exercicis_propis_esborrat" on public.exercises
  for delete to authenticated
  using (owner_id = (select auth.uid()) and not is_public);

-- Regles de progressió: lectura per a usuaris; escriptura només des del panell de Supabase
create trigger progression_rules_set_updated_at before update on public.progression_rules
  for each row execute function public.set_updated_at();

alter table public.progression_rules enable row level security;

create policy "regles_lectura" on public.progression_rules
  for select to authenticated
  using (active);

-- ---------------------------------------------------------------------
-- Dret a l'esborrat: l'usuari elimina el seu compte i, en cascada,
-- totes les seves dades.
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Cal haver iniciat sessió';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
