// Configuració pública de Supabase.
// La clau "publishable" està pensada per anar dins l'app: no és secreta.
// La seguretat la garanteix la Row Level Security de la base de dades.
// MAI no posis aquí la clau secreta (sb_secret_… o service_role).

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://hljjbmxhxfniieqmbmfd.supabase.co'

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_vDxHhG7x4b-lzPVw7tjp3g_rLv7ZFc1'

export const CONSENT_VERSION = 'v0.1-2026-11'
