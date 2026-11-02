-- =====================================================================
-- Embranzida · Consulta per identificar els usuaris
-- Executar al SQL Editor de Supabase. Només llegeix, no modifica res.
--
-- La columna «codi» són els 8 primers caràcters de l'identificador:
-- és el mateix codi que l'app mostra a Compte → «Identificador del compte».
-- =====================================================================

select
  left(u.id::text, 8)                         as codi,
  coalesce(p.alias, '(sense perfil)')         as alias,
  case when u.is_anonymous then 'anònim' else 'amb correu' end as tipus,
  u.email                                     as correu,
  to_char(u.created_at, 'YYYY-MM-DD HH24:MI') as creat,
  to_char(p.last_seen_at, 'YYYY-MM-DD')       as darrera_activitat,
  (select count(*) from public.session_logs s where s.user_id = u.id)      as sessions,
  (select count(*) from public.set_logs x where x.user_id = u.id)          as series,
  (select count(*) from public.plans pl where pl.user_id = u.id)           as plans,
  u.id                                        as id_complet
from auth.users u
left join public.profiles p on p.user_id = u.id
order by u.created_at;

-- Per esborrar un usuari i totes les seves dades, la manera més segura és
-- Authentication → Users → cercar per l'id_complet → Delete user.
-- També es pot fer aquí (canvia l'identificador):
--   delete from auth.users where id = '00000000-0000-0000-0000-000000000000';
