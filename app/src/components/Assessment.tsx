import { useMemo, useState } from 'react'
import { computeLevel, LEVEL_LABEL, PUSH_LABEL, type Experience, type Sex } from '../lib/level'
import type { AssessmentPayload, GoalType } from '../lib/types'

// Preguntes generals del PAR-Q+ (adaptació en català).
// Per minimització de dades, només es desa si hi ha alguna resposta afirmativa.
const PARQ = [
  'Algun metge t’ha dit que tens una malaltia del cor o la pressió arterial alta?',
  'Sents dolor al pit en repòs, en les activitats diàries o quan fas activitat física?',
  'En els últims 12 mesos has perdut l’equilibri per un mareig o has perdut el coneixement?',
  'T’han diagnosticat alguna altra malaltia crònica?',
  'Prens medicació prescrita per a alguna malaltia crònica?',
  'Tens (o has tingut en els últims 12 mesos) algun problema d’ossos, articulacions o músculs que pugui empitjorar si fas més activitat física?',
  'Algun metge t’ha dit que només has de fer activitat física supervisada?',
]

const GOALS: { id: GoalType; label: string; hint: string }[] = [
  { id: 'forca', label: 'Força', hint: 'Aixecar més pes, guanyar múscul' },
  { id: 'perdua_greix', label: 'Pèrdua de greix', hint: 'Reduir pes i perímetres' },
  { id: 'resistencia', label: 'Resistència', hint: 'Córrer, pedalar, aguantar més' },
  { id: 'mobilitat', label: 'Mobilitat', hint: 'Moure’t millor i sense molèsties' },
  { id: 'flexibilitat', label: 'Flexibilitat', hint: 'Guanyar amplitud de moviment' },
]

const EQUIPMENT = [
  { id: 'barra', label: 'Barra i discos' },
  { id: 'rack', label: 'Rack' },
  { id: 'banc', label: 'Banc' },
  { id: 'manuella', label: 'Manuelles' },
  { id: 'kettlebell', label: 'Kettlebell' },
  { id: 'politja', label: 'Politges i màquines' },
  { id: 'barra fixa', label: 'Barra de dominades' },
  { id: 'cardio', label: 'Bici, cinta o el·líptica' },
]

const SQUAT = [
  'No puc baixar sota el paral·lel',
  'Baixo però aixecant talons o caient endavant',
  'Baixo bé però els braços cauen endavant',
  'Baixo fins avall amb els braços amunt i talons a terra',
]

type Tests = {
  pushups?: number
  plankS?: number
  restingHr?: number
  walk6m?: number
  cooperM?: number
  squat?: number
  kneeWallCm?: number
  sitReachCm?: number
  weightKg?: number
  waistCm?: number
  hipCm?: number
}

type Props = {
  ageRange: string | null
  onCancel: () => void
  onSave: (payload: AssessmentPayload, summary: { level: string; parqFlag: boolean }) => void
}

function NumberField({
  label,
  hint,
  unit,
  value,
  onChange,
}: {
  label: string
  hint?: string
  unit: string
  value?: number
  onChange: (v?: number) => void
}) {
  return (
    <label className="numfield">
      <span className="numfield-text">
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <span className="numfield-input">
        <input
          inputMode="decimal"
          value={value ?? ''}
          placeholder="—"
          onChange={(e) => {
            const v = e.target.value.replace(',', '.')
            onChange(v === '' || isNaN(Number(v)) ? undefined : Number(v))
          }}
        />
        <small>{unit}</small>
      </span>
    </label>
  )
}

export function Assessment({ ageRange, onCancel, onSave }: Props) {
  const [step, setStep] = useState(0)
  const [parq, setParq] = useState<(boolean | null)[]>(PARQ.map(() => null))
  const [sex, setSex] = useState<Sex>('no_ho_dic')
  const [exp, setExp] = useState<Experience | null>(null)
  const [technique, setTechnique] = useState(false)
  const [goals, setGoals] = useState<GoalType[]>([])
  const [mainGoal, setMainGoal] = useState<GoalType | null>(null)
  const [days, setDays] = useState<number | null>(null)
  const [minutes, setMinutes] = useState<number | null>(null)
  const [equipment, setEquipment] = useState<string[]>([])
  const [limitations, setLimitations] = useState('')
  const [t, setT] = useState<Tests>({})

  const parqFlag = parq.some((a) => a === true)
  const result = useMemo(
    () =>
      exp
        ? computeLevel({ experience: exp, pushups: t.pushups ?? null, sex, ageRange, barbellTechnique: technique })
        : null,
    [exp, t.pushups, sex, ageRange, technique],
  )

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const setTest = (k: keyof Tests) => (v?: number) => setT({ ...t, [k]: v })

  const steps = [
    { title: 'Valoració inicial', ok: true },
    { title: 'Salut', ok: parq.every((a) => a !== null) },
    { title: 'Experiència', ok: exp !== null },
    { title: 'Objectius', ok: goals.length > 0 && mainGoal !== null },
    { title: 'Disponibilitat i material', ok: days !== null && minutes !== null },
    { title: 'Tests de força i resistència', ok: true },
    { title: 'Tests de mobilitat i mesures', ok: true },
    { title: 'Resultat', ok: true },
  ]
  const last = steps.length - 1

  const save = () => {
    if (!result || !exp || !days || !minutes || !mainGoal) return
    const results: Record<string, unknown> = { experiencia: exp, tecnica_barra: technique, ...t }
    if (result.pushCat) results.flexions_categoria = result.pushCat
    onSave(
      {
        profile: {
          sex,
          level: result.level,
          days_per_week: days,
          minutes_per_session: minutes,
          equipment: equipment.length ? equipment : [],
          limitations: limitations.trim() || null,
        },
        goals: goals.map((g) => ({ id: crypto.randomUUID(), type: g, priority: g === mainGoal ? 1 : 2 })),
        assessment: {
          id: crypto.randomUUID(),
          taken_at: new Date().toISOString(),
          kind: 'inicial',
          parq_flag: parqFlag,
          results,
        },
      },
      { level: result.level, parqFlag },
    )
  }

  return (
    <main className="screen wizard">
      <header className="wizard-head">
        <div className="dots" aria-hidden="true">
          {steps.map((_, i) => (
            <span key={i} className={i <= step ? 'on' : ''} />
          ))}
        </div>
        <p className="kicker">
          Pas {step + 1} de {steps.length}
        </p>
        <h1>{steps[step].title}</h1>
      </header>

      {step === 0 && (
        <section className="stack">
          <p>
            Unes quantes preguntes i uns tests senzills per adaptar el pla al teu punt de partida. Les preguntes són
            obligatòries; els tests, opcionals.
          </p>
          <ul className="plain">
            <li>Preguntes: 3 minuts</li>
            <li>Tests: 20–30 minuts, millor amb roba d’esport i un company que compti</li>
            <li>La pots repetir al final de cada mesocicle per veure el progrés</li>
          </ul>
        </section>
      )}

      {step === 1 && (
        <section className="stack">
          <p className="muted">
            Qüestionari de preparació per a l’activitat física (PAR-Q+). Només guardem si hi ha alguna resposta
            afirmativa, no quines.
          </p>
          {PARQ.map((q, i) => (
            <div key={q} className="yesno">
              <p>{q}</p>
              <div className="chips">
                {[true, false].map((v) => (
                  <button
                    key={String(v)}
                    type="button"
                    className={`chip ${parq[i] === v ? 'on' : ''}`}
                    onClick={() => setParq(parq.map((a, j) => (j === i ? v : a)))}
                  >
                    {v ? 'Sí' : 'No'}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {parqFlag && (
            <p className="notice warn-box">
              Abans d’augmentar l’activitat física, et recomanem consultar un professional sanitari. Mentrestant,
              el pla es limitarà a intensitat baixa.
            </p>
          )}
        </section>
      )}

      {step === 2 && (
        <section className="stack">
          <fieldset className="field">
            <legend>Quant de temps fa que entrenes de manera regular?</legend>
            <div className="options">
              {(
                [
                  ['menys_6m', 'Menys de 6 mesos', 'O fa temps que ho vaig deixar'],
                  ['6m_2a', 'Entre 6 mesos i 2 anys', 'Entreno amb certa constància'],
                  ['mes_2a', 'Més de 2 anys', 'Entreno de manera continuada'],
                ] as [Experience, string, string][]
              ).map(([id, label, hint]) => (
                <button key={id} type="button" className={`option ${exp === id ? 'on' : ''}`} onClick={() => setExp(id)}>
                  <strong>{label}</strong>
                  <small>{hint}</small>
                </button>
              ))}
            </div>
          </fieldset>

          {exp === 'mes_2a' && (
            <fieldset className="field">
              <legend>Domines la tècnica de la sentadilla i el pes mort amb barra?</legend>
              <div className="chips">
                <button type="button" className={`chip ${technique ? 'on' : ''}`} onClick={() => setTechnique(true)}>
                  Sí
                </button>
                <button type="button" className={`chip ${!technique ? 'on' : ''}`} onClick={() => setTechnique(false)}>
                  No / no ho sé
                </button>
              </div>
            </fieldset>
          )}

          <fieldset className="field">
            <legend>Sexe (per comparar els tests amb les taules de referència)</legend>
            <div className="chips">
              {(
                [
                  ['home', 'Home'],
                  ['dona', 'Dona'],
                  ['altre', 'Altre'],
                  ['no_ho_dic', 'Prefereixo no dir-ho'],
                ] as [Sex, string][]
              ).map(([id, label]) => (
                <button key={id} type="button" className={`chip ${sex === id ? 'on' : ''}`} onClick={() => setSex(id)}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
        </section>
      )}

      {step === 3 && (
        <section className="stack">
          <p className="muted">Tria’n un o més. Després marca quin és el principal.</p>
          <div className="options">
            {GOALS.map((g) => {
              const on = goals.includes(g.id)
              return (
                <div key={g.id} className={`option goal ${on ? 'on' : ''}`}>
                  <button
                    type="button"
                    className="goal-main"
                    onClick={() => {
                      const next = toggle(goals, g.id)
                      setGoals(next)
                      if (!next.includes(mainGoal as GoalType)) setMainGoal(next[0] ?? null)
                      else if (!mainGoal) setMainGoal(g.id)
                    }}
                  >
                    <strong>{g.label}</strong>
                    <small>{g.hint}</small>
                  </button>
                  {on && (
                    <button
                      type="button"
                      className={`star ${mainGoal === g.id ? 'on' : ''}`}
                      onClick={() => setMainGoal(g.id)}
                      aria-pressed={mainGoal === g.id}
                    >
                      {mainGoal === g.id ? 'Principal' : 'Fes-lo principal'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="stack">
          <fieldset className="field">
            <legend>Quants dies per setmana pots entrenar?</legend>
            <div className="chips">
              {[2, 3, 4, 5, 6].map((d) => (
                <button key={d} type="button" className={`chip ${days === d ? 'on' : ''}`} onClick={() => setDays(d)}>
                  {d}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="field">
            <legend>Quant temps per sessió?</legend>
            <div className="chips">
              {[30, 45, 60, 75, 90].map((m) => (
                <button key={m} type="button" className={`chip ${minutes === m ? 'on' : ''}`} onClick={() => setMinutes(m)}>
                  {m} min
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="field">
            <legend>Quin material tens a l’abast?</legend>
            <div className="chips">
              {EQUIPMENT.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={`chip ${equipment.includes(e.id) ? 'on' : ''}`}
                  onClick={() => setEquipment(toggle(equipment, e.id))}
                >
                  {e.label}
                </button>
              ))}
            </div>
            <small className="muted">Si no en marques cap, el pla es farà amb el pes del cos.</small>
          </fieldset>
          <label className="field">
            <span>Exercicis o moviments que vols evitar (opcional)</span>
            <textarea
              rows={2}
              value={limitations}
              onChange={(e) => setLimitations(e.target.value)}
              placeholder="P. ex. no puc córrer, molèsties a l’espatlla en aixecar el braç…"
            />
          </label>
        </section>
      )}

      {step === 5 && (
        <section className="stack">
          <p className="muted">Fes només els que puguis. Escalfa 5 minuts abans de començar.</p>
          <NumberField label="Flexions màximes" hint="Sobre les puntes dels peus, cos recte, fins a 90° de colze, sense pausa" unit="rep" value={t.pushups} onChange={setTest('pushups')} />
          <NumberField label="Planxa frontal" hint="Temps màxim mantenint el cos recte" unit="s" value={t.plankS} onChange={setTest('plankS')} />
          <NumberField label="FC en repòs" hint="En despertar, abans de llevar-te (mitjana de 3 dies)" unit="bpm" value={t.restingHr} onChange={setTest('restingHr')} />
          <NumberField label="Test de 6 minuts caminant" hint="Distància màxima caminant ràpid, sense córrer" unit="m" value={t.walk6m} onChange={setTest('walk6m')} />
          <NumberField label="Test de Cooper (12 min)" hint="Distància màxima corrent. Només si ja corres amb regularitat" unit="m" value={t.cooperM} onChange={setTest('cooperM')} />
        </section>
      )}

      {step === 6 && (
        <section className="stack">
          <fieldset className="field">
            <legend>Sentadilla profunda amb els braços amunt</legend>
            <div className="options">
              {SQUAT.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  className={`option compact ${t.squat === i ? 'on' : ''}`}
                  onClick={() => setTest('squat')(t.squat === i ? undefined : i)}
                >
                  <strong>{i}</strong>
                  <small>{s}</small>
                </button>
              ))}
            </div>
          </fieldset>
          <NumberField label="Genoll a la paret" hint="Distància màxima del dit gros a la paret tocant-la amb el genoll i el taló a terra" unit="cm" value={t.kneeWallCm} onChange={setTest('kneeWallCm')} />
          <NumberField label="Sit-and-reach" hint="Assegut, cames estirades: cm que passes (+) o et falten (−) per tocar-te els peus" unit="cm" value={t.sitReachCm} onChange={setTest('sitReachCm')} />
          <NumberField label="Pes" unit="kg" value={t.weightKg} onChange={setTest('weightKg')} />
          <NumberField label="Cintura" hint="A l’altura del melic, en expirar" unit="cm" value={t.waistCm} onChange={setTest('waistCm')} />
          <NumberField label="Maluc" hint="A la part més ampla dels glutis" unit="cm" value={t.hipCm} onChange={setTest('hipCm')} />
        </section>
      )}

      {step === 7 && result && (
        <section className="stack">
          <div className="level-card">
            <span className="kicker">El teu nivell de partida</span>
            <strong>{LEVEL_LABEL[result.level]}</strong>
            {result.pushCat && <small>Flexions: {PUSH_LABEL[result.pushCat]} per a la teva edat</small>}
          </div>
          {result.reasons.map((r) => (
            <p key={r} className="muted">
              {r}
            </p>
          ))}
          {parqFlag && (
            <p className="notice warn-box">
              Has respost afirmativament alguna pregunta de salut: el pla començarà amb intensitat baixa i et recomanem
              consultar un professional sanitari.
            </p>
          )}
          <dl className="recap">
            <div>
              <dt>Objectiu principal</dt>
              <dd>{GOALS.find((g) => g.id === mainGoal)?.label}</dd>
            </div>
            {goals.length > 1 && (
              <div>
                <dt>Altres objectius</dt>
                <dd>
                  {goals
                    .filter((g) => g !== mainGoal)
                    .map((g) => GOALS.find((x) => x.id === g)?.label)
                    .join(', ')}
                </dd>
              </div>
            )}
            <div>
              <dt>Disponibilitat</dt>
              <dd>
                {days} dies × {minutes} min
              </dd>
            </div>
            <div>
              <dt>Material</dt>
              <dd>{equipment.length ? EQUIPMENT.filter((e) => equipment.includes(e.id)).map((e) => e.label).join(', ') : 'Pes del cos'}</dd>
            </div>
          </dl>
          <p className="muted">El nivell es recalcularà quan repeteixis la valoració.</p>
        </section>
      )}

      <nav className="wizard-nav">
        <button type="button" className="btn ghost" onClick={() => (step === 0 ? onCancel() : setStep(step - 1))}>
          {step === 0 ? 'Més tard' : 'Enrere'}
        </button>
        {step < last ? (
          <button type="button" className="btn primary" disabled={!steps[step].ok} onClick={() => setStep(step + 1)}>
            {step === 0 ? 'Comença' : step === 5 || step === 6 ? 'Següent (o salta)' : 'Següent'}
          </button>
        ) : (
          <button type="button" className="btn primary" onClick={save}>
            Desa la valoració
          </button>
        )}
      </nav>
    </main>
  )
}
