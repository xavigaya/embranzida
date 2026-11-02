import { useState } from 'react'

type Props = {
  busy: boolean
  error: string | null
  onSubmit: (alias: string, ageRange: string | null) => void
  onOffline: (alias: string, ageRange: string | null) => void
  onShowLegal: () => void
}

const AGES = ['18-29', '30-39', '40-49', '50-59', '60-69', '70+']

export function Onboarding({ busy, error, onSubmit, onOffline, onShowLegal }: Props) {
  const [alias, setAlias] = useState('')
  const [age, setAge] = useState<string | null>(null)
  const [consent, setConsent] = useState(false)
  const ok = alias.trim().length >= 2 && consent

  return (
    <main className="screen onboarding">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true" />
        <h1>Embranzida</h1>
        <p className="muted">El teu entrenador de butxaca. Planifica, registra i progressa.</p>
      </div>

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
    </main>
  )
}
