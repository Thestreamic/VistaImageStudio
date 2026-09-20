'use client'

import { useRef, type PointerEvent as ReactPointerEvent } from 'react'
import { Check, X } from 'lucide-react'
import type { Layer } from '@/features/editor/types'
import { useEditorStore } from '@/features/editor/store/editor-store'

type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const HANDLES: { id: Handle; cursor: string; className: string }[] = [
  { id: 'nw', cursor: 'nwse-resize', className: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2' },
  { id: 'n', cursor: 'ns-resize', className: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2' },
  { id: 'ne', cursor: 'nesw-resize', className: 'right-0 top-0 translate-x-1/2 -translate-y-1/2' },
  { id: 'e', cursor: 'ew-resize', className: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2' },
  { id: 'se', cursor: 'nwse-resize', className: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2' },
  { id: 's', cursor: 'ns-resize', className: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2' },
  { id: 'sw', cursor: 'nesw-resize', className: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2' },
  { id: 'w', cursor: 'ew-resize', className: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2' },
]

function anchorFor(handle: Handle, x: number, y: number, w: number, h: number) {
  switch (handle) {
    case 'se': return { x, y }
    case 'sw': return { x: x + w, y }
    case 'ne': return { x, y: y + h }
    case 'nw': return { x: x + w, y: y + h }
    case 'e': return { x, y: y + h / 2 }
    case 'w': return { x: x + w, y: y + h / 2 }
    case 's': return { x: x + w / 2, y }
    case 'n': return { x: x + w / 2, y: y + h }
  }
}

/**
 * Filmora-style title box: drag the frame to move, drag handles to grow/shrink
 * the type size. Confirm/cancel sit under the box.
 */
export function TextBoxOverlay({ layer, zoom }: { layer: Layer; zoom: number }) {
  const updateTextLayer = useEditorStore((s) => s.updateTextLayer)
  const offsetLayer = useEditorStore((s) => s.offsetLayer)
  const beginTransaction = useEditorStore((s) => s.beginTransaction)
  const endTransaction = useEditorStore((s) => s.endTransaction)
  const applyTextSession = useEditorStore((s) => s.applyTextSession)
  const cancelTextSession = useEditorStore((s) => s.cancelTextSession)
  const drag = useRef<{
    kind: 'move' | 'scale'
    handle?: Handle
    startX: number
    startY: number
    fontSize: number
    w: number
    h: number
    lx: number
    ly: number
    anchor: { x: number; y: number }
  } | null>(null)

  if (!layer.textData) return null
  const fontSize = layer.textData.fontSize

  const bindDrag = (start: NonNullable<typeof drag.current>) => {
    drag.current = start
    beginTransaction()
    const onMove = (ev: PointerEvent) => {
      const d = drag.current
      if (!d) return
      if (d.kind === 'move') {
        const dx = (ev.clientX - d.startX) / zoom
        const dy = (ev.clientY - d.startY) / zoom
        d.startX = ev.clientX
        d.startY = ev.clientY
        offsetLayer(layer.id, dx, dy, false)
        return
      }
      const dx = (ev.clientX - d.startX) / zoom
      const dy = (ev.clientY - d.startY) / zoom
      let newW = d.w
      let newH = d.h
      const hdl = d.handle!
      if (hdl.includes('e')) newW = d.w + dx
      if (hdl.includes('w')) newW = d.w - dx
      if (hdl.includes('s')) newH = d.h + dy
      if (hdl.includes('n')) newH = d.h - dy
      const sx = newW / Math.max(1, d.w)
      const sy = newH / Math.max(1, d.h)
      const raw =
        hdl === 'e' || hdl === 'w' ? sx
        : hdl === 'n' || hdl === 's' ? sy
        : Math.abs(sx - 1) > Math.abs(sy - 1) ? sx : sy
      const scale = Math.max(0.15, Math.min(8, raw))
      const nextSize = Math.max(12, Math.min(400, Math.round(d.fontSize * scale)))
      const current = useEditorStore.getState().doc?.layers.find((l) => l.id === layer.id)
      if (!current?.textData || nextSize === current.textData.fontSize) return
      updateTextLayer(layer.id, { fontSize: nextSize }, false, d.anchor)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      drag.current = null
      endTransaction()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onMovePointer = (e: ReactPointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    bindDrag({
      kind: 'move',
      startX: e.clientX,
      startY: e.clientY,
      fontSize,
      w: layer.source.width,
      h: layer.source.height,
      lx: layer.x,
      ly: layer.y,
      anchor: { x: layer.x, y: layer.y },
    })
  }

  const onScalePointer = (handle: Handle, e: ReactPointerEvent) => {
    e.stopPropagation()
    e.preventDefault()
    const w = layer.source.width
    const h = layer.source.height
    bindDrag({
      kind: 'scale',
      handle,
      startX: e.clientX,
      startY: e.clientY,
      fontSize,
      w,
      h,
      lx: layer.x,
      ly: layer.y,
      anchor: anchorFor(handle, layer.x, layer.y, w, h),
    })
  }

  return (
    <div
      data-testid="text-box-overlay"
      className="absolute pointer-events-auto"
      style={{
        left: layer.x * zoom,
        top: layer.y * zoom,
        width: Math.max(8, layer.source.width * zoom),
        height: Math.max(8, layer.source.height * zoom),
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div
        className="absolute inset-0 border-2 border-cyan-300/90 rounded-sm cursor-move"
        onPointerDown={onMovePointer}
      />
      {HANDLES.map((h) => (
        <button
          key={h.id}
          type="button"
          aria-label={`Resize ${h.id}`}
          className={`absolute z-10 w-3 h-3 bg-white border-2 border-cyan-400 rounded-[2px] ${h.className}`}
          style={{ cursor: h.cursor }}
          onPointerDown={(e) => onScalePointer(h.id, e)}
        />
      ))}
      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 flex items-center gap-1 pointer-events-auto">
        <button
          type="button"
          title="Apply title"
          onClick={(e) => { e.stopPropagation(); applyTextSession() }}
          className="h-8 px-3 rounded-md bg-emerald-500 text-white text-[13px] font-semibold flex items-center gap-1 shadow-lg"
        >
          <Check size={14} /> OK
        </button>
        <button
          type="button"
          title="Cancel title"
          onClick={(e) => { e.stopPropagation(); cancelTextSession() }}
          className="h-8 px-3 rounded-md bg-neutral-800 text-white text-[13px] font-semibold flex items-center gap-1 border border-white/20 shadow-lg"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  )
}
