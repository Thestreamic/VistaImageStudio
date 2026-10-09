'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useCallback, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { ZoomIn, ZoomOut, Maximize2, X, FolderOpen, LayoutTemplate, ImageUp, Sparkles, ArrowRight, LayoutGrid } from 'lucide-react'
import { useEditorStore, selectPhotoLayer } from '@/features/editor/store/editor-store'
import { compositor } from '@/features/editor/engine/compositor'
import { CheckerPattern } from './CheckerPattern'
import { SAFE_ZONE_FRACTIONS, clampCrop } from '@/features/editor/crop-presets'
import { fileFromDataTransfer, isImageFile, canvasFromRecentImport, imageDataOf } from '@/lib/image/canvas'
import { displayPreviewScale, clientToDocument } from '@/features/editor/viewport'
import { floodSelect, rectSelection } from '@/features/editor/engine/selection'
import {
  cellIdFromTransfer,
  collageCellAtPoint,
  isCellDrag,
  isMediaDrag,
  mediaIdFromTransfer,
} from '@/features/editor/media-drag'
import { TextBoxOverlay, TextLayerHits } from './TextBoxOverlay'
import { CollageCellOverlays } from './CollageCellOverlays'
import { CanvasContextMenu } from './CanvasContextMenu'
import { useMobileLayout } from '@/lib/hooks/use-mobile-layout'

const HOLD_COMPARE_MS = 280
const HOLD_COMPARE_MOVE_PX = 12

function canvasLooksOpaque(source: HTMLCanvasElement): boolean {
  const probe = document.createElement('canvas')
  probe.width = 48
  probe.height = 48
  const ctx = probe.getContext('2d', { willReadFrequently: true })
  if (!ctx) return true
  ctx.drawImage(source, 0, 0, 48, 48)
  const { data } = ctx.getImageData(0, 0, 48, 48)
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return false
  }
  return true
}

/** The main composited canvas stage with zoom/pan/tool interaction. */
export function EditorStage({
  onOpenClick,
  onTemplatesClick,
  onDropFile,
  onClose,
}: {
  onOpenClick: () => void
  onTemplatesClick?: () => void
  onDropFile: (file: File | null | undefined) => void
  onClose: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const doc = useEditorStore((s) => s.doc)
  const viewport = useEditorStore((s) => s.viewport)
  const renderVersion = useEditorStore((s) => s.renderVersion)
  const tool = useEditorStore((s) => s.tool)
  const cropDraft = useEditorStore((s) => s.cropDraft)

  const setViewport = useEditorStore((s) => s.setViewport)
  const fitToScreen = useEditorStore((s) => s.fitToScreen)
  const zoomBy = useEditorStore((s) => s.zoomBy)
  const setCropDraft = useEditorStore((s) => s.setCropDraft)
  const applyCrop = useEditorStore((s) => s.applyCrop)
  const offsetLayer = useEditorStore((s) => s.offsetLayer)
  const setSelection = useEditorStore((s) => s.setSelection)
  const beginTransaction = useEditorStore((s) => s.beginTransaction)
  const endTransaction = useEditorStore((s) => s.endTransaction)
  const activeLayer = useEditorStore((s) => s.doc?.layers.find((l) => l.id === s.doc?.activeLayerId) ?? null)
  const wandTolerance = useEditorStore((s) => s.wandTolerance)
  const holdPreview = useEditorStore((s) => s.holdPreview)
  const setHoldPreview = useEditorStore((s) => s.setHoldPreview)
  const getCompareBeforeDoc = useEditorStore((s) => s.getCompareBeforeDoc)
  const mobile = useMobileLayout()
  const startTextSession = useEditorStore((s) => s.startTextSession)
  const placeMediaOnCanvas = useEditorStore((s) => s.placeMediaOnCanvas)
  const rearrangeCollageCells = useEditorStore((s) => s.rearrangeCollageCells)
  const setActiveLayer = useEditorStore((s) => s.setActiveLayer)
  const selection = doc?.selection ?? null
  const [liveMarquee, setLiveMarquee] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const marquee = useRef<{ x0: number; y0: number; clientX: number; clientY: number } | null>(null)
  const liveMarqueeRef = useRef(liveMarquee)
  liveMarqueeRef.current = liveMarquee

  const applyWandAtClient = useCallback((clientX: number, clientY: number) => {
    const current = useEditorStore.getState().doc
    const stage = containerRef.current
    const photo = selectPhotoLayer(useEditorStore.getState())
    if (!current || !stage || !photo) return false
    const view = useEditorStore.getState().viewport
    const pt = clientToDocument(clientX, clientY, stage.getBoundingClientRect(), current.width, current.height, view)
    const lx = pt.x - photo.x
    const ly = pt.y - photo.y
    const img = imageDataOf(photo.source)
    const layerSel = floodSelect(img.data, img.width, img.height, lx, ly, wandTolerance)
    const mask = new Uint8ClampedArray(current.width * current.height)
    const ox = Math.round(photo.x)
    const oy = Math.round(photo.y)
    for (let y = 0; y < img.height; y++) {
      const dy = y + oy
      if (dy < 0 || dy >= current.height) continue
      for (let x = 0; x < img.width; x++) {
        const dx = x + ox
        if (dx < 0 || dx >= current.width) continue
        mask[dy * current.width + dx] = layerSel.mask[y * img.width + x]
      }
    }
    if (!mask.some((v) => v > 8)) return false
    setSelection({ width: current.width, height: current.height, mask })
    return true
  }, [setSelection, wandTolerance])

  const finishMarquee = useCallback(() => {
    const start = marquee.current
    const box = liveMarqueeRef.current
    const current = useEditorStore.getState().doc
    marquee.current = null
    setLiveMarquee(null)
    if (!start || !current) return
    if (box && box.width >= 4 && box.height >= 4) {
      useEditorStore.getState().setSelection(rectSelection(current.width, current.height, box))
      return
    }
    applyWandAtClient(start.clientX, start.clientY)
  }, [applyWandAtClient])

  useEffect(() => {
    const onUp = () => finishMarquee()
    window.addEventListener('pointerup', onUp)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('mouseup', onUp)
    }
  }, [finishMarquee])

  // Keep rendered canvas updated whenever doc or adjustments change
  const [showSafeZones, setShowSafeZones] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const renderTarget = useRef<HTMLCanvasElement | null>(null)
  const userView = useRef(false)

  const applyMediaDrop = useCallback(
    async (transfer: DataTransfer | null, clientX?: number, clientY?: number, targetLayerId?: string) => {
      const id = mediaIdFromTransfer(transfer)
      if (!id) return false
      const item = useEditorStore.getState().recentImports.find((entry) => entry.id === id)
      if (!item) return true
      const current = useEditorStore.getState().doc
      const view = useEditorStore.getState().viewport
      const stage = containerRef.current
      const point =
        current && stage && clientX != null && clientY != null
          ? clientToDocument(clientX, clientY, stage.getBoundingClientRect(), current.width, current.height, view)
          : undefined
      if (item.workingCanvas && item.workingCanvas.width > 1) {
        placeMediaOnCanvas(item.workingCanvas, item.name, point, targetLayerId)
        return true
      }
      const photo = await canvasFromRecentImport(item)
      placeMediaOnCanvas(photo, item.name, point, targetLayerId)
      return true
    },
    [placeMediaOnCanvas],
  )

  useLayoutEffect(() => {
    const paint = () => {
      if (!doc || !canvasRef.current) return false
      const source = holdPreview ? (getCompareBeforeDoc() ?? doc) : doc
      const scale = displayPreviewScale(source.width, source.height)
      const out = compositor.render(source, renderTarget.current ?? undefined, { scale })
      renderTarget.current = out
      const display = canvasRef.current
      const ctx = display.getContext('2d', { alpha: true })
      if (!ctx) return false
      if (display.width !== out.width || display.height !== out.height) {
        display.width = out.width
        display.height = out.height
      }
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.clearRect(0, 0, display.width, display.height)
      ctx.drawImage(out, 0, 0)
      return true
    }
    if (paint()) return
    const id = requestAnimationFrame(() => {
      paint()
    })
    return () => cancelAnimationFrame(id)
  }, [doc, renderVersion, holdPreview, getCompareBeforeDoc])

  const fitNow = useCallback(() => {
    const el = containerRef.current
    if (!el || !doc) return
    const { width, height } = el.getBoundingClientRect()
    if (width < 32 || height < 32) return
    fitToScreen(width, height)
    userView.current = false
  }, [doc, fitToScreen])

  // Fit whenever a new photo opens, and again if the window is resized/maximized.
  useEffect(() => {
    userView.current = false
    fitNow()
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      if (!userView.current) fitNow()
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [doc?.id, doc?.fileName, fitNow])

  const [editingTextId, setEditingTextId] = useState<string | null>(null)

  useEffect(() => {
    if (activeLayer?.textData) startTextSession(activeLayer.id)
  }, [activeLayer?.id, activeLayer?.textData, startTextSession])

  const activeIsText = !!activeLayer?.textData
  useEffect(() => {
    if (!editingTextId) return
    if (activeLayer?.id === editingTextId && activeIsText) return
    useEditorStore.getState().applyTextSession()
    setEditingTextId(null)
  }, [activeLayer?.id, activeIsText, editingTextId])

  // ─── Pan (middle-mouse / space+drag) ────────────────────────────────────
  const isPanning = useRef(false)
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 })

  // ─── Layer drag (move tool) ──────────────────────────────────────────────
  const isDraggingLayer = useRef(false)
  const dragLast = useRef({ x: 0, y: 0 })
  /** Mobile: defer layer-drag until the finger moves, so a hold can show before/after. */
  const pendingLayerDrag = useRef(false)
  const holdCompareTimer = useRef<number | null>(null)
  const holdCompareOrigin = useRef<{ x: number; y: number } | null>(null)

  const clearHoldCompare = useCallback(() => {
    if (holdCompareTimer.current != null) {
      window.clearTimeout(holdCompareTimer.current)
      holdCompareTimer.current = null
    }
    holdCompareOrigin.current = null
    pendingLayerDrag.current = false
    if (useEditorStore.getState().holdPreview) setHoldPreview(false)
  }, [setHoldPreview])

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Controls floating on the stage (zoom, close, safe zones, crop Apply…)
    // must get their own click. Starting a drag here would capture the
    // pointer and swallow that click.
    if (e.target instanceof Element && e.target.closest('button, a, input, select, textarea')) return
    const isMiddle = e.button === 1
    const isSpacePan = tool === 'hand'
    if (isMiddle || isSpacePan) {
      isPanning.current = true
      userView.current = true
      panStart.current = { x: e.clientX, y: e.clientY, panX: viewport.panX, panY: viewport.panY }
      e.currentTarget.setPointerCapture(e.pointerId)
      e.preventDefault()
      return
    }
    if (e.button !== 0 || !doc || !containerRef.current) return

    if (tool === 'select-rect') {
      const pt = clientToDocument(
        e.clientX,
        e.clientY,
        containerRef.current.getBoundingClientRect(),
        doc.width,
        doc.height,
        viewport,
      )
      marquee.current = { x0: pt.x, y0: pt.y, clientX: e.clientX, clientY: e.clientY }
      setLiveMarquee({ x: pt.x, y: pt.y, width: 0, height: 0 })
      e.currentTarget.setPointerCapture(e.pointerId)
      e.preventDefault()
      return
    }

    if (tool === 'select-wand') {
      applyWandAtClient(e.clientX, e.clientY)
      e.preventDefault()
      return
    }

    if (tool === 'move') {
      const canDragLayer =
        !!activeLayer &&
        !activeLayer.locked &&
        !activeLayer.textData &&
        !activeLayer.collageCell

      if (mobile && !document.documentElement.dataset.mobileSheetPeek) {
        holdCompareOrigin.current = { x: e.clientX, y: e.clientY }
        pendingLayerDrag.current = canDragLayer
        holdCompareTimer.current = window.setTimeout(() => {
          holdCompareTimer.current = null
          if (document.documentElement.dataset.mobileSheetPeek) return
          pendingLayerDrag.current = false
          setHoldPreview(true)
        }, HOLD_COMPARE_MS)
        e.currentTarget.setPointerCapture(e.pointerId)
        return
      }

      if (canDragLayer) {
        isDraggingLayer.current = true
        dragLast.current = { x: e.clientX, y: e.clientY }
        beginTransaction()
        e.currentTarget.setPointerCapture(e.pointerId)
        e.preventDefault()
      }
    }
  }, [tool, viewport, activeLayer, beginTransaction, doc, applyWandAtClient, mobile, setHoldPreview])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - panStart.current.x
      const dy = e.clientY - panStart.current.y
      setViewport({ panX: panStart.current.panX + dx, panY: panStart.current.panY + dy })
      return
    }
    if (marquee.current && doc && containerRef.current) {
      const pt = clientToDocument(
        e.clientX,
        e.clientY,
        containerRef.current.getBoundingClientRect(),
        doc.width,
        doc.height,
        viewport,
      )
      const x0 = marquee.current.x0
      const y0 = marquee.current.y0
      setLiveMarquee({
        x: Math.min(x0, pt.x),
        y: Math.min(y0, pt.y),
        width: Math.abs(pt.x - x0),
        height: Math.abs(pt.y - y0),
      })
      return
    }
    if (pendingLayerDrag.current && holdCompareOrigin.current && activeLayer) {
      const ox = holdCompareOrigin.current.x
      const oy = holdCompareOrigin.current.y
      const dist = Math.hypot(e.clientX - ox, e.clientY - oy)
      if (dist >= HOLD_COMPARE_MOVE_PX) {
        if (holdCompareTimer.current != null) {
          window.clearTimeout(holdCompareTimer.current)
          holdCompareTimer.current = null
        }
        holdCompareOrigin.current = null
        pendingLayerDrag.current = false
        if (
          !activeLayer.locked &&
          !activeLayer.textData &&
          !activeLayer.collageCell
        ) {
          isDraggingLayer.current = true
          dragLast.current = { x: e.clientX, y: e.clientY }
          beginTransaction()
        }
      }
      return
    }
    if (holdCompareOrigin.current && holdCompareTimer.current != null) {
      const ox = holdCompareOrigin.current.x
      const oy = holdCompareOrigin.current.y
      if (Math.hypot(e.clientX - ox, e.clientY - oy) >= HOLD_COMPARE_MOVE_PX) {
        window.clearTimeout(holdCompareTimer.current)
        holdCompareTimer.current = null
        holdCompareOrigin.current = null
      }
      return
    }
    if (isDraggingLayer.current && activeLayer) {
      const dx = (e.clientX - dragLast.current.x) / viewport.zoom
      const dy = (e.clientY - dragLast.current.y) / viewport.zoom
      dragLast.current = { x: e.clientX, y: e.clientY }
      offsetLayer(activeLayer.id, dx, dy, false)
    }
  }, [setViewport, activeLayer, viewport, offsetLayer, doc, beginTransaction])

  const onPointerUp = useCallback(() => {
    clearHoldCompare()
    finishMarquee()
    isPanning.current = false
    if (isDraggingLayer.current) {
      isDraggingLayer.current = false
      endTransaction()
    }
  }, [endTransaction, finishMarquee, clearHoldCompare])

  // ─── Scroll-to-zoom ──────────────────────────────────────────────────────
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const stage = containerRef.current
    if (!stage) return
    userView.current = true
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12
    const newZoom = Math.min(Math.max(viewport.zoom * factor, 0.05), 32)
    const rect = stage.getBoundingClientRect()
    const cx = e.clientX - rect.left - rect.width / 2
    const cy = e.clientY - rect.top - rect.height / 2
    setViewport({
      zoom: newZoom,
      panX: cx - (cx - viewport.panX) * (newZoom / viewport.zoom),
      panY: cy - (cy - viewport.panY) * (newZoom / viewport.zoom),
    })
  }, [viewport, setViewport])

  const { zoom, panX, panY } = viewport

  const showChecker = useMemo(
    () =>
      !!doc &&
      doc.layers.some((layer) => layer.visible && layer.kind !== 'watermark' && !canvasLooksOpaque(layer.source)),
    [doc, renderVersion],
  )

  if (!doc) {
    return (
      <EmptyState
        containerRef={containerRef}
        onOpenClick={onOpenClick}
        onTemplatesClick={onTemplatesClick}
        onDropFile={onDropFile}
        onMediaDrop={(transfer) => applyMediaDrop(transfer)}
      />
    )
  }

  return (
    <div data-testid="editor-stage" className="flex-1 flex flex-col min-h-0 min-w-0">
    <div
      ref={containerRef}
      className="flex-1 relative overflow-hidden bg-[var(--canvas)] cursor-crosshair select-none min-h-0"
      style={{
        cursor: tool === 'hand' ? 'grab' : tool === 'crop' || tool === 'select-rect' ? 'crosshair' : tool === 'select-wand' ? 'cell' : tool === 'move' ? 'move' : 'default',
        touchAction: tool === 'select-rect' || tool === 'select-wand' || tool === 'crop' ? 'none' : undefined,
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onWheel={onWheel}
      onContextMenu={(event) => {
        const target = event.target
        if (
          target instanceof Element &&
          target.closest('textarea, input, select, [contenteditable="true"]')
        ) {
          return
        }
        event.preventDefault()
        setContextMenu((open) => (open ? null : { x: event.clientX, y: event.clientY }))
      }}
      onDragOver={(e) => {
        if (isCellDrag(e.dataTransfer)) {
          e.preventDefault()
          e.dataTransfer.dropEffect = 'move'
          return
        }
        if (!isMediaDrag(e.dataTransfer)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'copy'
      }}
      onDrop={(e) => {
        if (isCellDrag(e.dataTransfer)) {
          e.preventDefault()
          e.stopPropagation()
          const fromId = cellIdFromTransfer(e.dataTransfer)
          const stage = containerRef.current
          const current = useEditorStore.getState().doc
          const view = useEditorStore.getState().viewport
          if (!fromId || !stage || !current) return
          const point = clientToDocument(
            e.clientX,
            e.clientY,
            stage.getBoundingClientRect(),
            current.width,
            current.height,
            view,
          )
          const hit = collageCellAtPoint(current.layers, point.x, point.y)
          if (hit) rearrangeCollageCells(fromId, hit.id)
          return
        }
        if (!isMediaDrag(e.dataTransfer)) return
        e.preventDefault()
        e.stopPropagation()
        void applyMediaDrop(e.dataTransfer, e.clientX, e.clientY)
      }}
    >
      {showChecker && <CheckerPattern />}

      {/* Main composited canvas — sized to zoomed CSS pixels so a 12MP
          iPhone frame is not kept as a giant GPU layer. */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{ transform: `translate(${panX}px, ${panY}px)` }}
      >
        <div
          className="relative"
          style={{ width: doc.width * zoom, height: doc.height * zoom }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: '100%',
              height: '100%',
              imageRendering: zoom > 2 ? 'pixelated' : 'auto',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6)',
              display: 'block',
            }}
          />
          {showSafeZones && <SafeZoneOverlay />}
          {selection && <SelectionOverlay selection={selection} />}
          {liveMarquee && liveMarquee.width > 1 && liveMarquee.height > 1 && (
            <div
              data-testid="select-marquee"
              className="absolute border border-sky-400 bg-sky-400/15 pointer-events-none"
              style={{
                left: liveMarquee.x * zoom,
                top: liveMarquee.y * zoom,
                width: liveMarquee.width * zoom,
                height: liveMarquee.height * zoom,
              }}
            />
          )}
          <CollageCellOverlays
            layers={doc.layers}
            zoom={zoom}
            interactive={tool === 'move'}
            onSelect={setActiveLayer}
            onRearrange={rearrangeCollageCells}
            onMediaDrop={(transfer, clientX, clientY, layerId) => {
              void applyMediaDrop(transfer, clientX, clientY, layerId)
            }}
          />
          {tool === 'move' && (
            <TextLayerHits
              layers={doc.layers}
              zoom={zoom}
              activeId={activeLayer?.id ?? null}
              onEdit={(id) => {
                setActiveLayer(id)
                setEditingTextId(id)
              }}
            />
          )}
          {activeLayer?.textData && (
            <TextBoxOverlay
              layer={activeLayer}
              zoom={zoom}
              editing={editingTextId === activeLayer.id}
              onStartEdit={() => setEditingTextId(activeLayer.id)}
              onExitEdit={() => setEditingTextId(null)}
            />
          )}
          {(tool === 'crop' ? cropDraft : doc.crop) && (
            <CropOverlay
              crop={(tool === 'crop' ? cropDraft : doc.crop)!}
              docW={doc.width}
              docH={doc.height}
              zoom={zoom}
              interactive={tool === 'crop'}
              onCropChange={setCropDraft}
              onApply={applyCrop}
            />
          )}
        </div>
      </div>

      <ZoomControls
        zoom={zoom}
        onZoomIn={() => {
          userView.current = true
          zoomBy(1.2)
        }}
        onZoomOut={() => {
          userView.current = true
          zoomBy(1 / 1.2)
        }}
        onFit={fitNow}
        onActual={() => {
          userView.current = true
          setViewport({ zoom: 1, panX: 0, panY: 0 })
        }}
      />
      <SafeZoneToggle on={showSafeZones} onToggle={() => setShowSafeZones((v) => !v)} />
      {holdPreview && (
        <div
          data-testid="hold-compare-badge"
          className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-2.5 py-1 rounded-md bg-black/60 text-white text-[11px] font-semibold tracking-wide"
        >
          BEFORE
        </div>
      )}

      {contextMenu && (
        <CanvasContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}

      <button
        type="button"
        data-testid="stage-close"
        aria-label="Close photo"
        title="Close photo"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onClose}
        className="absolute top-1.5 right-1.5 z-20 w-8 h-8 flex items-center justify-center rounded-md border border-border bg-secondary text-foreground shadow-sm hover:bg-destructive hover:text-destructive-foreground hover:border-destructive pointer-events-auto"
      >
        <X size={16} strokeWidth={2.25} />
      </button>
    </div>
      <div className="h-10 shrink-0 hidden md:flex items-center justify-center bg-card border-t border-border">
        <button
          type="button"
          data-testid="stage-close-tab"
          aria-label="Close photo"
          title="Close photo"
          onClick={onClose}
          className="flex items-center gap-1.5 h-7 px-4 text-xs font-medium rounded-md border border-border bg-secondary text-foreground/85 hover:bg-accent hover:text-foreground transition-colors"
        >
          <X size={14} strokeWidth={2.25} /> Close
        </button>
      </div>
    </div>
  )
}

function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onFit,
  onActual,
}: {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onActual: () => void
}) {
  return (
    <div
      data-testid="zoom-controls"
      className="absolute bottom-3 left-3 flex items-center gap-0.5 rounded-lg bg-black/55 backdrop-blur-sm border border-white/10 p-0.5 pointer-events-auto"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        title="Zoom out"
        aria-label="Zoom out"
        onClick={onZoomOut}
        className="w-8 h-8 flex items-center justify-center rounded-md text-white/90 hover:bg-white/15"
      >
        <ZoomOut size={16} strokeWidth={2} />
      </button>
      <button
        type="button"
        title="Actual pixels (100%)"
        aria-label="Actual pixels"
        onClick={onActual}
        className="min-w-[3.25rem] h-8 px-1 text-[11px] font-mono text-white/90 hover:bg-white/15 rounded-md"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button
        type="button"
        title="Zoom in"
        aria-label="Zoom in"
        onClick={onZoomIn}
        className="w-8 h-8 flex items-center justify-center rounded-md text-white/90 hover:bg-white/15"
      >
        <ZoomIn size={16} strokeWidth={2} />
      </button>
      <button
        type="button"
        title="Fit to window"
        aria-label="Fit to window"
        onClick={onFit}
        className="w-8 h-8 flex items-center justify-center rounded-md text-white/90 hover:bg-white/15"
      >
        <Maximize2 size={15} strokeWidth={2} />
      </button>
    </div>
  )
}

function SafeZoneToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      onMouseDown={(e) => e.stopPropagation()}
      aria-pressed={on}
      className={`absolute bottom-3 left-[11.5rem] h-9 px-3 rounded-lg text-[11px] font-medium pointer-events-auto border backdrop-blur-sm transition-colors ${on ? 'bg-primary text-primary-foreground border-transparent' : 'bg-black/55 border-white/10 text-white/80 hover:text-white hover:bg-black/65'}`}
      title="Show where Instagram / TikTok buttons cover your photo, so captions stay visible"
    >
      Safe zones
    </button>
  )
}

/** IG / TikTok chrome: top profile bar, bottom caption, right like column. */
function SafeZoneOverlay() {
  return (
    <div className="absolute inset-0 pointer-events-none" data-testid="safe-zone-overlay">
      <div className="absolute inset-x-0 top-0 bg-rose-500/25 border-b border-rose-300/50" style={{ height: `${SAFE_ZONE_FRACTIONS.top * 100}%` }} />
      <div className="absolute inset-x-0 bottom-0 bg-rose-500/25 border-t border-rose-300/50" style={{ height: `${SAFE_ZONE_FRACTIONS.bottom * 100}%` }} />
      <div className="absolute top-[14%] bottom-[22%] right-0 bg-rose-500/20 border-l border-rose-300/40" style={{ width: `${SAFE_ZONE_FRACTIONS.right * 100}%` }} />
    </div>
  )
}

// ─── Checker (transparency) Background ───────────────────────────────────────
// Extracted to its own file (CheckerPattern.tsx)

function SelectionOverlay({ selection }: { selection: { width: number; height: number; mask: Uint8ClampedArray } }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const maxEdge = 900
    const scale = Math.min(1, maxEdge / Math.max(selection.width, selection.height))
    const w = Math.max(1, Math.round(selection.width * scale))
    const h = Math.max(1, Math.round(selection.height * scale))
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const img = ctx.createImageData(w, h)
    for (let y = 0; y < h; y++) {
      const sy = Math.min(selection.height - 1, Math.floor(y / scale))
      for (let x = 0; x < w; x++) {
        const sx = Math.min(selection.width - 1, Math.floor(x / scale))
        if (selection.mask[sy * selection.width + sx] > 8) {
          const i = (y * w + x) * 4
          img.data[i] = 56
          img.data[i + 1] = 160
          img.data[i + 2] = 255
          img.data[i + 3] = 80
        }
      }
    }
    ctx.putImageData(img, 0, 0)
  }, [selection])
  return (
    <canvas
      ref={ref}
      data-testid="selection-overlay"
      className="absolute inset-0 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
    />
  )
}

// ─── Crop Overlay ─────────────────────────────────────────────────────────────
interface CropOverlayProps {
  crop: { x: number; y: number; width: number; height: number }
  docW: number
  docH: number
  zoom: number
  interactive: boolean
  onCropChange: (r: { x: number; y: number; width: number; height: number }) => void
  onApply: () => void
}

type CropHandle = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

function CropOverlay({ crop, docW, docH, zoom, interactive, onCropChange, onApply }: CropOverlayProps) {
  const drag = useRef<{ handle: CropHandle; startX: number; startY: number; start: typeof crop } | null>(null)
  // Sit in the photo wrapper (already zoomed). First paint after Compare
  // remounts the stage must not read a container ref that is still null.
  const x0 = crop.x * zoom
  const y0 = crop.y * zoom
  const w = crop.width * zoom
  const h = crop.height * zoom

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const session = drag.current
      if (!session) return
      const dx = (e.clientX - session.startX) / zoom
      const dy = (e.clientY - session.startY) / zoom
      const s = session.start
      const next = { ...s }
      const handle = session.handle
      if (handle === 'move') {
        next.x = s.x + dx
        next.y = s.y + dy
      } else {
        if (handle.includes('w')) { next.x = s.x + dx; next.width = s.width - dx }
        if (handle.includes('e')) next.width = s.width + dx
        if (handle.includes('n')) { next.y = s.y + dy; next.height = s.height - dy }
        if (handle.includes('s')) next.height = s.height + dy
        if (next.width < 8) {
          next.x = s.x + s.width - 8
          next.width = 8
        }
        if (next.height < 8) {
          next.y = s.y + s.height - 8
          next.height = 8
        }
      }
      onCropChange(clampCrop(next, docW, docH))
    }
    const onUp = () => {
      drag.current = null
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [docW, docH, zoom, onCropChange])

  const beginDrag = (handle: CropHandle) => (e: ReactPointerEvent) => {
    if (!interactive) return
    e.stopPropagation()
    e.preventDefault()
    drag.current = { handle, startX: e.clientX, startY: e.clientY, start: { ...crop } }
  }

  const handles: { id: CropHandle; style: CSSProperties }[] = [
    { id: 'nw', style: { left: -8, top: -8, cursor: 'nwse-resize' } },
    { id: 'ne', style: { right: -8, top: -8, cursor: 'nesw-resize' } },
    { id: 'sw', style: { left: -8, bottom: -8, cursor: 'nesw-resize' } },
    { id: 'se', style: { right: -8, bottom: -8, cursor: 'nwse-resize' } },
    { id: 'n', style: { left: '50%', top: -8, marginLeft: -8, cursor: 'ns-resize' } },
    { id: 's', style: { left: '50%', bottom: -8, marginLeft: -8, cursor: 'ns-resize' } },
    { id: 'w', style: { left: -8, top: '50%', marginTop: -8, cursor: 'ew-resize' } },
    { id: 'e', style: { right: -8, top: '50%', marginTop: -8, cursor: 'ew-resize' } },
  ]

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      <div
        className="absolute border-2 border-primary"
        style={{
          left: x0,
          top: y0,
          width: w,
          height: h,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
        }}
      >
        {[1 / 3, 2 / 3].map((t) => (
          <div key={`h${t}`} className="absolute inset-x-0 border-t border-white/25" style={{ top: `${t * 100}%` }} />
        ))}
        {[1 / 3, 2 / 3].map((t) => (
          <div key={`v${t}`} className="absolute inset-y-0 border-l border-white/25" style={{ left: `${t * 100}%` }} />
        ))}
        {interactive && (
          <div
            data-testid="crop-move"
            className="absolute inset-0 pointer-events-auto cursor-move"
            onPointerDown={beginDrag('move')}
          />
        )}
        {interactive && handles.map((hnd) => (
          <div
            key={hnd.id}
            data-testid={`crop-handle-${hnd.id}`}
            className="absolute w-4 h-4 bg-primary border-2 border-white rounded-sm pointer-events-auto z-20 shadow"
            style={hnd.style}
            onPointerDown={beginDrag(hnd.id)}
          />
        ))}
        {interactive && (
          <button
            type="button"
            className="pointer-events-auto absolute -bottom-8 right-0 px-2.5 py-1 text-[11px] bg-primary text-primary-foreground rounded"
            onClick={onApply}
          >
            Apply
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Quick start: blank social canvases in each platform's colours ──────────
// Shapes show the canvas size at a glance; platform logos are left out on purpose.
const QUICK_STARTS = [
  {
    id: 'post',
    label: 'Instagram Post',
    ratio: '1:1',
    width: 1080,
    height: 1080,
    glyph: [18, 18],
    accent: 'linear-gradient(90deg, #f09433 0%, #dc2743 50%, #bc1888 100%)',
    tint: '#dc2743',
  },
  {
    id: 'thumbnail',
    label: 'YouTube Thumbnail',
    ratio: '16:9',
    width: 1280,
    height: 720,
    glyph: [24, 14],
    accent: '#ff1f1f',
    tint: '#ff1f1f',
  },
  {
    id: 'story',
    label: 'Story / Reel',
    ratio: '9:16',
    width: 1080,
    height: 1920,
    glyph: [13, 22],
    accent: 'linear-gradient(90deg, #7f56d9 0%, #e63592 50%, #2e90fa 100%)',
    tint: '#9b5de5',
  },
] as const

const QUICK_START_TILE =
  'relative overflow-hidden flex flex-col items-center justify-start gap-1.5 px-1.5 pt-4 pb-3 rounded-lg border border-border bg-card text-center transition-[transform,box-shadow,border-color] duration-150 ease-out group shadow-2xs hover:shadow-md hover:-translate-y-0.5 hover:border-[color:var(--qs-tint)] active:translate-y-0 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none'

/** Coloured strip across the top of a quick-start tile. */
function AccentBar({ accent }: { accent: string }) {
  return (
    <span
      aria-hidden
      className="absolute inset-x-0 top-0 h-[3px] opacity-85 transition-opacity group-hover:opacity-100"
      style={{ background: accent }}
    />
  )
}

/** The canvas shape at a glance, filled with the platform colour. */
function RatioGlyph({ w, h, accent }: { w: number; h: number; accent: string }) {
  return (
    <span className="h-[24px] flex items-center justify-center" aria-hidden>
      <span
        className="block rounded-[4px] shadow-sm transition-transform group-hover:scale-110"
        style={{ width: w, height: h, background: accent }}
      />
    </span>
  )
}

// ─── Empty state: "Start editing" — open, template, or drop ─────────────────
function EmptyState({
  containerRef,
  onOpenClick,
  onTemplatesClick,
  onDropFile,
  onMediaDrop,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>
  onOpenClick: () => void
  onTemplatesClick?: () => void
  onDropFile: (file: File | null | undefined) => void
  onMediaDrop: (transfer: DataTransfer) => Promise<boolean>
}) {
  const [dragOver, setDragOver] = useState(false)
  const newDocument = useEditorStore((s) => s.newDocument)
  const createCollage = useEditorStore((s) => s.createCollage)
  const notify = useEditorStore((s) => s.notify)

  return (
    <div
      ref={containerRef}
      className="flex-1 min-w-0 flex items-center justify-center bg-[var(--canvas)] p-10 max-md:py-5 max-md:pr-4 max-md:pl-16 select-none overflow-y-auto"
    >
      <div className="w-full max-w-[570px] flex flex-col items-center gap-5 max-md:gap-4">
        <div className="text-center space-y-1.5">
          <h2 className="text-[24px] max-md:text-[20px] font-bold tracking-[-0.022em] text-foreground">Start editing</h2>
          <p className="text-[13.5px] text-muted-foreground">Open a photo, or start from a social template.</p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2.5">
          <button
            type="button"
            data-testid="empty-open"
            onClick={onOpenClick}
            className="min-h-10 max-md:min-h-11 inline-flex items-center gap-2 px-4.5 rounded-lg btn-create text-[13.5px] font-semibold shadow-sm transition-[filter,transform] hover:brightness-105 active:translate-y-px focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
          >
            <FolderOpen size={16} strokeWidth={2.1} />
            <span className="hidden md:inline">Open Photo</span>
            <span className="md:hidden">Browse photos</span>
          </button>
          {onTemplatesClick && (
            <button
              type="button"
              data-testid="empty-templates"
              onClick={onTemplatesClick}
              title="Social sizes, quick-start posts and collages"
              className="min-h-10 max-md:min-h-11 inline-flex items-center gap-2 px-4.5 rounded-lg border border-border bg-card text-foreground text-[13.5px] font-medium transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none"
            >
              <LayoutTemplate size={16} strokeWidth={1.9} /> Choose Template
            </button>
          )}
        </div>

        <div
          role="button"
          tabIndex={0}
          data-testid="empty-dropzone"
          aria-label="Drop photo here, or click to browse"
          onClick={onOpenClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onOpenClick()
            }
          }}
          onDragEnter={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
            setDragOver(true)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'copy'
            setDragOver(true)
          }}
          onDragLeave={(e) => {
            e.preventDefault()
            setDragOver(false)
          }}
          onDrop={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setDragOver(false)
            void (async () => {
              if (await onMediaDrop(e.dataTransfer)) return
              const file = fileFromDataTransfer(e.dataTransfer)
              if (file && !isImageFile(file)) return
              onDropFile(file)
            })()
          }}
          className={`brand-dropzone w-full rounded-xl flex flex-col items-center justify-center gap-3 py-8 px-6 max-md:py-6 max-md:px-4 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none ${dragOver ? 'scale-[1.01] border-solid' : ''}`}
        >
          <div
            className={`w-12 h-12 rounded-full flex items-center justify-center ring-1 transition-colors ${dragOver ? 'bg-primary text-primary-foreground ring-primary' : 'bg-secondary text-foreground ring-border'}`}
          >
            <ImageUp size={21} strokeWidth={1.7} />
          </div>
          <div className="text-center space-y-1">
            <p className="text-[15px] font-semibold tracking-[-0.016em] text-foreground">
              {dragOver ? 'Drop it right here' : 'Drag & drop a photo'}
            </p>
            <p className="hidden md:block text-[13px] text-muted-foreground">Drop photo here, or click to browse your files</p>
            <p className="md:hidden text-[13px] text-muted-foreground">or tap to browse your camera roll</p>
          </div>
          <p className="text-[11.5px] text-muted-foreground num">JPEG · PNG · HEIC · WebP · AVIF · TIFF</p>
        </div>

        {/* Quick Start Section */}
        <div className="w-full space-y-2.5 pt-0.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[12.5px] font-semibold text-foreground tracking-tight flex items-center gap-1.5">
              <Sparkles size={13} className="text-primary" />
              Quick Start
            </span>
            {onTemplatesClick && (
              <button
                type="button"
                onClick={onTemplatesClick}
                title="All templates, sizes and collages"
                className="inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:text-primary-hover hover:underline underline-offset-2 transition-colors focus-visible:ring-1 focus-visible:ring-primary/60 focus-visible:outline-none rounded-sm px-1 py-0.5 group"
              >
                See all <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-4 max-sm:grid-cols-2 gap-2.5">
            {QUICK_STARTS.map((q) => (
              <button
                key={q.id}
                type="button"
                data-testid={`quick-start-${q.id}`}
                onClick={() => {
                  newDocument(q.width, q.height)
                  notify('info', `Started ${q.label} (${q.width} × ${q.height})`)
                }}
                title={`${q.label} (${q.ratio} · ${q.width} × ${q.height})`}
                className={QUICK_START_TILE}
                style={{ '--qs-tint': q.tint } as React.CSSProperties}
              >
                <AccentBar accent={q.accent} />
                <RatioGlyph w={q.glyph[0]} h={q.glyph[1]} accent={q.accent} />
                <span className="text-[12px] font-semibold text-foreground leading-tight whitespace-nowrap">{q.label}</span>
                <span className="text-[11px] text-muted-foreground num leading-none">{q.width} × {q.height}</span>
              </button>
            ))}
            <button
              type="button"
              data-testid="quick-start-collage"
              onClick={() => {
                if (onTemplatesClick) onTemplatesClick()
                else createCollage('split-2h')
              }}
              title="Collage layouts and occasion frames"
              className={QUICK_START_TILE}
              style={{ '--qs-tint': 'var(--primary)' } as React.CSSProperties}
            >
              <AccentBar accent="var(--brand-gradient)" />
              <span className="h-[24px] flex items-center justify-center">
                <LayoutGrid size={21} strokeWidth={2} className="text-primary transition-transform group-hover:scale-110" />
              </span>
              <span className="text-[12px] font-semibold text-foreground leading-tight whitespace-nowrap">Collage</span>
              <span className="text-[11px] text-muted-foreground leading-none">2–6 photos</span>
            </button>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-1.5 text-[11.5px] text-muted-foreground pt-1">
          <kbd className="px-1.5 py-0.5 rounded-sm bg-secondary border border-border font-mono text-[11px] font-medium">Ctrl</kbd>
          <span>+</span>
          <kbd className="px-1.5 py-0.5 rounded-sm bg-secondary border border-border font-mono text-[11px] font-medium">O</kbd>
          <span className="ml-1.5">to open · On-device AI · No account required</span>
        </div>
      </div>
    </div>
  )
}
