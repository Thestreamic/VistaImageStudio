'use client'
import type { ReactNode } from 'react'
import { useEditorStore, selectPhotoLayer } from '@/features/editor/store/editor-store'
import { Slider } from './Slider'
import { CurvesEditor } from './CurvesEditor'
import { RotateCcw } from 'lucide-react'

export function AdjustmentsPanel() {
  // Same target as Filters and the AI ops: the sliders must show the values a
  // filter just wrote, even when a text layer happens to be selected.
  const layer = useEditorStore(selectPhotoLayer)
  const updateAdjustments = useEditorStore((s) => s.updateAdjustments)
  const resetAdjustments = useEditorStore((s) => s.resetAdjustments)

  if (!layer) {
    return (
      <div className="p-3 space-y-1">
        <p className="text-[13px] text-muted-foreground">No layer selected.</p>
        <p className="text-[12px] text-muted-foreground/80">Open a photo to adjust light, colour and detail.</p>
      </div>
    )
  }

  const a = layer.adjustments
  const patch = (p: Partial<typeof a>) => updateAdjustments(layer.id, p, false)
  const commit = () => updateAdjustments(layer.id, {}, true)

  return (
    <div className="p-3 space-y-5">
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-muted-foreground">Fine-tune this photo</span>
        <button
          type="button"
          title="Reset all adjustments (Ctrl+Z undoes)"
          aria-label="Reset all adjustments"
          onClick={() => resetAdjustments(layer.id)}
          className="flex items-center gap-1 h-6 px-1.5 rounded-md text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <RotateCcw size={12} /> Reset
        </button>
      </div>

      <Group title="Light">
        <Slider label="Exposure" value={a.exposure} min={-2} max={2} step={0.01}
          onChange={(exposure) => patch({ exposure })} onCommit={commit}
          formatValue={(v) => v.toFixed(2)} />
        <Slider label="Brightness" value={a.brightness} min={-100} max={100}
          onChange={(brightness) => patch({ brightness })} onCommit={commit} />
        <Slider label="Contrast" value={a.contrast} min={-100} max={100}
          onChange={(contrast) => patch({ contrast })} onCommit={commit} />
        <Slider label="Highlights" value={a.highlights} min={-100} max={100}
          onChange={(highlights) => patch({ highlights })} onCommit={commit} />
        <Slider label="Shadows" value={a.shadows} min={-100} max={100}
          onChange={(shadows) => patch({ shadows })} onCommit={commit} />
        <Slider label="Whites" value={a.whites} min={-100} max={100}
          onChange={(whites) => patch({ whites })} onCommit={commit} />
        <Slider label="Blacks" value={a.blacks} min={-100} max={100}
          onChange={(blacks) => patch({ blacks })} onCommit={commit} />
      </Group>

      <Group title="Colour">
        <Slider label="Temperature" value={a.temperature} min={-100} max={100}
          onChange={(temperature) => patch({ temperature })} onCommit={commit} />
        <Slider label="Tint" value={a.tint} min={-100} max={100}
          onChange={(tint) => patch({ tint })} onCommit={commit} />
        <Slider label="Saturation" value={a.saturation} min={-100} max={100}
          onChange={(saturation) => patch({ saturation })} onCommit={commit} />
        <Slider label="Vibrance" value={a.vibrance} min={-100} max={100}
          onChange={(vibrance) => patch({ vibrance })} onCommit={commit} />
      </Group>

      <Group title="Detail">
        <Slider label="Sharpness" value={a.sharpness} min={-100} max={100}
          onChange={(sharpness) => patch({ sharpness })} onCommit={commit} />
      </Group>

      <Group title="Curves">
        <CurvesEditor
          curves={a.curves}
          onChange={(curves) => patch({ curves })}
          onCommit={commit}
        />
      </Group>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="section-title">{title}</h3>
      {children}
    </section>
  )
}
