import { useState } from 'react'
import { validEmail } from '../lib/auth'

type Props = {
  sendLabel: string
  verifyLabel: string
  onSend: (email: string) => Promise<string | null>
  onVerify: (email: string, code: string) => Promise<string | null>
  onDone: () => void
  onCancel?: () => void
}

// Flux en dos passos: escriure el correu → escriure el codi rebut
export function EmailCode({ sendLabel, verifyLabel, onSend, onVerify, onDone, onCancel }: Props) {
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
            T’hem enviat un codi a <strong>{email.trim()}</strong>. Pot trigar un minut i, de vegades, arriba a la
            carpeta de correu brossa.
          </p>
          <label className="field">
            <span>Codi</span>
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
          <button type="button" className="btn primary" disabled={code.length < 6 || busy} onClick={verify}>
            {busy ? 'Comprovant…' : verifyLabel}
          </button>
        )}
      </div>
    </div>
  )
}
