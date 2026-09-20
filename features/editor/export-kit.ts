import { cloneCanvas, createCanvas, ctx2d, fitCanvasToSize, type ExportFitMode } from '@/lib/image/canvas'
import type { ExportPreset } from './export-presets'
import { EXPORT_PRESETS } from './export-presets'
import type { WatermarkCorner } from './types'

export type { WatermarkCorner }
export { cropRectForRatio, storySafeZones } from './crop-presets'

export interface WatermarkSpec {
  text: string
  corner: WatermarkCorner
  opacity: number
}

/** Instagram + Stories + YouTube + Pinterest — the set creators sell posts into. */
export const CREATOR_PACK_IDS = ['ig-post', 'ig-portrait', 'ig-story', 'yt-thumb', 'pinterest'] as const

export function presetsByIds(ids: readonly string[]): ExportPreset[] {
  const wanted = new Set(ids)
  return EXPORT_PRESETS.filter((preset) => wanted.has(preset.id))
}

export function stampWatermark(src: HTMLCanvasElement, spec: WatermarkSpec): HTMLCanvasElement {
  const text = spec.text.trim()
  if (!text) return src
  const out = cloneCanvas(src)
  const ctx = ctx2d(out)
  const fontSize = Math.max(14, Math.round(Math.min(out.width, out.height) * 0.035))
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`
  const pad = Math.round(fontSize * 0.85)
  const metrics = ctx.measureText(text)
  const textW = metrics.width
  const center = spec.corner === 'center'
  const top = spec.corner === 'tl' || spec.corner === 'tr'
  const right = spec.corner === 'tr' || spec.corner === 'br'
  const x = center ? (out.width - textW) / 2 : right ? out.width - pad - textW : pad
  const y = center ? out.height / 2 + fontSize / 3 : top ? pad + fontSize : out.height - pad
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = `rgba(0,0,0,${0.45 * spec.opacity})`
  ctx.fillText(text, x + 1.5, y + 1.5)
  ctx.fillStyle = `rgba(255,255,255,${Math.min(1, spec.opacity)})`
  ctx.fillText(text, x, y)
  return out
}

/** Slice a landscape (or very wide) frame into 1:1 Instagram carousel tiles. */
export function sliceCarousel(src: HTMLCanvasElement, maxTiles = 10): HTMLCanvasElement[] {
  const tileW = src.height
  if (src.width <= tileW * 1.08) return [cloneCanvas(src)]
  const count = Math.min(maxTiles, Math.max(2, Math.round(src.width / tileW)))
  const sliceW = src.width / count
  const tiles: HTMLCanvasElement[] = []
  for (let i = 0; i < count; i++) {
    const tile = createCanvas(Math.round(sliceW), src.height)
    ctx2d(tile).drawImage(src, -Math.round(i * sliceW), 0)
    tiles.push(tile)
  }
  return tiles
}

export function resolveExportFitMode(presetId: string, fitMode: ExportFitMode): ExportFitMode {
  // YouTube 16:9 would otherwise crop the top and bottom of a portrait still.
  if (presetId === 'yt-thumb' && fitMode === 'fill') return 'stretch'
  return fitMode
}

export function renderExportCanvas(
  source: HTMLCanvasElement,
  preset: ExportPreset,
  fitMode: ExportFitMode,
): HTMLCanvasElement {
  if (preset.width == null || preset.height == null) return cloneCanvas(source)
  return fitCanvasToSize(source, preset.width, preset.height, resolveExportFitMode(preset.id, fitMode))
}

/** Rough on-disk size after canvas re-encode (no EXIF). */
export function estimateExportBytes(
  width: number,
  height: number,
  format: 'jpeg' | 'png' | 'webp',
  quality = 90,
): number {
  const pixels = Math.max(1, width) * Math.max(1, height)
  if (format === 'png') return Math.round(pixels * 1.6)
  const q = Math.max(0.4, Math.min(1, quality / 100))
  const bpp = format === 'webp' ? 0.35 + q * 0.9 : 0.45 + q * 1.4
  return Math.round(pixels * bpp)
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function formatExportName(
  template: string,
  vars: { name: string; preset: string; date?: string },
): string {
  const date = vars.date ?? new Date().toISOString().slice(0, 10)
  const safeName = vars.name.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80) || 'export'
  return template
    .replaceAll('{name}', safeName)
    .replaceAll('{preset}', vars.preset)
    .replaceAll('{date}', date)
}

export const DEFAULT_EXPORT_TEMPLATE = '{name}-{preset}'

