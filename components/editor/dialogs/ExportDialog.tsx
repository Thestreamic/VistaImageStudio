'use client'
import { useMemo, useState } from 'react'
import { X, Download, Layers, Film, Check } from 'lucide-react'
import { EXPORT_PRESETS } from '@/features/editor/export-presets'
import {
  CREATOR_PACK_IDS,
  DEFAULT_EXPORT_TEMPLATE,
  estimateExportBytes,
  formatBytes,
  formatExportName,
  renderExportCanvas,
  sliceCarousel,
  stampWatermark,
  type WatermarkCorner,
} from '@/features/editor/export-kit'
import { useEditorStore, selectWatermarkLayer } from '@/features/editor/store/editor-store'
import { compositor } from '@/features/editor/engine/compositor'
import { canvasToBlob } from '@/lib/image/canvas'
import { getBridge } from '@/lib/platform/bridge'
import { cn } from '@/lib/utils'

type ExportFormat = 'png' | 'jpeg' | 'webp'

const WATERMARK_KEY = 'vista-watermark'
const HANDLE_KEY = 'vista-handle'

function loadHandle() {
  if (typeof window === 'undefined') return '@studio'
  try {
    return localStorage.getItem(HANDLE_KEY) || '@studio'
  } catch {
    return '@studio'
  }
}

function loadWatermarkOn() {
  if (typeof window === 'undefined') return false
  try {
    return localStorage.getItem(WATERMARK_KEY) === '1'
  } catch {
    return false
  }
}

export function ExportDialog({ onClose, onMakeVideo }: { onClose: () => void; onMakeVideo?: () => void }) {
  const doc = useEditorStore((s) => s.doc)
  const notify = useEditorStore((s) => s.notify)
  const setLastExport = useEditorStore((s) => s.setLastExport)
  const hasLogoLayer = !!useEditorStore(selectWatermarkLayer)
  const last = doc?.lastExport
  const [selected, setSelected] = useState<string[]>(last?.presetIds?.length ? last.presetIds : ['ig-post'])
  const [fitMode, setFitMode] = useState<'fill' | 'fit'>(last?.fitMode ?? 'fill')
  const [format, setFormat] = useState<ExportFormat>(last?.format ?? 'jpeg')
  const [quality, setQuality] = useState(last?.quality ?? 90)
  const [template, setTemplate] = useState(last?.fileNameTemplate ?? DEFAULT_EXPORT_TEMPLATE)
  const [watermarkOn, setWatermarkOn] = useState(loadWatermarkOn)
  const [handle, setHandle] = useState(loadHandle)
  const [corner, setCorner] = useState<WatermarkCorner>('br')
  const [opacity, setOpacity] = useState(0.85)
  const [carousel, setCarousel] = useState(false)
  const [exporting, setExporting] = useState(false)

  const presets = useMemo(
    () => EXPORT_PRESETS.filter((p) => selected.includes(p.id)),
    [selected],
  )

  if (!doc) return null

  const toggle = (id: string) => {
    setSelected((cur) => {
      if (cur.includes(id)) return cur.length === 1 ? cur : cur.filter((x) => x !== id)
      return [...cur, id]
    })
  }

  const ext = format === 'jpeg' ? 'jpg' : format

  const handleExport = async () => {
    setExporting(true)
    try {
      localStorage.setItem(HANDLE_KEY, handle)
      localStorage.setItem(WATERMARK_KEY, watermarkOn ? '1' : '0')
      const rendered = compositor.renderOutput(doc)
      const files: { blob: Blob; name: string }[] = []
      const base = doc.fileName.replace(/\.[^.]+$/, '') || 'export'
      const mime = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg'
      const q = format === 'png' ? undefined : quality / 100
      const stamp = (canvas: HTMLCanvasElement) =>
        watermarkOn && !hasLogoLayer ? stampWatermark(canvas, { text: handle, corner, opacity }) : canvas

      for (const preset of presets) {
        const canvas = stamp(renderExportCanvas(rendered, preset, fitMode))
        const blob = await canvasToBlob(canvas, mime, q)
        files.push({ blob, name: `${formatExportName(template, { name: base, preset: preset.id })}.${ext}` })
      }

      if (carousel) {
        const tiles = sliceCarousel(rendered)
        if (tiles.length > 1) {
          for (let i = 0; i < tiles.length; i++) {
            const canvas = stamp(tiles[i])
            const blob = await canvasToBlob(canvas, mime, q)
            files.push({ blob, name: `${formatExportName(template, { name: base, preset: `slide-${String(i + 1).padStart(2, '0')}` })}.${ext}` })
          }
        }
      }

      const ok = files.length === 1
        ? await getBridge().saveImage(files[0].blob, files[0].name)
        : await getBridge().saveImages(files)
      if (ok) {
        setLastExport({ presetIds: selected, format, quality, fileNameTemplate: template, fitMode })
        notify('success', files.length === 1 ? `Exported ${files[0].name}` : `Exported ${files.length} files`)
        onClose()
      }
    } catch (err) {
      notify('error', `Export failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-labelledby="export-title"
        className="w-[480px] max-w-full max-h-[88vh] flex flex-col rounded-xl bg-popover border border-border elev-pop overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="shrink-0 flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-border">
          <div>
            <h2 id="export-title" className="text-[15px] font-semibold tracking-[-0.01em]">Export for social</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">Pick the sizes you need, then export them in one go.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export"
            title="Close"
            className="-mr-1.5 w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-thin px-5 py-4 space-y-5">
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <h3 className="section-title flex-1">Sizes</h3>
              <span className="text-[11px] text-muted-foreground num">{selected.length} selected</span>
              <button
                type="button"
                onClick={() => setSelected([...CREATOR_PACK_IDS])}
                title="Select the most-used social sizes"
                className="flex items-center gap-1 h-7 px-2.5 rounded-md border border-border bg-card text-[11.5px] font-medium hover:border-primary/50 hover:text-primary transition-colors"
              >
                <Layers size={12} /> Creator pack
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {EXPORT_PRESETS.map((p) => {
                const on = selected.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(p.id)}
                    className={cn(
                      'relative flex flex-col items-start gap-0.5 pl-3 pr-7 py-2 rounded-lg text-left border transition-[background-color,border-color,box-shadow]',
                      on
                        ? 'bg-primary/10 border-primary/70 ring-1 ring-primary/40'
                        : 'bg-card border-border hover:border-foreground/25',
                    )}
                  >
                    <span className="text-[12.5px] font-medium leading-tight">{p.label}</span>
                    <span className="text-[11px] text-muted-foreground num leading-tight">
                      {p.width ? `${p.width} × ${p.height}` : `${doc.width} × ${doc.height}`} · {p.hint}
                    </span>
                    <span
                      aria-hidden
                      className={cn(
                        'absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center transition-colors',
                        on ? 'bg-primary text-primary-foreground' : 'border border-border',
                      )}
                    >
                      {on && <Check size={11} strokeWidth={3} />}
                    </span>
                  </button>
                )
              })}
            </div>
            {selected.includes('yt-thumb') && (
              <p data-testid="yt-squeeze-note" className="mt-2 text-[11.5px] text-muted-foreground">
                YouTube Thumbnail squeezes the whole photo into 16:9 — it does not crop the top and bottom.
              </p>
            )}
          </section>

          <section className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="section-title mb-2">Fit</h3>
              <Segmented
                value={fitMode}
                onChange={setFitMode}
                options={[
                  { id: 'fill', label: 'Fill & Crop' },
                  { id: 'fit', label: 'Fit & Pad' },
                ]}
              />
            </div>
            <div>
              <h3 className="section-title mb-2">Format</h3>
              <Segmented
                value={format}
                onChange={setFormat}
                options={[
                  { id: 'png', label: 'PNG' },
                  { id: 'jpeg', label: 'JPEG' },
                  { id: 'webp', label: 'WEBP' },
                ]}
              />
            </div>
          </section>
          {format !== 'png' && (
            <div className="flex items-center gap-3 -mt-2">
              <span className="text-[12px] text-foreground/80 w-14">Quality</span>
              <input
                type="range"
                min={50}
                max={100}
                value={quality}
                aria-label="Quality"
                onChange={(e) => setQuality(Number(e.target.value))}
                className="slider flex-1"
                style={{ '--a': '0%', '--b': `${((quality - 50) / 50) * 100}%` } as React.CSSProperties}
              />
              <span className="num w-9 text-right">{quality}%</span>
            </div>
          )}

          <section className="space-y-2.5">
            <h3 className="section-title">Options</h3>
            <label className="flex items-center gap-2.5 text-[12.5px] cursor-pointer">
              <input
                type="checkbox"
                checked={watermarkOn}
                onChange={(e) => setWatermarkOn(e.target.checked)}
                className="w-4 h-4 accent-[var(--primary)]"
              />
              Watermark handle on every export
            </label>
            {watermarkOn && (
              <div className="ml-6.5 space-y-2 rounded-lg border border-border bg-card p-2.5">
                <input
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@yourhandle"
                  className="w-full h-8 bg-input rounded-md px-2.5 text-[12.5px] border border-border focus:border-ring/60 outline-none"
                />
                <div className="flex gap-1.5">
                  {(['tl', 'tr', 'bl', 'br'] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={corner === id}
                      onClick={() => setCorner(id)}
                      className={cn(
                        'flex-1 h-7 text-[11px] font-medium rounded-md uppercase border transition-colors',
                        corner === id ? 'bg-primary/10 border-primary/60 text-foreground' : 'bg-secondary border-transparent hover:bg-accent',
                      )}
                    >
                      {id}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[12px] text-foreground/80 w-14">Opacity</span>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={Math.round(opacity * 100)}
                    aria-label="Watermark opacity"
                    onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                    className="slider flex-1"
                    style={{ '--a': '0%', '--b': `${((Math.round(opacity * 100) - 20) / 80) * 100}%` } as React.CSSProperties}
                  />
                  <span className="num w-9 text-right">{Math.round(opacity * 100)}%</span>
                </div>
              </div>
            )}
            <label className="flex items-center gap-2.5 text-[12.5px] cursor-pointer">
              <input
                type="checkbox"
                checked={carousel}
                onChange={(e) => setCarousel(e.target.checked)}
                className="w-4 h-4 accent-[var(--primary)]"
              />
              Also split a wide photo into Instagram carousel tiles
            </label>
          </section>

          <section className="space-y-1.5">
            <h3 className="section-title">File name</h3>
            <input
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              aria-label="File name"
              className="w-full h-8 bg-input rounded-md px-2.5 text-[12.5px] num border border-border focus:border-ring/60 outline-none"
              title="{name} {preset} {date}"
            />
            <p className="text-[11.5px] text-muted-foreground leading-snug">
              Tokens: {'{name}'}, {'{preset}'}, {'{date}'}. Export is a canvas re-encode, so camera EXIF is not copied.
              {hasLogoLayer ? ' Logo layer is already in the image.' : ''}
            </p>
          </section>
        </div>

        {/* Footer: the main action is always on screen */}
        <div className="shrink-0 flex items-center gap-2 px-5 py-3 border-t border-border bg-popover">
          <p className="flex-1 min-w-0 text-[11.5px] text-muted-foreground truncate" data-testid="export-size-estimate">
            Estimate:{' '}
            {formatBytes(
              presets.reduce((sum, p) => {
                const w = p.width ?? doc.width
                const h = p.height ?? doc.height
                return sum + estimateExportBytes(w, h, format, quality)
              }, 0),
            )}
          </p>
          <button
            type="button"
            data-testid="make-video"
            onClick={() => {
              onMakeVideo?.()
              onClose()
            }}
            className="flex items-center gap-1.5 h-9 px-3 rounded-md border border-border bg-card text-[12.5px] font-medium hover:bg-accent transition-colors"
          >
            <Film size={14} /> Make video…
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || presets.length === 0}
            className="flex items-center gap-1.5 h-9 px-4 rounded-md bg-foreground text-background text-[13px] font-semibold shadow-sm transition-[background-color,transform] hover:bg-foreground/88 active:translate-y-px disabled:opacity-45 disabled:pointer-events-none"
          >
            {presets.length > 1 || carousel ? <Layers size={14} /> : <Download size={14} />}
            {exporting ? 'Exporting…' : presets.length > 1 ? `Export ${presets.length} sizes` : 'Export'}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Windows-style segmented control: one quiet track, the active option lifted. */
function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (v: T) => void
  options: { id: T; label: string }[]
}) {
  return (
    <div className="flex gap-0.5 p-0.5 rounded-lg bg-secondary border border-border">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={value === o.id}
          onClick={() => onChange(o.id)}
          className={cn(
            'flex-1 h-7 rounded-md text-[12px] font-medium transition-[background-color,color,box-shadow]',
            value === o.id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
