// Discos que cal posar a cada costat d'una barra olímpica de 20 kg,
// amb el codi de colors estàndard dels discos de competició.

export const BAR_KG = 20
const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25] as const
type PlateKg = (typeof PLATES)[number]

const STYLE: Record<PlateKg, { cls: string; h: number; w: number }> = {
  25: { cls: 'p-red', h: 1, w: 15 },
  20: { cls: 'p-blue', h: 1, w: 13 },
  15: { cls: 'p-yellow', h: 1, w: 11 },
  10: { cls: 'p-green', h: 1, w: 9 },
  5: { cls: 'p-white', h: 0.66, w: 8 },
  2.5: { cls: 'p-red', h: 0.5, w: 6 },
  1.25: { cls: 'p-steel', h: 0.4, w: 5 },
}

export function platesPerSide(totalKg: number): { plates: PlateKg[]; rest: number } {
  let side = Math.max(0, (totalKg - BAR_KG) / 2)
  const plates: PlateKg[] = []
  for (const p of PLATES) {
    while (side >= p - 1e-6 && plates.length < 12) {
      plates.push(p)
      side -= p
    }
  }
  return { plates, rest: Math.round(side * 100) / 100 }
}

const fmt = (n: number) => String(n).replace('.', ',')

export function Plates({ totalKg }: { totalKg: number }) {
  if (totalKg < BAR_KG) return <p className="plates-note">Menys que la barra sola ({BAR_KG} kg)</p>
  const { plates, rest } = platesPerSide(totalKg)
  const H = 64
  const x0 = 56 // final del mànec, inici de la camisa
  let x = x0 + 4
  const shapes = plates.map((p, k) => {
    const s = STYLE[p]
    const h = H * s.h
    const r = <rect key={k} x={x} y={(H - h) / 2 + 8} width={s.w} height={h} rx="2.5" className={`plate ${s.cls}`} />
    x += s.w + 1.5
    return r
  })
  const sleeveEnd = Math.max(x + 6, 150)
  const label = plates.length ? plates.map(fmt).join(' + ') : 'cap disc'
  return (
    <figure className="plates" aria-label={`Barra de ${BAR_KG} kg amb ${label} a cada costat`}>
      <svg viewBox={`0 0 ${sleeveEnd + 4} ${H + 16}`} aria-hidden="true">
        <rect x="0" y={H / 2 + 5} width={x0} height="6" rx="3" className="bar" />
        <rect x={x0 - 4} y={H / 2 + 1} width="6" height="14" rx="2" className="bar collar" />
        <rect x={x0} y={H / 2 + 3} width={sleeveEnd - x0} height="10" rx="3" className="bar sleeve" />
        {shapes}
      </svg>
      <figcaption>
        <strong>{label}</strong>
        <span>a cada costat de la barra de {BAR_KG} kg{rest > 0 ? ` (falten ${fmt(rest)} kg per costat)` : ''}</span>
      </figcaption>
    </figure>
  )
}
