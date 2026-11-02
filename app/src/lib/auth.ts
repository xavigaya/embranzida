import { supabase } from './supabase'

// =====================================================================
// Identitat de l'usuari
// - Per defecte el compte és anònim: només existeix en aquest mòbil.
// - Vincular un correu el converteix en permanent (mateix usuari, mateixes dades).
// - Amb el correu vinculat es pot entrar des d'un altre mòbil amb un codi.
// Els codis arriben per correu (plantilles de Supabase amb {{ .Token }}).
// =====================================================================

export type AccountInfo = { id: string; isAnonymous: boolean; email: string | null }

export async function accountInfo(): Promise<AccountInfo | null> {
  const { data } = await supabase.auth.getSession()
  const u = data.session?.user
  if (!u) return null
  return { id: u.id, isAnonymous: u.is_anonymous ?? !u.email, email: u.email ?? null }
}

export const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim())

function explain(msg: string, step: 'send' | 'verify') {
  if (/manual linking/i.test(msg)) return 'Cal activar «Allow manual linking» a Supabase per poder vincular correus.'
  if (/not authorized/i.test(msg)) return 'Encara no es poden enviar correus a aquesta adreça: cal configurar el servidor de correu del projecte a Supabase.'
  if (/email address .* is invalid|email_address_invalid/i.test(msg)) return 'Aquesta adreça de correu no és vàlida o no s’accepta. Prova’n una altra.'
  if (/rate limit|too many|security purposes/i.test(msg)) return 'S’han enviat massa correus en poca estona. Torna-ho a provar d’aquí a una estona.'
  if (/already (been )?registered|already exists|email_exists/i.test(msg)) return 'Aquest correu ja està vinculat a un altre compte. Si és teu, entra-hi des de la pantalla d’inici.'
  if (/signups not allowed|user not found|otp_disabled/i.test(msg)) return 'No hi ha cap compte amb aquest correu.'
  if (/fetch|network/i.test(msg)) return 'Sense connexió. Torna-ho a provar quan en tinguis.'
  if (step === 'verify' && /expired|invalid/i.test(msg)) return 'El codi no és correcte o ha caducat. Demana’n un de nou.'
  return `No s’ha pogut completar: ${msg}`
}

// --- Vincular un correu al compte anònim actual ---
export async function linkEmailStart(email: string): Promise<string | null> {
  const { error } = await supabase.auth.updateUser({ email: email.trim().toLowerCase() })
  return error ? explain(error.message, 'send') : null
}

export async function linkEmailVerify(email: string, code: string): Promise<string | null> {
  const e = email.trim().toLowerCase()
  const token = code.replace(/\s/g, '')
  let { error } = await supabase.auth.verifyOtp({ email: e, token, type: 'email_change' })
  if (error) ({ error } = await supabase.auth.verifyOtp({ email: e, token, type: 'email' }))
  return error ? explain(error.message, 'verify') : null
}

// --- Entrar des d'un altre mòbil amb un compte que ja té correu ---
export async function loginStart(email: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim().toLowerCase(), options: { shouldCreateUser: false } })
  return error ? explain(error.message, 'send') : null
}

export async function loginVerify(email: string, code: string): Promise<string | null> {
  const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.replace(/\s/g, ''), type: 'email' })
  return error ? explain(error.message, 'verify') : null
}

// --- Darrera activitat (per a la neteja de comptes abandonats), com a molt un cop al dia ---
export async function touchLastSeen(userId: string) {
  const today = new Date().toLocaleDateString('sv-SE')
  try {
    if (localStorage.getItem('emb.lastSeen') === today) return
    const { error } = await supabase.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('user_id', userId)
    if (!error) localStorage.setItem('emb.lastSeen', today)
  } catch {
    /* sense connexió: ja es farà un altre dia */
  }
}
