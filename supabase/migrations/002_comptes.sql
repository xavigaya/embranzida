-- =====================================================================
-- Embranzida · Migració 002: activitat dels comptes i neteja automàtica
-- Executar al SQL Editor de Supabase (després de schema.sql).
-- Es pot tornar a executar sense problemes.
--
-- Requisit: activar l'extensió pg_cron
--   Database → Extensions → pg_cron → Enable
-- =====================================================================

-- 1. Darrera activitat de cada usuari (l'app l'actualitza com a molt un cop al dia)
alter table public.profiles
  add column if not exists last_seen_at timestamptz not null default now();

-- 2. Neteja de comptes abandonats
--    · Comptes anònims (sense correu) sense activitat durant 6 mesos
--    · Comptes amb correu vinculat sense activitat durant 24 mesos
--    · Usuaris sense perfil (alta a mitges) creats fa més de 7 dies
--    En esborrar l'usuari d'auth.users, s'esborren en cascada totes les seves dades.
create or replace function public.cleanup_inactive_users(
  anon_months   integer default 6,
  linked_months integer default 24
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  with doomed as (
    select u.id
    from auth.users u
    left join public.profiles p on p.user_id = u.id
    where
      (p.user_id is null and u.created_at < now() - interval '7 days')
      or (
        p.user_id is not null
        and coalesce(p.last_seen_at, u.last_sign_in_at, u.created_at) <
            now() - make_interval(months => case when u.is_anonymous then anon_months else linked_months end)
      )
  )
  delete from auth.users where id in (select id from doomed);
  get diagnostics removed = row_count;
  return removed;
end;
$$;

revoke all on function public.cleanup_inactive_users(integer, integer) from public, anon, authenticated;

-- 3. Tasca programada: cada dia a les 3:30 (UTC)
create extension if not exists pg_cron;

select cron.schedule(
  'embranzida-neteja-usuaris',
  '30 3 * * *',
  $$select public.cleanup_inactive_users()$$
);

-- Per comprovar-ho:
--   select * from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 5;
-- Per provar la neteja sense esperar (compte: esborra de debò):
--   select public.cleanup_inactive_users();
