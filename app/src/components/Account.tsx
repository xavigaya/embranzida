import { useState } from 'react'
import { collectAllData, deleteEverything, download, historyCsv } from '../lib/account'
import { emailConfirmed, linkEmailStart, linkEmailVerify, type AccountInfo } from '../lib/auth'
import { EmailCode } from './EmailCode'

type Props = {
  alias: string
  cloud: boolean
  syncLabel: string
  pending: number
  syncError?: string
  levelLabel: string | null
  onRetrySync: () => void
  onActivateCloud?: () => void
  onReassess: () => void
  planMode: 'automatic' | 'manual' | null
  onEditPlan: () => void
  onNewPlan: () => void
  onShowLegal: () => void
  account: AccountInfo | null
  onLinked: () => void
}

export function Account({ alias, cloud, syncLabel, pending, syncError, levelLabel, onRetrySync, onActivateCloud, onReassess, planMode, onEditPlan, onNewPlan, onShowLegal, account, onLinked }: Props) {
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [changing, setChanging] = useState(false)
  const stamp = new Date().toLocaleDateString('sv-SE')

  const exportJson = async () => {
    setBusy('json')
    try {
      const data = await collectAllData()
      download(`embranzida-dades-${stamp}.json`, JSON.stringify(data, null, 2), 'application/json')
    } finally {
      setBusy(null)
    }
  }
  const exportCsv = async () => {
    setBusy('csv')
    try {
      download(`embranzida-series-${stamp}.csv`, await historyCsv(), 'text/csv;charset=utf-8')
    } finally {
      setBusy(null)
    }
  }
  const remove = async () => {
    setBusy('del')
    setError(null)
    const err = await deleteEverything()
    if (err) {
      setError(`No s’ha pogut esborrar el compte del núvol: ${err}. Torna-ho a provar amb connexió.`)
      setBusy(null)
      return
    }
    location.reload()
  }

  return (
    <main className="screen account">
      <header>
        <h1>Compte</h1>
        <p className="muted">
          Entrenes com a <strong>{alias}</strong>
          {levelLabel && <>, nivell {levelLabel.toLowerCase()}</>}
        </p>
      </header>

      {account && account.isAnonymous && (
        <section className="card stack-sm protect">
          <h2>El compte només existeix en aquest mòbil</h2>
          <p>
            Si canvies de mòbil, esborres les dades de Chrome o desinstal·les l’app, perdràs l’accés al compte i a tot
            l’historial. Vincula-hi un correu per poder tornar-hi a entrar des de qualsevol mòbil.
          </p>
          <p className="muted small">El correu només serveix per entrar: no es guarda al costat de les dades d’entrenament ni l’usarem per a res més.</p>
          {!linking ? (
            <button type="button" className="btn primary block" onClick={() => setLinking(true)}>
              Vincula un correu
            </button>
          ) : (
            <EmailCode
              sendLabel="Envia’m el correu"
              verifyLabel="Vincula el correu"
              onSend={linkEmailStart}
              onVerify={linkEmailVerify}
              onDone={() => (setLinking(false), onLinked())}
              onCancel={() => setLinking(false)}
              onCheckLink={emailConfirmed}
            />
          )}
        </section>
      )}

      {account && !account.isAnonymous && (
        <section className="card stack-sm">
          <h2>Compte protegit</h2>
          <p className="muted">
            Vinculat a <strong>{account.email}</strong>. Des d’un altre mòbil, tria «Ja tinc un compte amb correu» a la
            pantalla d’inici i entra amb aquest correu.
          </p>
          {!changing ? (
            <button type="button" className="btn ghost block" onClick={() => setChanging(true)}>
              Canvia el correu
            </button>
          ) : (
            <EmailCode
              sendLabel="Canvia el correu"
              verifyLabel="Confirma amb el codi"
              onSend={linkEmailStart}
              onVerify={linkEmailVerify}
              onCheckLink={emailConfirmed}
              sentNote="Per seguretat, és possible que també hagis de confirmar el canvi des del correu actual."
              onDone={() => (setChanging(false), onLinked())}
              onCancel={() => setChanging(false)}
            />
          )}
        </section>
      )}

      <section className="card stack-sm">
        <h2>Sincronització</h2>
        <p className="muted">
          {!cloud
            ? 'Les dades només es guarden en aquest mòbil.'
            : pending > 0
              ? `${pending} element${pending > 1 ? 's' : ''} pendent${pending > 1 ? 's' : ''} de pujar.`
              : 'Tot està desat al núvol.'}
        </p>
        {syncError && <p className="error">{syncError}</p>}
        {onActivateCloud ? (
          <button type="button" className="btn primary block" onClick={onActivateCloud}>
            Activa el núvol
          </button>
        ) : (
          pending > 0 && (
            <button type="button" className="btn ghost block" onClick={onRetrySync}>
              Torna a sincronitzar ({syncLabel})
            </button>
          )
        )}
      </section>

      <section className="card stack-sm">
        <h2>El meu pla</h2>
        <p className="muted">
          {planMode === 'manual'
            ? 'Fas servir un pla manual: tu decideixes els exercicis, les sèries i les repeticions.'
            : planMode === 'automatic'
              ? 'L’app genera i fa progressar el pla a partir de la teva valoració.'
              : 'Encara no tens cap pla.'}
        </p>
        {planMode && (
          <button type="button" className="btn ghost block" onClick={onEditPlan}>
            {planMode === 'manual' ? 'Edita el pla' : 'Personalitza el pla (passa a manual)'}
          </button>
        )}
        <button type="button" className="btn ghost block" onClick={onReassess}>
          {planMode === 'manual' ? 'Torna al pla automàtic (nova valoració)' : planMode ? 'Repeteix la valoració' : 'Fes la valoració'}
        </button>
        <button type="button" className="btn ghost block" onClick={onNewPlan}>
          Crea un pla manual des de zero
        </button>
      </section>

      <section className="card stack-sm">
        <h2>Les meves dades</h2>
        <p className="muted">
          Les dades es guarden pseudonimitzades (sense nom real ni correu) en servidors de la UE. Les pots descarregar o
          esborrar quan vulguis.
        </p>
        <button type="button" className="btn ghost block" onClick={exportJson} disabled={busy !== null}>
          {busy === 'json' ? 'Preparant…' : 'Descarrega totes les dades (JSON)'}
        </button>
        <button type="button" className="btn ghost block" onClick={exportCsv} disabled={busy !== null}>
          {busy === 'csv' ? 'Preparant…' : 'Descarrega l’historial de sèries (CSV)'}
        </button>
      </section>

      <button type="button" className="btn ghost block" onClick={onShowLegal}>
        Privacitat i avís de salut
      </button>

      {account && (
        <p className="muted small center">
          Identificador del compte: <code>{account.id.slice(0, 8)}</code>
        </p>
      )}

      <section className="card stack-sm danger">
        <h2>Esborrar el compte</h2>
        <p className="muted">
          S’esborraran per sempre el compte, el pla, l’historial i totes les dades, del núvol i d’aquest mòbil. No es pot
          desfer.
        </p>
        {!confirming ? (
          <button type="button" className="btn danger-btn block" onClick={() => setConfirming(true)}>
            Esborra el compte i les dades
          </button>
        ) : (
          <>
            <label className="field">
              <span>
                Escriu <strong>ESBORRA</strong> per confirmar
              </span>
              <input value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" />
            </label>
            {error && <p className="error">{error}</p>}
            <div className="overlay-actions">
              <button type="button" className="btn ghost" onClick={() => setConfirming(false)}>
                Cancel·la
              </button>
              <button
                type="button"
                className="btn danger-btn"
                disabled={typed.trim().toUpperCase() !== 'ESBORRA' || busy !== null}
                onClick={remove}
              >
                {busy === 'del' ? 'Esborrant…' : 'Esborra-ho tot'}
              </button>
            </div>
          </>
        )}
      </section>
    </main>
  )
}
