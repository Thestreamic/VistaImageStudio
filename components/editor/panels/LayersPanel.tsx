'use client'
import { Eye, EyeOff, Lock, Unlock, Trash2, Copy, ChevronUp, ChevronDown, ImagePlus } from 'lucide-react'
import { useEditorStore } from '@/features/editor/store/editor-store'
import { cn } from '@/lib/utils'
import type { BlendMode } from '@/features/editor/types'

const BLEND_MODES: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'soft-light', 'difference', 'luminosity']

/** 24px hit area for every layer action. */
const ICON_BTN =
  'w-6 h-6 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-[color,background-color,opacity]'

function blendLabel(mode: BlendMode): string {
  const words = mode.replace('-', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function LayersPanel() {
  const doc = useEditorStore((s) => s.doc)
  const setActiveLayer = useEditorStore((s) => s.setActiveLayer)
  const toggleLayerVisibility = useEditorStore((s) => s.toggleLayerVisibility)
  const toggleLayerLock = useEditorStore((s) => s.toggleLayerLock)
  const removeLayer = useEditorStore((s) => s.removeLayer)
  const duplicateLayer = useEditorStore((s) => s.duplicateLayer)
  const fillCollageCell = useEditorStore((s) => s.fillCollageCell)
  const moveLayer = useEditorStore((s) => s.moveLayer)
  const setLayerOpacity = useEditorStore((s) => s.setLayerOpacity)
  const setLayerBlendMode = useEditorStore((s) => s.setLayerBlendMode)

  if (!doc) {
    return (
      <div className="p-3">
        <p className="text-[12px] text-muted-foreground">Layers appear here once a photo is open.</p>
      </div>
    )
  }
  // Render top-to-bottom (reverse of composite order)
  const layers = [...doc.layers].reverse()

  return (
    <div className="flex flex-col">
      <div className="px-3 pt-3 pb-1.5 flex items-center justify-between">
        <span className="panel-label">Layers</span>
        <span className="num text-muted-foreground">{doc.layers.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin pb-2">
        {layers.map((layer) => {
          const active = layer.id === doc.activeLayerId
          return (
            <div
              key={layer.id}
              onClick={() => setActiveLayer(layer.id)}
              className={cn(
                'group px-1.5 py-1 mx-1.5 my-0.5 rounded-md cursor-pointer border transition-colors',
                active ? 'bg-accent border-primary/40' : 'border-transparent hover:bg-accent/50',
              )}
            >
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  aria-label={layer.visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
                  title={layer.visible ? 'Hide layer' : 'Show layer'}
                  onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id) }}
                  className={ICON_BTN}
                >
                  {layer.visible ? <Eye size={14} /> : <EyeOff size={14} className="opacity-50" />}
                </button>
                <div className="w-7 h-7 rounded overflow-hidden bg-black/30 shrink-0 border border-border">
                  <canvas
                    ref={(el) => {
                      if (!el) return
                      el.width = 28; el.height = 28
                      const ctx = el.getContext('2d')!
                      const s = Math.min(28 / layer.source.width, 28 / layer.source.height)
                      ctx.drawImage(layer.source, 0, 0, layer.source.width * s, layer.source.height * s)
                    }}
                  />
                </div>
                <span className={cn('text-[12px] truncate flex-1', active ? 'text-foreground font-medium' : 'text-foreground/85')}>
                  {layer.name}
                </span>
                <button
                  type="button"
                  aria-label={layer.locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
                  aria-pressed={layer.locked}
                  title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                  onClick={(e) => { e.stopPropagation(); toggleLayerLock(layer.id) }}
                  className={cn(
                    ICON_BTN,
                    layer.locked
                      ? 'text-foreground'
                      : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100',
                  )}
                >
                  {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
                </button>
              </div>

              {active && (
                <div className="mt-2 space-y-2 pl-7" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <select
                      value={layer.blendMode}
                      aria-label="Blend mode"
                      title="Blend mode"
                      onChange={(e) => setLayerBlendMode(layer.id, e.target.value as BlendMode)}
                      className="flex-1 h-7 text-[11px] bg-input rounded-md px-1.5 border border-border"
                    >
                      {BLEND_MODES.map((m) => <option key={m} value={m}>{blendLabel(m)}</option>)}
                    </select>
                    <span className="num w-9 text-right">{Math.round(layer.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range" className="slider" min={0} max={1} step={0.01}
                    aria-label="Layer opacity"
                    style={{ '--a': '0%', '--b': `${layer.opacity * 100}%` } as React.CSSProperties}
                    value={layer.opacity}
                    onChange={(e) => setLayerOpacity(layer.id, Number(e.target.value), false)}
                    onMouseUp={() => setLayerOpacity(layer.id, layer.opacity, true)}
                  />
                  <div className="flex gap-0.5">
                    {layer.collageCell && (
                      <button
                        type="button"
                        title={layer.collageFilled ? 'Replace photo' : 'Add photo'}
                        aria-label={layer.collageFilled ? 'Replace photo' : 'Add photo'}
                        onClick={async (e) => {
                          e.stopPropagation()
                          const { getBridge } = await import('@/lib/platform/bridge')
                          const { canvasFromBlob } = await import('@/lib/image/canvas')
                          const file = await getBridge().openImage()
                          if (!file) return
                          const photo = await canvasFromBlob(file.blob, file.name)
                          fillCollageCell(layer.id, photo)
                        }}
                        className={ICON_BTN}
                      >
                        <ImagePlus size={14} />
                      </button>
                    )}
                    <button type="button" title="Duplicate layer" aria-label="Duplicate layer" onClick={() => duplicateLayer(layer.id)} className={ICON_BTN}><Copy size={14} /></button>
                    <button type="button" title="Move layer up" aria-label="Move layer up" onClick={() => moveLayer(layer.id, 'up')} className={ICON_BTN}><ChevronUp size={14} /></button>
                    <button type="button" title="Move layer down" aria-label="Move layer down" onClick={() => moveLayer(layer.id, 'down')} className={ICON_BTN}><ChevronDown size={14} /></button>
                    <button type="button" title="Delete layer" aria-label="Delete layer" onClick={() => removeLayer(layer.id)} className={cn(ICON_BTN, 'ml-auto hover:bg-destructive/15 hover:text-destructive')}><Trash2 size={14} /></button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
