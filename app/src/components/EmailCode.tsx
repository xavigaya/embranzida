import { useState } from 'react'
import { validEmail } from '../lib/auth'

type Props = {
  sendLabel: string
  verifyLabel: string
  onSend: (email: string) => Promise<string | null>
  onVerify: (email: string, code: string) => Promise<string | null>
  onDone: () => void
  onCancel?: () => void
  // Comprova si l'usuari ja ha obert l'enllaç del correu (quan el correu porta enllaç i no codi)
  onCheckLink?: (email: string) => Promise<boolean>
  sentNote?: string
}

// Flux en dos passos: escriure el correu → escriure el codi rebut
export function EmailCode({ sendLabel, verifyLabel, onSend, onVerify, onDone, onCancel, onCheckLink, sentNote }: Props) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    setBusy(true)
    setError(null)
    const err = await onSend(email)
    setBusy(false)
    if (err) setError(err)
    else setSent(true)
  }
  const check = async () => {
    if (!onCheckLink) return
    setBusy(true)
    setError(null)
    const ok = await onCheckLink(email)
    setBusy(false)
    if (ok) onDone()
    else setError('Encara no consta com a confirmat. Obre l’enllaç del correu i torna-ho a provar.')
  }
  const verify = async () => {
    setBusy(true)
    setError(null)
    const err = await onVerify(email, code)
    setBusy(false)
    if (err) setError(err)
    else onDone()
  }

  return (
    <div className="email-code stack-sm">
      {!sent ? (
        <label className="field">
          <span>Correu electrònic</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nom@exemple.cat"
          />
        </label>
      ) : (
        <>
          <p className="muted">
            T’hem enviat un correu a <strong>{email.trim()}</strong>. Obre l’enllaç que conté{onCheckLink ? ' i torna aquí' : ''}, o
            escriu el codi si n’hi ha. Pot trigar un minut i, de vegades, arriba a la carpeta de correu brossa.
          </p>
          {sentNote && <p className="notice warn-box small">{sentNote}</p>}
          {onCheckLink && (
            <button type="button" className="btn primary block" onClick={check} disabled={busy}>
              {busy ? 'Comprovant…' : 'Ja he obert l’enllaç'}
            </button>
          )}
          <label className="field">
            <span>Codi (si el correu en porta)</span>
            <input
              className="code-input"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^\d]/g, '').slice(0, 10))}
              placeholder="123456"
            />
          </label>
        </>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="overlay-actions">
        {onCancel && (
          <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
            Cancel·la
          </button>
        )}
        {sent && (
          <button type="button" className="btn ghost" onClick={() => (setSent(false), setCode(''), setError(null))} disabled={busy}>
            Canvia el correu
          </button>
        )}
        {!sent ? (
          <button type="button" className="btn primary" disabled={!validEmail(email) || busy} onClick={send}>
            {busy ? 'Enviant…' : sendLabel}
          </button>
        ) : (
          <button type="button" className={`btn ${onCheckLink ? 'ghost' : 'primary'}`} disabled={code.length < 6 || busy} onClick={verify}>
            {busy ? 'Comprovant…' : verifyLabel}
          </button>
        )}
      </div>
    </div>
  )
}
