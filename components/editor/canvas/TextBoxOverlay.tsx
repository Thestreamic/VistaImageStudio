'use client'

import { useEffect, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
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

function editorPlate(color: string, highlight: string | null): string {
  if (highlight) return highlight
  const hex = color.replace('#', '')
  if (hex.length < 6) return 'rgba(20,16,12,0.92)'
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  if (![r, g, b].every((n) => Number.isFinite(n))) return 'rgba(20,16,12,0.92)'
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luma > 0.62 ? 'rgba(20,16,12,0.92)' : 'rgba(255,252,246,0.96)'
}

/**
 * Title box: drag the frame to move, drag handles to grow or shrink the type.
 * Double-click the box to type. A click outside the box leaves edit mode and
 * keeps the words. Confirm and cancel sit under the box.
 */
export function TextBoxOverlay({
  layer,
  zoom,
  editing,
  onStartEdit,
  onExitEdit,
}: {
  layer: Layer
  zoom: number
  editing: boolean
  onStartEdit: () => void
  onExitEdit: () => void
}) {
  const updateTextLayer = useEditorStore((s) => s.updateTextLayer)
  const offsetLayer = useEditorStore((s) => s.offsetLayer)
  const beginTransaction = useEditorStore((s) => s.beginTransaction)
  const endTransaction = useEditorStore((s) => s.endTransaction)
  const applyTextSession = useEditorStore((s) => s.applyTextSession)
  const cancelTextSession = useEditorStore((s) => s.cancelTextSession)
  const rootRef = useRef<HTMLDivElement>(null)
  const fieldRef = useRef<HTMLTextAreaElement>(null)
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

  const leaveEdit = () => {
    const state = useEditorStore.getState()
    const current = state.doc?.layers.find((l) => l.id === layer.id)?.textData
    const baseline = state.textSession?.layerId === layer.id ? state.textSession.baseline.textData : null
    if (current && (!baseline || current.content !== baseline.content)) applyTextSession()
    onExitEdit()
  }
  const leaveRef = useRef(leaveEdit)
  leaveRef.current = leaveEdit

  useEffect(() => {
    if (!editing) return
    const field = fieldRef.current
    if (field) {
      field.focus()
      const end = field.value.length
      field.setSelectionRange(end, end)
    }
    const onPointerDown = (event: PointerEvent) => {
      const node = event.target
      if (node instanceof Node && rootRef.current?.contains(node)) return
      leaveRef.current()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (event.target !== fieldRef.current) return
      event.preventDefault()
      event.stopPropagation()
      leaveRef.current()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [editing])

  if (!layer.textData) return null
  const fontSize = layer.textData.fontSize
  const text = layer.textData

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
    if (editing) return
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    let started = false
    const onMove = (ev: PointerEvent) => {
      if (started) return
      if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) return
      started = true
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      bindDrag({
        kind: 'move',
        startX: ev.clientX,
        startY: ev.clientY,
        fontSize,
        w: layer.source.width,
        h: layer.source.height,
        lx: layer.x,
        ly: layer.y,
        anchor: { x: layer.x, y: layer.y },
      })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onDoubleClick = (e: ReactMouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onStartEdit()
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
      ref={rootRef}
      data-testid="text-box-overlay"
      data-editing={editing ? 'true' : 'false'}
      className="absolute pointer-events-auto"
      style={{
        left: layer.x * zoom,
        top: layer.y * zoom,
        width: Math.max(editing ? 48 : 8, layer.source.width * zoom),
        height: Math.max(editing ? 28 : 8, layer.source.height * zoom),
        zIndex: 13,
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={onDoubleClick}
    >
      {editing ? (
        <textarea
          ref={fieldRef}
          data-testid="text-box-editor"
          value={text.content}
          aria-label="Edit text"
          onChange={(e) => updateTextLayer(layer.id, { content: e.target.value }, false)}
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') return
            e.preventDefault()
            e.stopPropagation()
            leaveEdit()
          }}
          className="absolute inset-0 z-20 resize-none rounded-sm border-2 border-cyan-300 outline-none"
          style={{
            fontFamily: `"${text.fontFamily}", sans-serif`,
            fontWeight: text.fontWeight,
            fontSize: Math.max(12, text.fontSize * zoom),
            lineHeight: text.lineHeight,
            letterSpacing: `${text.letterSpacing * zoom}px`,
            textAlign: text.align,
            textTransform: text.uppercase ? 'uppercase' : 'none',
            color: text.color,
            background: editorPlate(text.color, text.backgroundColor),
            padding: `${Math.max(4, 12 * zoom)}px`,
            boxSizing: 'border-box',
          }}
        />
      ) : (
        <div
          className="absolute inset-0 border-2 border-cyan-300/90 rounded-sm cursor-move"
          title="Double-click to edit. Drag to move."
          onPointerDown={onMovePointer}
        />
      )}
      {!editing && HANDLES.map((h) => (
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
          onClick={(e) => { e.stopPropagation(); leaveEdit() }}
          className="h-8 px-3 rounded-md bg-emerald-500 text-white text-[13px] font-semibold flex items-center gap-1 shadow-lg"
        >
          <Check size={14} /> OK
        </button>
        <button
          type="button"
          title="Cancel title"
          onClick={(e) => { e.stopPropagation(); onExitEdit(); cancelTextSession() }}
          className="h-8 px-3 rounded-md bg-neutral-800 text-white text-[13px] font-semibold flex items-center gap-1 border border-white/20 shadow-lg"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  )
}

/** Invisible boxes over every text layer that is not already selected, so a double-click can open it. */
export function TextLayerHits({
  layers,
  zoom,
  activeId,
  onEdit,
}: {
  layers: Layer[]
  zoom: number
  activeId: string | null
  onEdit: (layerId: string) => void
}) {
  return (
    <>
      {layers.map((layer) => {
        if (!layer.visible || layer.locked || !layer.textData || layer.id === activeId) return null
        return (
          <div
            key={layer.id}
            data-testid="text-layer-hit"
            data-layer-id={layer.id}
            title="Double-click to edit"
            className="absolute cursor-text"
            style={{
              left: layer.x * zoom,
              top: layer.y * zoom,
              width: Math.max(8, layer.source.width * zoom),
              height: Math.max(8, layer.source.height * zoom),
              zIndex: 12,
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onEdit(layer.id)
            }}
          />
        )
      })}
    </>
  )
}
