import { CATALOG } from '../data/catalog'
import { db } from './db'
import { supabase } from './supabase'

// Dret d'accés i portabilitat (RGPD): totes les dades de l'usuari, del mòbil i del núvol
export async function collectAllData() {
  const local = {
    alias: localStorage.getItem('emb.alias'),
    franja_edat: localStorage.getItem('emb.age'),
    plans: await db.plans.toArray(),
    sessions_fetes: await db.done.toArray(),
    historial_series: await db.history.toArray(),
    estat_diari: await db.daily.toArray(),
    mesures: await db.measurements.toArray(),
    pendent_de_pujar: await db.outbox.toArray(),
  }
  const cloud: Record<string, unknown> = {}
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    const tables = [
      'profiles', 'assessments', 'goals', 'plans', 'plan_goals', 'mesocycles', 'planned_sessions',
      'prescriptions', 'session_logs', 'set_logs', 'body_measurements', 'daily_status',
    ]
    for (const t of tables) {
      const { data: rows, error } = await supabase.from(t).select('*')
      cloud[t] = error ? { error: error.message } : rows
    }
  }
  return {
    exportat_el: new Date().toISOString(),
    app: 'Embranzida',
    nota: 'Dades pseudonimitzades: no inclouen nom real ni correu.',
    al_mobil: local,
    al_nuvol: data.session ? cloud : 'Sense compte al núvol',
  }
}

const names = new Map(CATALOG.map((e) => [e.id, e.name]))

// Historial de sèries en CSV (separador ; perquè s'obri bé amb fulls de càlcul en català)
export async function historyCsv() {
  const rows = (await db.history.toArray()).sort((a, b) => a.date.localeCompare(b.date))
  const q = (v: unknown) => (v == null ? '' : `"${String(v).replace(/"/g, '""')}"`)
  const head = ['data', 'exercici', 'carrega_kg', 'repeticions', 'rir', 'durada_s', 'descarrega']
  const lines = rows.map((h) =>
    [new Date(h.date).toLocaleString('sv-SE').slice(0, 16), names.get(h.exerciseId) ?? h.exerciseId, h.loadKg, h.reps, h.rir, h.durationS, h.deload ? 'sí' : 'no']
      .map(q)
      .join(';'),
  )
  return '﻿' + [head.join(';'), ...lines].join('\n')
}

export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Dret de supressió: esborra el compte al núvol (en cascada) i totes les dades del mòbil
export async function deleteEverything(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  if (data.session) {
    const { error } = await supabase.rpc('delete_my_account')
    if (error) return error.message
    await supabase.auth.signOut().catch(() => {})
  }
  await db.delete()
  for (const k of Object.keys(localStorage)) if (k.startsWith('emb.') || k.startsWith('sb-')) localStorage.removeItem(k)
  return null
}
