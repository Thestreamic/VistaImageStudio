'use client'
import { useRef, useState, useCallback } from 'react'
import type { CurveChannel, Curves, CurvePoint } from '@/features/editor/types'
import { cn } from '@/lib/utils'

const CHANNELS: { id: CurveChannel; label: string; color: string }[] = [
  { id: 'rgb', label: 'RGB', color: '#e5e5e5' },
  { id: 'r', label: 'R', color: '#ef4444' },
  { id: 'g', label: 'G', color: '#22c55e' },
  { id: 'b', label: 'B', color: '#3b82f6' },
]

const SIZE = 180

interface CurvesEditorProps {
  curves: Curves
  onChange: (curves: Curves) => void
  onCommit: () => void
}

export function CurvesEditor({ curves, onChange, onCommit }: CurvesEditorProps) {
  const [channel, setChannel] = useState<CurveChannel>('rgb')
  const svgRef = useRef<SVGSVGElement>(null)
  const dragIndex = useRef<number | null>(null)

  const points = curves[channel]

  const toSvg = (p: CurvePoint) => ({ x: (p.x / 255) * SIZE, y: SIZE - (p.y / 255) * SIZE })
  const fromSvg = (sx: number, sy: number): CurvePoint => ({
    x: Math.round(Math.max(0, Math.min(255, (sx / SIZE) * 255))),
    y: Math.round(Math.max(0, Math.min(255, ((SIZE - sy) / SIZE) * 255))),
  })

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${toSvg(p).x.toFixed(1)} ${toSvg(p).y.toFixed(1)}`)
    .join(' ')

  const updatePoint = useCallback((index: number, next: CurvePoint) => {
    const sorted = [...points]
    sorted[index] = next
    // keep endpoints pinned to x=0 / x=255, keep sort order for interior points
    if (index !== 0 && index !== sorted.length - 1) {
      sorted.sort((a, b) => a.x - b.x)
    }
    onChange({ ...curves, [channel]: sorted })
  }, [points, curves, channel, onChange])

  const handlePointerDown = (e: React.PointerEvent, index: number) => {
    e.stopPropagation()
    dragIndex.current = index
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }

  const handleSvgPointerMove = (e: React.PointerEvent) => {
    if (dragIndex.current === null || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    const idx = dragIndex.current
    const pinnedX = idx === 0 ? 0 : idx === points.length - 1 ? 255 : undefined
    const p = fromSvg(sx, sy)
    updatePoint(idx, pinnedX !== undefined ? { ...p, x: pinnedX } : p)
  }

  const handleSvgPointerUp = () => {
    dragIndex.current = null
    onCommit()
  }

  const handleSvgDoubleClick = (e: React.MouseEvent) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const p = fromSvg(e.clientX - rect.left, e.clientY - rect.top)
    const next = [...points, p].sort((a, b) => a.x - b.x)
    onChange({ ...curves, [channel]: next })
    onCommit()
  }

  const removePoint = (index: number) => {
    if (index === 0 || index === points.length - 1) return // keep endpoints
    const next = points.filter((_, i) => i !== index)
    onChange({ ...curves, [channel]: next })
    onCommit()
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="panel-label">Curves</span>
        <div className="flex gap-0.5">
          {CHANNELS.map((c) => (
            <button
              key={c.id}
              onClick={() => setChannel(c.id)}
              className={cn(
                'w-6 h-5 text-[9px] font-mono rounded-sm',
                channel === c.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      <svg
        ref={svgRef}
        width={SIZE}
        height={SIZE}
        className="rounded border border-border bg-black/20 touch-none"
        onPointerMove={handleSvgPointerMove}
        onPointerUp={handleSvgPointerUp}
        onDoubleClick={handleSvgDoubleClick}
      >
        {/* grid */}
        {[1, 2, 3].map((i) => (
          <line key={`h${i}`} x1={0} y1={(SIZE / 4) * i} x2={SIZE} y2={(SIZE / 4) * i} stroke="white" strokeOpacity={0.06} />
        ))}
        {[1, 2, 3].map((i) => (
          <line key={`v${i}`} x1={(SIZE / 4) * i} y1={0} x2={(SIZE / 4) * i} y2={SIZE} stroke="white" strokeOpacity={0.06} />
        ))}
        {/* diagonal reference */}
        <line x1={0} y1={SIZE} x2={SIZE} y2={0} stroke="white" strokeOpacity={0.08} strokeDasharray="2 3" />
        {/* curve */}
        <path d={pathD} fill="none" stroke={CHANNELS.find((c) => c.id === channel)!.color} strokeWidth={1.5} />
        {/* control points */}
        {points.map((p, i) => {
          const s = toSvg(p)
          return (
            <circle
              key={i}
              cx={s.x}
              cy={s.y}
              r={4}
              fill="var(--background)"
              stroke={CHANNELS.find((c) => c.id === channel)!.color}
              strokeWidth={1.5}
              className="cursor-pointer"
              onPointerDown={(e) => handlePointerDown(e, i)}
              onContextMenu={(e) => { e.preventDefault(); removePoint(i) }}
            />
          )
        })}
      </svg>
      <p className="text-[9px] text-muted-foreground">Double-click to add a point · right-click to remove</p>
    </div>
  )
}
