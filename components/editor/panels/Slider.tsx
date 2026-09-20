'use client'
import { useState } from 'react'

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
  const [dragging, setDragging] = useState(false)
  const text = formatValue ? formatValue(value) : String(value)
  const pct = max === min ? 0 : ((value - min) / (max - min)) * 100

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="panel-label">{label}</span>
        <span className="num text-foreground/80">{text}</span>
      </div>
      <div className="relative">
        {dragging && (
          <span
            className="pointer-events-none absolute -top-7 z-10 -translate-x-1/2 rounded-md bg-foreground px-1.5 py-0.5 text-[10px] font-mono text-background shadow-sm"
            style={{ left: `${pct}%` }}
          >
            {text}
          </span>
        )}
        <input
          type="range"
          className="slider"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-valuetext={text}
          onChange={(e) => onChange(Number(e.target.value))}
          onPointerDown={() => setDragging(true)}
          onPointerUp={() => {
            setDragging(false)
            onCommit?.()
          }}
          onPointerCancel={() => setDragging(false)}
          onMouseUp={onCommit}
          onTouchEnd={onCommit}
        />
      </div>
    </div>
  )
}
