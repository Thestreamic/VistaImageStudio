'use client'
interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  onCommit?: () => void
  formatValue?: (v: number) => string
}

export function Slider({ label, value, min, max, step = 1, onChange, onCommit, formatValue }: SliderProps) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="panel-label">{label}</span>
        <span className="num text-foreground/80">{formatValue ? formatValue(value) : value}</span>
      </div>
      <input
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onCommit}
        onTouchEnd={onCommit}
      />
    </div>
  )
}
