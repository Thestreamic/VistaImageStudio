'use client'
import { Eye, EyeOff, Lock, Unlock, Trash2, Copy, ChevronUp, ChevronDown, ImagePlus } from 'lucide-react'
import { useEditorStore } from '@/features/editor/store/editor-store'
import { cn } from '@/lib/utils'
import type { BlendMode } from '@/features/editor/types'

const BLEND_MODES: BlendMode[] = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'soft-light', 'difference', 'luminosity']

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

  if (!doc) return null
  // Render top-to-bottom (reverse of composite order)
  const layers = [...doc.layers].reverse()

  return (
    <div className="flex flex-col">
      <div className="px-3 py-2 flex items-center justify-between">
        <span className="panel-label">Layers</span>
        <span className="text-[10px] text-muted-foreground">{doc.layers.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {layers.map((layer) => {
          const active = layer.id === doc.activeLayerId
          return (
            <div
              key={layer.id}
              onClick={() => setActiveLayer(layer.id)}
              className={cn(
                'group px-2 py-1.5 mx-1 my-0.5 rounded-md cursor-pointer border',
                active ? 'bg-accent border-primary/40' : 'border-transparent hover:bg-accent/50',
              )}
            >
              <div className="flex items-center gap-2">
                <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id) }} className="text-muted-foreground hover:text-foreground shrink-0">
                  {layer.visible ? <Eye size={13} /> : <EyeOff size={13} className="opacity-40" />}
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
                <span className="text-xs truncate flex-1">{layer.name}</span>
                <button onClick={(e) => { e.stopPropagation(); toggleLayerLock(layer.id) }} className="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 shrink-0">
                  {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                </button>
              </div>

              {active && (
                <div className="mt-2 space-y-2 pl-6" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-2">
                    <select
                      value={layer.blendMode}
                      onChange={(e) => setLayerBlendMode(layer.id, e.target.value as BlendMode)}
                      className="flex-1 text-[10px] bg-input rounded px-1 py-0.5 border border-border"
                    >
                      {BLEND_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                    <span className="num w-8 text-right">{Math.round(layer.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range" className="slider" min={0} max={1} step={0.01}
                    value={layer.opacity}
                    onChange={(e) => setLayerOpacity(layer.id, Number(e.target.value), false)}
                    onMouseUp={() => setLayerOpacity(layer.id, layer.opacity, true)}
                  />
                  <div className="flex gap-1">
                    {layer.collageCell && (
                      <button
                        title={layer.collageFilled ? 'Replace photo' : 'Add photo'}
                        onClick={async (e) => {
                          e.stopPropagation()
                          const { getBridge } = await import('@/lib/platform/bridge')
                          const { canvasFromBlob } = await import('@/lib/image/canvas')
                          const file = await getBridge().openImage()
                          if (!file) return
                          const photo = await canvasFromBlob(file.blob, file.name)
                          fillCollageCell(layer.id, photo)
                        }}
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                      >
                        <ImagePlus size={12} />
                      </button>
                    )}
                    <button title="Duplicate" onClick={() => duplicateLayer(layer.id)} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><Copy size={12} /></button>
                    <button title="Move up" onClick={() => moveLayer(layer.id, 'up')} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><ChevronUp size={12} /></button>
                    <button title="Move down" onClick={() => moveLayer(layer.id, 'down')} className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"><ChevronDown size={12} /></button>
                    <button title="Delete" onClick={() => removeLayer(layer.id)} className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive ml-auto"><Trash2 size={12} /></button>
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
