'use client'
import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useEditorStore, selectPhotoLayer } from '@/features/editor/store/editor-store'
import { FILTER_PRESETS } from '@/features/editor/filter-presets'
import { PRO_PHONE_LOOK_ID } from '@/features/editor/camera-profiles'
import { Slider } from './Slider'
import { cn } from '@/lib/utils'

const THUMB_SIZE = 160

export function FiltersPanel() {
  const layer = useEditorStore(selectPhotoLayer)
  const doc = useEditorStore((s) => s.doc)
  const applyLook = useEditorStore((s) => s.applyLook)
  const notify = useEditorStore((s) => s.notify)
  const [thumb, setThumb] = useState<string | null>(null)

  const optimizeImage = () => {
    applyLook(PRO_PHONE_LOOK_ID, 100, true) && notify('success', 'Optimize Image applied')
  }

  useEffect(() => {
    if (!layer) { setThumb(null); return }
    const c = document.createElement('canvas')
    const scale = Math.min(1, THUMB_SIZE / Math.max(layer.source.width, layer.source.height))
    c.width = Math.max(1, Math.round(layer.source.width * scale))
    c.height = Math.max(1, Math.round(layer.source.height * scale))
    const ctx = c.getContext('2d')!
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(layer.source, 0, 0, c.width, c.height)
    setThumb(c.toDataURL())
  }, [layer?.id, layer?.source])

  if (!layer) {
    return (
      <div className="p-3">
        <span className="panel-label">Looks</span>
        <p className="p-0 mt-2 text-xs text-muted-foreground">Open an image to apply a look.</p>
        <p className="text-[10px] text-muted-foreground mt-2">Includes Optimize Image, Original, B&W, Warm, Cool.</p>
      </div>
    )
  }

  const intensity = doc?.lookIntensity ?? 100
  const active = doc?.lookId ?? 'original'

  return (
    <div className="p-3">
      <button
        type="button"
        onClick={optimizeImage}
        data-testid="auto-optimize"
        className="w-full flex items-center justify-center gap-2 py-2.5 mb-3 rounded-md brand-gradient-bg text-white text-xs font-semibold"
        title="One-click grade: tone, color, vibrance, clarity, sharpness"
      >
        <Sparkles size={14} /> Optimize Image
      </button>
      <span className="panel-label">Looks</span>
      <p className="text-[10px] text-muted-foreground mt-1 mb-3">
        Intensity blends toward the original.
      </p>
      <LookGrid
        items={FILTER_PRESETS.map((p) => ({ id: p.id, label: p.label, css: p.cssPreview }))}
        active={active}
        thumb={thumb}
        onPick={(id) => applyLook(id === 'original' ? null : id, intensity, true)}
      />
      {active && active !== 'original' && (
        <div className="mt-3">
          <Slider
            label="Intensity"
            value={intensity}
            min={0}
            max={100}
            onChange={(v) => applyLook(active, v, false)}
            onCommit={() => applyLook(active, intensity, true)}
          />
        </div>
      )}
    </div>
  )
}

function LookGrid({
  items,
  active,
  thumb,
  onPick,
}: {
  items: { id: string; label: string; css: string }[]
  active: string | null
  thumb: string | null
  onPick: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-2 mt-2">
      {items.map((p) => (
        <button key={p.id} type="button" onClick={() => onPick(p.id)} className="flex flex-col items-center gap-1.5 group">
          <div className={cn('w-full aspect-square rounded-lg overflow-hidden bg-secondary border-2 transition-colors', active === p.id ? 'border-primary' : 'border-transparent group-hover:border-border')}>
            {thumb && (
              <img src={thumb} alt="" className="w-full h-full object-contain" style={{ filter: p.css === 'none' ? undefined : p.css }} />
            )}
          </div>
          <span className="text-[10px] text-muted-foreground group-hover:text-foreground">{p.label}</span>
        </button>
      ))}
    </div>
  )
}
