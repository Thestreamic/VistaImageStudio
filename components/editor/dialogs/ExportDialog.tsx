'use client'
import { useMemo, useState } from 'react'
import { X, Download, Layers, Film } from 'lucide-react'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[420px] max-h-[85vh] overflow-y-auto rounded-xl bg-popover border border-border shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Export for social</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        <div className="flex items-center justify-between mb-2">
          <span className="panel-label">Sizes — select every platform you need</span>
          <button
            type="button"
            onClick={() => setSelected([...CREATOR_PACK_IDS])}
            className="text-[10px] px-2 py-1 rounded-md bg-secondary hover:bg-secondary/80"
          >
            Creator pack
          </button>
        </div>
        <div className="mt-1 grid grid-cols-2 gap-1.5 mb-4">
          {EXPORT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              className={cn(
                'flex flex-col items-start gap-0.5 px-3 py-2 rounded-md text-left transition-colors',
                selected.includes(p.id) ? 'bg-accent border border-primary/50' : 'bg-secondary hover:bg-secondary/80 border border-transparent',
              )}
            >
              <span className="text-xs font-medium">{p.label}</span>
              <span className="text-[10px] text-muted-foreground num">
                {p.width ? `${p.width} × ${p.height}` : `${doc.width} × ${doc.height}`} · {p.hint}
              </span>
            </button>
          ))}
        </div>

        <span className="panel-label">Fit</span>
        <div className="mt-2 flex gap-1.5 mb-4">
          <button
            type="button"
            onClick={() => setFitMode('fill')}
            className={cn('flex-1 py-1.5 text-xs rounded-md', fitMode === 'fill' ? 'bg-accent text-accent-foreground' : 'bg-secondary hover:bg-secondary/80')}
          >
            Fill &amp; Crop
          </button>
          <button
            type="button"
            onClick={() => setFitMode('fit')}
            className={cn('flex-1 py-1.5 text-xs rounded-md', fitMode === 'fit' ? 'bg-accent text-accent-foreground' : 'bg-secondary hover:bg-secondary/80')}
          >
            Fit &amp; Pad
          </button>
        </div>
        {selected.includes('yt-thumb') && (
          <p data-testid="yt-squeeze-note" className="text-[10px] text-muted-foreground -mt-3 mb-4">
            YouTube Thumbnail squeezes the whole photo into 16:9 — it does not crop the top and bottom.
          </p>
        )}

        <span className="panel-label">Format</span>
        <div className="mt-2 flex gap-1.5 mb-1">
          {(['png', 'jpeg', 'webp'] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setFormat(id)}
              className={cn('flex-1 py-1.5 text-xs rounded-md uppercase', format === id ? 'bg-accent text-accent-foreground' : 'bg-secondary hover:bg-secondary/80')}
            >
              {id === 'jpeg' ? 'JPEG' : id.toUpperCase()}
            </button>
          ))}
        </div>
        {format !== 'png' && (
          <div className="flex items-center justify-between mb-4 mt-2">
            <span className="text-[10px] text-muted-foreground">Quality</span>
            <input type="range" min={50} max={100} value={quality} onChange={(e) => setQuality(Number(e.target.value))} className="slider flex-1 mx-3" />
            <span className="num text-[10px] w-8 text-right">{quality}%</span>
          </div>
        )}

        <label className="flex items-center gap-2 text-xs mb-2">
          <input
            type="checkbox"
            checked={watermarkOn}
            onChange={(e) => setWatermarkOn(e.target.checked)}
          />
          Watermark handle on every export
        </label>
        {watermarkOn && (
          <div className="mb-4 space-y-2">
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="@yourhandle"
              className="w-full bg-input rounded px-2 py-1.5 text-xs border border-border"
            />
            <div className="flex gap-1.5">
              {(['tl', 'tr', 'bl', 'br'] as const).map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCorner(id)}
                  className={cn('flex-1 py-1 text-[10px] rounded-md uppercase', corner === id ? 'bg-accent' : 'bg-secondary hover:bg-secondary/80')}
                >
                  {id}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">Opacity</span>
              <input type="range" min={20} max={100} value={Math.round(opacity * 100)} onChange={(e) => setOpacity(Number(e.target.value) / 100)} className="slider flex-1 mx-3" />
              <span className="num text-[10px] w-8 text-right">{Math.round(opacity * 100)}%</span>
            </div>
          </div>
        )}

        <label className="flex items-center gap-2 text-xs mb-4">
          <input type="checkbox" checked={carousel} onChange={(e) => setCarousel(e.target.checked)} />
          Also split a wide photo into Instagram carousel tiles
        </label>

        <label className="flex items-center gap-2 text-xs mb-2">
          File name
          <input
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            className="flex-1 bg-input rounded px-2 py-1 text-[10px] border border-border"
            title="{name} {preset} {date}"
          />
        </label>
        <p className="text-[10px] text-muted-foreground mb-2">
          Tokens: {'{name}'}, {'{preset}'}, {'{date}'}. Export is a canvas re-encode, so camera EXIF is not copied.
          {hasLogoLayer ? ' Logo layer is already in the image.' : ''}
        </p>
        <p className="text-[10px] text-muted-foreground mb-3" data-testid="export-size-estimate">
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
          className="w-full mb-2 flex items-center justify-center gap-2 py-2 rounded-md bg-secondary hover:bg-secondary/80 text-xs"
        >
          <Film size={14} /> Make video…
        </button>
        <button
          onClick={handleExport}
          disabled={exporting || presets.length === 0}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md brand-gradient-bg text-white text-sm font-medium disabled:opacity-60"
        >
          {presets.length > 1 || carousel ? <Layers size={14} /> : <Download size={14} />}
          {exporting ? 'Exporting…' : presets.length > 1 ? `Export ${presets.length} sizes` : 'Export'}
        </button>
      </div>
    </div>
  )
}
