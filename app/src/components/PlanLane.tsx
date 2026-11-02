// Recorregut del pla: un tram per setmana, com els carrils d'una pista.
// Les setmanes de descàrrega són més estretes.

type Props = { weeks: number; current: number; deloadWeeks: number[]; deload: boolean }

export function PlanLane({ weeks, current, deloadWeeks, deload }: Props) {
  return (
    <div className="lane" aria-label={`Setmana ${current} de ${weeks}`}>
      <div className="lane-track" aria-hidden="true">
        {Array.from({ length: weeks }, (_, k) => {
          const w = k + 1
          const cls = w < current ? 'past' : w === current ? 'now' : ''
          return <span key={w} className={`lane-seg ${cls} ${deloadWeeks.includes(w) ? 'easy' : ''}`} />
        })}
      </div>
      <p className="lane-text">
        Setmana <strong>{current}</strong> de {weeks}
        {deload && <span className="lane-tag">descàrrega</span>}
      </p>
    </div>
  )
}
