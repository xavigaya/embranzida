type Props = {
  label: string
  value: number
  step: number
  min?: number
  max?: number
  unit?: string
  format?: (v: number) => string
  onChange: (v: number) => void
}

export function Stepper({ label, value, step, min = 0, max = 9999, unit, format, onChange }: Props) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-row">
        <button type="button" className="step-btn" aria-label={`Menys ${label}`} onClick={() => onChange(clamp(value - step))}>
          −
        </button>
        <output className="stepper-value" aria-live="polite">
          {format ? format(value) : value}
          {unit && <small>{unit}</small>}
        </output>
        <button type="button" className="step-btn" aria-label={`Més ${label}`} onClick={() => onChange(clamp(value + step))}>
          +
        </button>
      </div>
    </div>
  )
}
