// Configuració pública de Supabase.
// La clau "publishable" està pensada per anar dins l'app: no és secreta.
// La seguretat la garanteix la Row Level Security de la base de dades.
// MAI no posis aquí la clau secreta (sb_secret_… o service_role).

export const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL ?? 'https://hljjbmxhxfniieqmbmfd.supabase.co'

export const SUPABASE_PUBLISHABLE_KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_vDxHhG7x4b-lzPVw7tjp3g_rLv7ZFc1'

export const CONSENT_VERSION = 'v0.2-2026-11'

// Dades de la política de privacitat. PENDENT: completar abans d'obrir l'app a més gent.
export const LEGAL = {
  controller: '', // Responsable del tractament: nom de la persona o entitat
  contact: '', // Adreça de contacte per exercir els drets
  dataRegion: 'Unió Europea', // Regió del projecte de Supabase (comprovar a Project Settings → General)
  updated: '2 de novembre de 2026',
  // Terminis de neteja de comptes inactius (han de coincidir amb supabase/migrations/002_comptes.sql)
  inactiveAnonMonths: 6,
  inactiveLinkedMonths: 24,
}
