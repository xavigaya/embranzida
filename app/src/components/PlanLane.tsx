// Recorregut del pla: un tram per setmana, com els carrils d'una pista.
// Les setmanes de descàrrega són més estretes. Les fletxes canvien de setmana.

type Props = {
  weeks: number
  current: number
  deloadWeeks: number[]
  deload: boolean
  onPrev?: () => void
  onNext?: () => void
}

export function PlanLane({ weeks, current, deloadWeeks, deload, onPrev, onNext }: Props) {
  return (
    <div className="lane">
      <div className="lane-nav">
        <button type="button" className="lane-btn" onClick={onPrev} disabled={!onPrev} aria-label="Setmana anterior">
          ‹
        </button>
        <p className="lane-text" aria-live="polite">
          Setmana <strong>{current}</strong> de {weeks}
          {deload && <span className="lane-tag">descàrrega</span>}
        </p>
        <button type="button" className="lane-btn" onClick={onNext} disabled={!onNext} aria-label="Setmana següent">
          ›
        </button>
      </div>
      <div className="lane-track" aria-hidden="true">
        {Array.from({ length: weeks }, (_, k) => {
          const w = k + 1
          const cls = w < current ? 'past' : w === current ? 'now' : ''
          return <span key={w} className={`lane-seg ${cls} ${deloadWeeks.includes(w) ? 'easy' : ''}`} />
        })}
      </div>
    </div>
  )
}
