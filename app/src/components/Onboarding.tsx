import { useState } from 'react'
import { loginStart, loginVerify, signedInWithEmail } from '../lib/auth'
import { EmailCode } from './EmailCode'

type Props = {
  busy: boolean
  error: string | null
  onSubmit: (alias: string, ageRange: string | null) => void
  onOffline: (alias: string, ageRange: string | null) => void
  onShowLegal: () => void
  onLoggedIn: () => void
}

const AGES = ['18-29', '30-39', '40-49', '50-59', '60-69', '70+']

export function Onboarding({ busy, error, onSubmit, onOffline, onShowLegal, onLoggedIn }: Props) {
  const [alias, setAlias] = useState('')
  const [age, setAge] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const [login, setLogin] = useState(false)
  const ok = alias.trim().length >= 2 && consent

  return (
    <main className="screen onboarding">
      <div className="brand">
        <svg className="brand-mark" viewBox="0 0 120 64" aria-hidden="true">
          <rect className="bar" x="0" y="29" width="34" height="6" rx="3" />
          <rect className="bar" x="30" y="25" width="6" height="14" rx="2" />
          <rect className="bar" x="34" y="27" width="84" height="10" rx="3" />
          <rect className="plate p-red bm-1" x="40" y="2" width="15" height="60" rx="3" />
          <rect className="plate p-blue bm-2" x="57" y="2" width="13" height="60" rx="3" />
          <rect className="plate p-yellow bm-3" x="72" y="2" width="11" height="60" rx="3" />
        </svg>
        <h1>Embranzida</h1>
        <p className="brand-tag">Planifica l’entrenament, registra cada sèrie i mira com progresses.</p>
      </div>

      {login ? (
        <section className="card form">
          <h2>Entra al teu compte</h2>
          <p className="muted">Escriu el correu que vas vincular al compte i t’enviarem un enllaç per entrar. Obre’l des d’aquest mateix mòbil.</p>
          <EmailCode
            sendLabel="Envia’m l’enllaç"
            verifyLabel="Entra amb el codi"
            onSend={loginStart}
            onVerify={loginVerify}
            onDone={onLoggedIn}
            onCancel={() => setLogin(false)}
            onCheckLink={signedInWithEmail}
          />
        </section>
      ) : (
      <form
        className="card form"
        onSubmit={(e) => {
          e.preventDefault()
          if (ok) onSubmit(alias.trim(), age)
        }}
      >
        <label className="field">
          <span>Com vols que et diguem?</span>
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            maxLength={30}
            placeholder="Un àlies, no cal el teu nom real"
            autoComplete="off"
          />
        </label>

        <fieldset className="field">
          <legend>Franja d’edat (opcional)</legend>
          <div className="chips">
            {AGES.map((a) => (
              <button
                key={a}
                type="button"
                className={`chip ${age === a ? 'on' : ''}`}
                onClick={() => setAge(age === a ? null : a)}
              >
                {a}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Tinc 18 anys o més i dono el meu consentiment explícit perquè es guardin, de forma pseudonimitzada, les
            meves dades d’entrenament i de salut (qüestionari de salut, tests, mesures i estat diari). Les puc
            exportar o esborrar quan vulgui. Entenc que l’app no substitueix el consell mèdic.{' '}
            <button type="button" className="inline-link" onClick={onShowLegal}>
              Llegeix la política de privacitat i l’avís de salut
            </button>
          </span>
        </label>

        {error && <p className="error" role="alert">{error}</p>}

        <button type="submit" className="btn primary block" disabled={!ok || busy}>
          {busy ? 'Creant el compte…' : 'Comença'}
        </button>
        {error && (
          <button type="button" className="btn ghost block" disabled={!ok} onClick={() => onOffline(alias.trim(), age)}>
            Continua sense connexió
          </button>
        )}
      </form>
      )}
      {!login && (
        <button type="button" className="btn ghost block" onClick={() => setLogin(true)}>
          Ja tinc un compte amb correu
        </button>
      )}
    </main>
  )
}
