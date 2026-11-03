import { useEffect, useState } from 'react'
import { CATALOG, mediaFrames } from '../data/catalog'

const byId = new Map(CATALOG.map((e) => [e.id, e]))
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

// Exemple gràfic: alterna la posició inicial i la final. Tocar-lo l'atura o el reprèn.
export function ExerciseMedia({ exerciseId, compact = false }: { exerciseId: string; compact?: boolean }) {
  const frames = mediaFrames(exerciseId)
  const [k, setK] = useState(0)
  const [paused, setPaused] = useState(reduced)
  useEffect(() => {
    if (!frames || paused) return
    const t = setInterval(() => setK((v) => 1 - v), 1300)
    return () => clearInterval(t)
  }, [exerciseId, paused, !!frames])
  if (!frames) return null
  const e = byId.get(exerciseId)
  return (
    <figure className={`ex-media ${compact ? 'compact' : ''}`}>
      <button
        type="button"
        className="ex-media-frames"
        onClick={() => setPaused(!paused)}
        aria-label={paused ? 'Reprèn l’animació' : 'Atura l’animació'}
      >
        {frames.map((src, i) => (
          <img key={src} src={src} alt={i === 0 ? `${e?.name}: posició inicial` : `${e?.name}: posició final`} className={i === k ? 'on' : ''} loading="lazy" />
        ))}
        <span className="ex-media-step">{k === 0 ? 'Inici' : 'Final'}</span>
      </button>
      {!compact && e?.media?.type === 'foto' && <figcaption>Imatge: free-exercise-db (domini públic)</figcaption>}
    </figure>
  )
}
