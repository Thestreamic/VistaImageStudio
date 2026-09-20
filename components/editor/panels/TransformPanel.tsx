'use client'
import { useState } from 'react'
import { RotateCw, RotateCcw, FlipHorizontal, FlipVertical, Crop, ImagePlus, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react'
import { useEditorStore, selectWatermarkLayer, selectActiveLayer } from '@/features/editor/store/editor-store'
import { CROP_PRESETS, cropRectForCustom, cropRectForPreset } from '@/features/editor/crop-presets'
import { canvasFromBlob } from '@/lib/image/canvas'
import { clampCollageFit, DEFAULT_COLLAGE_FIT } from '@/features/editor/engine/collage'
import type { WatermarkCorner } from '@/features/editor/types'
import { cn } from '@/lib/utils'

const CORNERS: { id: WatermarkCorner; label: string }[] = [
  { id: 'tl', label: 'TL' },
  { id: 'tr', label: 'TR' },
  { id: 'bl', label: 'BL' },
  { id: 'br', label: 'BR' },
  { id: 'center', label: 'Center' },
]

export function TransformPanel() {
  const doc = useEditorStore((s) => s.doc)
  const resize = useEditorStore((s) => s.resize)
  const rotate90 = useEditorStore((s) => s.rotate90)
  const flip = useEditorStore((s) => s.flip)
  const setTool = useEditorStore((s) => s.setTool)
  const setCropDraft = useEditorStore((s) => s.setCropDraft)
  const setLiveCrop = useEditorStore((s) => s.setLiveCrop)
  const bakeCrop = useEditorStore((s) => s.bakeCrop)
  const addWatermarkLayer = useEditorStore((s) => s.addWatermarkLayer)
  const updateWatermark = useEditorStore((s) => s.updateWatermark)
  const watermark = useEditorStore(selectWatermarkLayer)
  const activeLayer = useEditorStore(selectActiveLayer)
  const setCollageFit = useEditorStore((s) => s.setCollageFit)
  const setCollageFramePosition = useEditorStore((s) => s.setCollageFramePosition)
  const offsetLayer = useEditorStore((s) => s.offsetLayer)
  const setActiveLayer = useEditorStore((s) => s.setActiveLayer)
  const beginTransaction = useEditorStore((s) => s.beginTransaction)
  const endTransaction = useEditorStore((s) => s.endTransaction)
  const notify = useEditorStore((s) => s.notify)

  const [w, setW] = useState(doc?.width ?? 0)
  const [h, setH] = useState(doc?.height ?? 0)
  const [lockRatio, setLockRatio] = useState(true)
  const [customW, setCustomW] = useState(4)
  const [customH, setCustomH] = useState(5)
  const ratio = doc ? doc.width / doc.height : 1

  if (!doc) return null

  const onWidthChange = (v: number) => {
    setW(v)
    if (lockRatio) setH(Math.round(v / ratio))
  }
  const onHeightChange = (v: number) => {
    setH(v)
    if (lockRatio) setW(Math.round(v * ratio))
  }

  const startCrop = (presetId: string) => {
    setTool('crop')
    const rect = cropRectForPreset(doc.width, doc.height, presetId)
    setCropDraft(rect)
  }

  const pickLogo = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/png,image/jpeg,.png,.jpg,.jpeg'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      if (!/^image\/(png|jpeg)$/i.test(file.type) && !/\.(png|jpe?g)$/i.test(file.name)) {
        notify('error', 'Logo must be PNG or JPEG (no SVG).')
        return
      }
      const canvas = await canvasFromBlob(file, file.name)
      addWatermarkLayer({ kind: 'logo', text: '', source: canvas, corner: 'br', opacity: 0.9, scale: 0.18 })
    }
    input.click()
  }

  return (
    <div className="p-3 space-y-4">
      <div>
        <span className="panel-label">Resize</span>
        <div className="mt-2 flex items-center gap-2">
          <input type="number" value={w} onChange={(e) => onWidthChange(Number(e.target.value))}
            className="w-full bg-input rounded px-2 py-1 text-xs num border border-border" />
          <span className="text-muted-foreground text-xs">×</span>
          <input type="number" value={h} onChange={(e) => onHeightChange(Number(e.target.value))}
            className="w-full bg-input rounded px-2 py-1 text-xs num border border-border" />
        </div>
        <label className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <input type="checkbox" checked={lockRatio} onChange={(e) => setLockRatio(e.target.checked)} />
          Lock aspect ratio
        </label>
        <button
          type="button"
          onClick={() => resize(w, h)}
          className="mt-2 w-full py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground"
        >
          Apply Resize
        </button>
      </div>

      <div className="h-px bg-border" />

      <div>
        <span className="panel-label">Transform</span>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => rotate90(1)} className="flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80"><RotateCw size={13} /> 90° CW</button>
          <button type="button" onClick={() => rotate90(-1)} className="flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80"><RotateCcw size={13} /> 90° CCW</button>
          <button type="button" onClick={() => flip('horizontal')} className="flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80"><FlipHorizontal size={13} /> Flip H</button>
          <button type="button" onClick={() => flip('vertical')} className="flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80"><FlipVertical size={13} /> Flip V</button>
        </div>
      </div>

      {doc.layers.some((l) => l.collageCell) && (
        <div data-testid="collage-frame-picker">
          <span className="panel-label">Frames</span>
          <p className="text-[10px] text-muted-foreground mt-1">
            Click a frame (or its photo on the canvas) to pan, zoom, rotate, or adjust that image.
          </p>
          <div className="mt-2 flex flex-wrap gap-1">
            {doc.layers.filter((l) => l.collageCell).map((cell, index) => (
              <button
                key={cell.id}
                type="button"
                data-testid={`collage-pick-${index}`}
                onClick={() => setActiveLayer(cell.id)}
                className={cn(
                  'px-2 py-1 text-[10px] rounded-md',
                  cell.id === activeLayer?.id ? 'bg-primary text-primary-foreground' : 'bg-secondary hover:bg-secondary/80',
                )}
              >
                {index + 1}
                {cell.collageFilled ? '' : ' · empty'}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeLayer?.collageCell && !activeLayer.collageMat && (
        <div data-testid="collage-frame-position">
          <span className="panel-label">Frame position</span>
          <p className="text-[10px] text-muted-foreground mt-1">
            Drag an empty frame, Alt-drag a filled frame, or nudge left / right / up / down. Arrow keys also move the selected frame.
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[10px] text-muted-foreground">Left</span>
              <input
                type="number"
                data-testid="collage-frame-x"
                className="mt-1 w-full bg-input rounded px-2 py-1 text-xs num border border-border"
                value={activeLayer.x}
                onChange={(e) => setCollageFramePosition(activeLayer.id, Number(e.target.value), activeLayer.y, true)}
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-muted-foreground">Top</span>
              <input
                type="number"
                data-testid="collage-frame-y"
                className="mt-1 w-full bg-input rounded px-2 py-1 text-xs num border border-border"
                value={activeLayer.y}
                onChange={(e) => setCollageFramePosition(activeLayer.id, activeLayer.x, Number(e.target.value), true)}
              />
            </label>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {(
              [
                { id: 'left', label: 'Left', icon: ArrowLeft, dx: -8, dy: 0 },
                { id: 'right', label: 'Right', icon: ArrowRight, dx: 8, dy: 0 },
                { id: 'up', label: 'Up', icon: ArrowUp, dx: 0, dy: -8 },
                { id: 'down', label: 'Down', icon: ArrowDown, dx: 0, dy: 8 },
              ] as const
            ).map((nudge) => (
              <button
                key={nudge.id}
                type="button"
                data-testid={`collage-nudge-${nudge.id}`}
                title={`Move ${nudge.label.toLowerCase()}`}
                onClick={() => offsetLayer(activeLayer.id, nudge.dx, nudge.dy, true)}
                className="flex items-center justify-center gap-1 py-1.5 text-[10px] rounded-md bg-secondary hover:bg-secondary/80"
              >
                <nudge.icon size={12} /> {nudge.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeLayer?.collageCell && activeLayer.collageFilled && (
        <div data-testid="collage-frame-adjust">
          <span className="panel-label">Frame photo</span>
          <p className="text-[10px] text-muted-foreground mt-1">
            Drag inside the highlighted box to pan the photo. Use edge/corner handles or these sliders.
          </p>
          {(() => {
            const fit = clampCollageFit(activeLayer.collageFit)
            return (
              <div className="mt-2 space-y-2">
                <label className="block">
                  <span className="text-[10px] text-muted-foreground">Size {Math.round(fit.scale * 100)}%</span>
                  <input
                    type="range"
                    className="slider mt-1"
                    min={100}
                    max={400}
                    step={1}
                    value={Math.round(fit.scale * 100)}
                    onPointerDown={beginTransaction}
                    onChange={(e) => setCollageFit(activeLayer.id, { scale: Number(e.target.value) / 100 }, false)}
                    onPointerUp={endTransaction}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] text-muted-foreground">Photo X</span>
                  <input
                    type="range"
                    className="slider mt-1"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(fit.panX * 100)}
                    onPointerDown={beginTransaction}
                    onChange={(e) => setCollageFit(activeLayer.id, { panX: Number(e.target.value) / 100 }, false)}
                    onPointerUp={endTransaction}
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] text-muted-foreground">Photo Y</span>
                  <input
                    type="range"
                    className="slider mt-1"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(fit.panY * 100)}
                    onPointerDown={beginTransaction}
                    onChange={(e) => setCollageFit(activeLayer.id, { panY: Number(e.target.value) / 100 }, false)}
                    onPointerUp={endTransaction}
                  />
                </label>
                <button
                  type="button"
                  className="w-full py-1.5 text-[10px] rounded-md bg-secondary hover:bg-secondary/80"
                  onClick={() => setCollageFit(activeLayer.id, DEFAULT_COLLAGE_FIT, true)}
                >
                  Reset photo in frame
                </button>
              </div>
            )
          })()}
        </div>
      )}

      <div>
        <span className="panel-label">Crop</span>
        <p className="text-[10px] text-muted-foreground mt-1">Live crop stays editable. Bake writes pixels.</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {CROP_PRESETS.map((crop) => (
            <button
              key={crop.id}
              type="button"
              onClick={() => startCrop(crop.id)}
              className="py-1.5 text-[10px] rounded-md bg-secondary hover:bg-secondary/80"
            >
              {crop.label}
            </button>
          ))}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5">
          <input type="number" value={customW} min={1} onChange={(e) => setCustomW(Number(e.target.value))} className="w-full bg-input rounded px-2 py-1 text-[10px] border border-border" />
          <span className="text-[10px] text-muted-foreground">:</span>
          <input type="number" value={customH} min={1} onChange={(e) => setCustomH(Number(e.target.value))} className="w-full bg-input rounded px-2 py-1 text-[10px] border border-border" />
          <button
            type="button"
            onClick={() => {
              setTool('crop')
              setCropDraft(cropRectForCustom(doc.width, doc.height, customW, customH))
            }}
            className="px-2 py-1 text-[10px] rounded-md bg-secondary"
          >
            Custom
          </button>
        </div>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          <button type="button" onClick={() => { if (useEditorStore.getState().cropDraft) setLiveCrop(useEditorStore.getState().cropDraft) }} className="flex items-center justify-center gap-1 py-1.5 text-[10px] rounded-md bg-secondary">
            <Crop size={12} /> Apply crop
          </button>
          <button type="button" onClick={() => bakeCrop()} disabled={!doc.crop} className="py-1.5 text-[10px] rounded-md bg-secondary disabled:opacity-40">
            Bake crop
          </button>
        </div>
      </div>

      <div className="h-px bg-border" />

      <div>
        <span className="panel-label">Logo / watermark</span>
        <button type="button" onClick={() => void pickLogo()} className="mt-2 w-full flex items-center justify-center gap-1.5 py-1.5 text-xs rounded-md bg-secondary">
          <ImagePlus size={13} /> Add PNG/JPEG logo
        </button>
        <button
          type="button"
          onClick={() => addWatermarkLayer({ kind: 'text', text: '@studio', corner: 'br' })}
          className="mt-1.5 w-full py-1.5 text-xs rounded-md bg-secondary"
        >
          Add text handle
        </button>
        {watermark?.watermark && (
          <div className="mt-2 grid grid-cols-5 gap-1">
            {CORNERS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => updateWatermark(watermark.id, { corner: c.id }, undefined, true)}
                className={`py-1 text-[10px] rounded ${watermark.watermark?.corner === c.id ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}
              >
                {c.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
