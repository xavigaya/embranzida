import { useState } from 'react'

export type Point = { x: string; y: number } // x = data ISO (YYYY-MM-DD)

type Props = {
  title: string
  unit: string
  points: Point[]
  kind?: 'line' | 'bar'
  format?: (v: number) => string
}

const W = 340
const H = 170
const L = 40 // marge esquerre (eix y)
const R = 12
const T = 14
const B = 24 // marge inferior (eix x)

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat('ca', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`)).replace('.', '')

function niceTicks(lo: number, hi: number, n = 3) {
  const span = hi - lo || 1
  const raw = span / n
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const start = Math.floor(lo / step) * step
  const ticks: number[] = []
  for (let v = start; v <= hi + step * 0.001; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks
}

// Gràfic d'una sola sèrie: línia (evolució) o barres (quantitats per període).
// En tocar o passar per sobre es mostra el valor exacte; sota hi ha la taula amb totes les dades.
export function Chart({ title, unit, points, kind = 'line', format = (v) => String(v) }: Props) {
  const [sel, setSel] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  if (points.length === 0) return null

  const ys = points.map((p) => p.y)
  let lo = kind === 'bar' ? 0 : Math.min(...ys)
  let hi = Math.max(...ys)
  if (kind === 'line') {
    const pad = (hi - lo) * 0.15 || Math.max(1, hi * 0.05)
    lo -= pad
    hi += pad
  }
  const ticks = niceTicks(lo, hi)
  lo = Math.min(lo, ticks[0])
  hi = Math.max(hi, ticks.at(-1)!)
  const iw = W - L - R
  const ih = H - T - B
  const n = points.length
  const band = iw / n
  const X = (i: number) => (kind === 'bar' ? L + band * i + band / 2 : n === 1 ? L + iw / 2 : L + (iw * i) / (n - 1))
  const Y = (v: number) => T + ih - ((v - lo) / (hi - lo || 1)) * ih
  const last = points.at(-1)!
  const active = sel ?? n - 1
  const bw = Math.min(28, band - 2)

  const pick = (clientX: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * W
    let best = 0
    for (let i = 1; i < n; i++) if (Math.abs(X(i) - x) < Math.abs(X(best) - x)) best = i
    setSel(best)
  }

  return (
    <figure className="chart">
      <figcaption>
        <span className="chart-title">{title}</span>
        <span className="chart-value">
          {format(points[active].y)} <small>{unit}</small>
          <small className="chart-when"> · {fmtDate(points[active].x)}</small>
        </span>
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}: últim valor ${format(last.y)} ${unit}`}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerDown={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => setSel(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={Y(t)} y2={Y(t)} className="chart-grid" />
            <text x={L - 6} y={Y(t) + 4} className="chart-tick" textAnchor="end">
              {format(t)}
            </text>
          </g>
        ))}
        {[0, n - 1].filter((v, k, a) => a.indexOf(v) === k).map((i) => (
          <text key={i} x={X(i)} y={H - 6} className="chart-tick" textAnchor={n === 1 ? 'middle' : i === 0 ? 'start' : 'end'}>
            {fmtDate(points[i].x)}
          </text>
        ))}
        {kind === 'bar' ? (
          points.map((p, i) => {
            const x = X(i) - bw / 2
            const y = Y(p.y)
            const h = Y(0) - y
            const r = Math.min(4, h, bw / 2)
            return (
              <path
                key={p.x}
                className={`chart-bar ${i === active ? 'on' : ''}`}
                d={h <= 0 ? '' : `M${x},${Y(0)} V${y + r} Q${x},${y} ${x + r},${y} H${x + bw - r} Q${x + bw},${y} ${x + bw},${y + r} V${Y(0)} Z`}
              />
            )
          })
        ) : (
          <>
            {n > 1 && <polyline className="chart-line" points={points.map((p, i) => `${X(i)},${Y(p.y)}`).join(' ')} />}
            {points.map((p, i) => (
              <circle key={p.x + i} cx={X(i)} cy={Y(p.y)} r={i === active ? 5 : 4} className={`chart-dot ${i === active ? 'on' : ''}`} />
            ))}
            <line x1={X(active)} x2={X(active)} y1={T} y2={T + ih} className="chart-cross" />
          </>
        )}
      </svg>
      <button type="button" className="link small" onClick={() => setShowTable(!showTable)}>
        {showTable ? 'Amaga les dades' : 'Mostra les dades'}
      </button>
      {showTable && (
        <table className="chart-table">
          <thead>
            <tr>
              <th>Data</th>
              <th>{unit}</th>
            </tr>
          </thead>
          <tbody>
            {[...points].reverse().map((p, i) => (
              <tr key={p.x + i}>
                <td>{fmtDate(p.x)}</td>
                <td>{format(p.y)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  )
}
