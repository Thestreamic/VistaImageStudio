'use client'

import { useEffect, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent as ReactPointerEvent, type WheelEvent } from 'react'
import type { Layer } from '@/features/editor/types'
import {
  cellIdFromTransfer,
  isCellDrag,
  isMediaDrag,
  setCellDragData,
} from '@/features/editor/media-drag'
import {
  clampCollageFit,
  collageFitFromDrag,
  type CollageFitHandle,
} from '@/features/editor/engine/collage'
import { collageSlotOverlayBox, inverseRotateDelta } from '@/features/editor/collage/geometry'
import { useEditorStore } from '@/features/editor/store/editor-store'
import { collageFrameColor } from '@/features/editor/collage-frame'
import { cn } from '@/lib/utils'

const FIT_HANDLES: { id: Exclude<CollageFitHandle, 'move'>; style: CSSProperties }[] = [
  { id: 'nw', style: { left: -8, top: -8, cursor: 'nwse-resize' } },
  { id: 'ne', style: { right: -8, top: -8, cursor: 'nesw-resize' } },
  { id: 'sw', style: { left: -8, bottom: -8, cursor: 'nesw-resize' } },
  { id: 'se', style: { right: -8, bottom: -8, cursor: 'nwse-resize' } },
  { id: 'n', style: { left: '50%', top: -8, marginLeft: -8, cursor: 'ns-resize' } },
  { id: 's', style: { left: '50%', bottom: -8, marginLeft: -8, cursor: 'ns-resize' } },
  { id: 'w', style: { left: -8, top: '50%', marginTop: -8, cursor: 'ew-resize' } },
  { id: 'e', style: { right: -8, top: '50%', marginTop: -8, cursor: 'ew-resize' } },
]

/** Hit boxes on each collage cell: drop photos, rearrange, pan/zoom every filled frame. */
export function CollageCellOverlays({
  layers,
  zoom,
  interactive,
  onSelect,
  onRearrange,
  onMediaDrop,
}: {
  layers: Layer[]
  zoom: number
  interactive: boolean
  onSelect: (layerId: string) => void
  onRearrange: (fromLayerId: string, toLayerId: string) => void
  onMediaDrop: (transfer: DataTransfer, clientX: number, clientY: number, layerId: string) => void
}) {
  const [hoverId, setHoverId] = useState<string | null>(null)
  const ghostRef = useRef<HTMLCanvasElement | null>(null)
  const drag = useRef<
    | {
        kind: 'fit'
        layerId: string
        handle: CollageFitHandle
        startX: number
        startY: number
        startFit: ReturnType<typeof clampCollageFit>
        sourceW: number
        sourceH: number
        cellW: number
        cellH: number
        zoom: number
        rotation: number
      }
    | {
        kind: 'frame'
        layerId: string
        startX: number
        startY: number
        origX: number
        origY: number
        zoom: number
      }
    | null
  >(null)

  const activeLayerId = useEditorStore((s) => s.doc?.activeLayerId ?? null)
  const setCollageFit = useEditorStore((s) => s.setCollageFit)
  const setCollageFramePosition = useEditorStore((s) => s.setCollageFramePosition)
  const beginTransaction = useEditorStore((s) => s.beginTransaction)
  const endTransaction = useEditorStore((s) => s.endTransaction)

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const session = drag.current
      if (!session) return
      if (session.kind === 'frame') {
        const dx = (e.clientX - session.startX) / session.zoom
        const dy = (e.clientY - session.startY) / session.zoom
        setCollageFramePosition(session.layerId, session.origX + dx, session.origY + dy, false)
        return
      }
      const dx = (e.clientX - session.startX) / session.zoom
      const dy = (e.clientY - session.startY) / session.zoom
      const local = inverseRotateDelta(dx, dy, session.rotation)
      const fit = collageFitFromDrag(
        session.startFit,
        session.handle,
        local.dx,
        local.dy,
        session.sourceW,
        session.sourceH,
        session.cellW,
        session.cellH,
      )
      setCollageFit(session.layerId, fit, false)
    }
    const onUp = () => {
      if (!drag.current) return
      drag.current = null
      endTransaction()
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [endTransaction, setCollageFit, setCollageFramePosition])

  const cells = layers.filter((layer) => layer.collageCell)
  if (!cells.length) return null

  const accept = (e: DragEvent, layerId: string) => {
    if (!isMediaDrag(e.dataTransfer) && !isCellDrag(e.dataTransfer)) return false
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = isCellDrag(e.dataTransfer) ? 'move' : 'copy'
    setHoverId(layerId)
    return true
  }

  const startCellDrag = (e: DragEvent, layer: Layer) => {
    setCellDragData(e.dataTransfer, layer.id)
    const ghost = document.createElement('canvas')
    ghost.width = 72
    ghost.height = 72
    const ctx = ghost.getContext('2d')
    if (ctx) {
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(layer.source, 0, 0, 72, 72)
    }
    ghostRef.current = ghost
    e.dataTransfer.setDragImage(ghost, 36, 36)
  }

  const beginFitDrag = (layer: Layer, handle: CollageFitHandle) => (e: ReactPointerEvent) => {
    if (!interactive || !layer.collageFilled || layer.locked || !layer.collageCell || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    onSelect(layer.id)
    const original = layer.collageOriginal ?? layer.source
    drag.current = {
      kind: 'fit',
      layerId: layer.id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startFit: clampCollageFit(layer.collageFit),
      sourceW: original.width,
      sourceH: original.height,
      cellW: layer.collageCell.width,
      cellH: layer.collageCell.height,
      zoom,
      rotation: layer.collageSlot?.rotation ?? 0,
    }
    beginTransaction()
  }

  const beginFrameDrag = (layer: Layer) => (e: ReactPointerEvent) => {
    if (!interactive || layer.locked || !layer.collageCell || e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    onSelect(layer.id)
    drag.current = {
      kind: 'frame',
      layerId: layer.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: layer.x,
      origY: layer.y,
      zoom,
    }
    beginTransaction()
  }

  return (
    <>
      {cells.map((layer, index) => {
        const filled = !!layer.collageFilled
        const selected = layer.id === activeLayerId
        const dropping = hoverId === layer.id
        const canAdjust = interactive && filled && !layer.locked
        const frame = collageFrameColor(index)
        const box = collageSlotOverlayBox(layer, zoom)
        return (
          <div
            key={layer.id}
            data-testid="collage-cell"
            data-cell-id={layer.id}
            data-filled={filled ? 'true' : 'false'}
            data-selected={selected ? 'true' : 'false'}
            data-frame={frame.stroke}
            data-shape={box.shape}
            draggable={false}
            className={cn(
              'collage-frame absolute box-border touch-none',
              filled ? 'collage-frame-filled' : 'collage-frame-empty',
              selected && 'collage-frame-selected',
              dropping && 'collage-frame-drop',
              box.shape === 'circle' && 'collage-frame-circle',
              box.shape === 'polaroid' && 'collage-frame-polaroid',
            )}
            style={{
              left: box.left,
              top: box.top,
              width: box.width,
              height: box.height,
              transform: box.rotation ? `rotate(${box.rotation}deg)` : undefined,
              transformOrigin: `${box.originX}px ${box.originY}px`,
              pointerEvents: interactive ? 'auto' : 'none',
              cursor: interactive
                ? canAdjust
                  ? 'move'
                  : filled
                    ? 'grab'
                    : 'move'
                : undefined,
              zIndex: selected ? 6 : dropping ? 4 : 1,
              borderRadius: box.shape === 'circle' ? '50%' : box.radius,
              ['--frame-color' as string]: frame.stroke,
              ['--frame-fill' as string]: frame.fill,
              ['--frame-glow' as string]: frame.glow,
              ['--frame-ink' as string]: frame.ink,
            }}
            onPointerDown={(e) => {
              e.stopPropagation()
              onSelect(layer.id)
              if (layer.locked) return
              if (e.altKey || !filled) {
                beginFrameDrag(layer)(e)
                return
              }
              beginFitDrag(layer, 'move')(e)
            }}
            onClick={(e) => e.stopPropagation()}
            onWheel={(e: WheelEvent<HTMLDivElement>) => {
              if (!canAdjust) return
              e.preventDefault()
              e.stopPropagation()
              const fit = clampCollageFit(layer.collageFit)
              const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08
              setCollageFit(layer.id, { scale: fit.scale * factor }, false)
            }}
            onDragStart={(e) => {
              e.preventDefault()
            }}
            onDragEnd={() => {
              ghostRef.current = null
              setHoverId(null)
            }}
            onDragEnter={(e) => accept(e, layer.id)}
            onDragOver={(e) => accept(e, layer.id)}
            onDragLeave={(e) => {
              if (e.currentTarget.contains(e.relatedTarget as Node)) return
              setHoverId((id) => (id === layer.id ? null : id))
            }}
            onDrop={(e) => {
              if (!isMediaDrag(e.dataTransfer) && !isCellDrag(e.dataTransfer)) return
              e.preventDefault()
              e.stopPropagation()
              setHoverId(null)
              const fromId = cellIdFromTransfer(e.dataTransfer)
              if (fromId) {
                onRearrange(fromId, layer.id)
                return
              }
              onMediaDrop(e.dataTransfer, e.clientX, e.clientY, layer.id)
            }}
          >
            {!filled && (selected || dropping) && (
              <span className="collage-frame-badge" data-testid="collage-frame-badge">
                {dropping ? 'Drop photo' : 'Add a photo'}
              </span>
            )}
            {canAdjust && (
              <>
                <div
                  data-testid="collage-rearrange-grip"
                  draggable
                  title="Drag to another box"
                  className="collage-frame-grip"
                  onPointerDown={(e) => e.stopPropagation()}
                  onDragStart={(e) => {
                    e.stopPropagation()
                    startCellDrag(e, layer)
                  }}
                />
                {FIT_HANDLES.map((hnd) => (
                  <div
                    key={hnd.id}
                    data-testid={`collage-handle-${hnd.id}`}
                    className="collage-frame-handle"
                    style={hnd.style}
                    onPointerDown={beginFitDrag(layer, hnd.id)}
                  />
                ))}
              </>
            )}
          </div>
        )
      })}
    </>
  )
}
