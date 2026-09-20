import { createCanvas, ctx2d } from '@/lib/image/canvas'
import { polaroidChrome } from '../collage/geometry'
import type { BlendMode, DocumentState, Layer, WatermarkCorner } from '../types'
import { isIdentityAdjustments } from '../types'
import { adjustmentsKey, applyAdjustmentsToPixels } from './adjustments'

const BLEND_TO_COMPOSITE: Record<BlendMode, GlobalCompositeOperation> = {
  normal: 'source-over',
  multiply: 'multiply',
  screen: 'screen',
  overlay: 'overlay',
  darken: 'darken',
  lighten: 'lighten',
  'soft-light': 'soft-light',
  difference: 'difference',
  luminosity: 'luminosity',
}

interface CacheEntry {
  key: string
  source: HTMLCanvasElement
  canvas: HTMLCanvasElement
}

function frameForWatermark(doc: DocumentState) {
  return doc.crop ?? { x: 0, y: 0, width: doc.width, height: doc.height }
}

export function watermarkDest(
  doc: DocumentState,
  layer: Layer,
): { x: number; y: number; w: number; h: number; opacity: number; rotation: number } {
  const wm = layer.watermark
  const frame = frameForWatermark(doc)
  const scale = wm?.scale ?? 0.18
  const margin = wm?.margin ?? 24
  const maxSide = Math.max(16, Math.min(frame.width, frame.height) * scale)
  const ratio = layer.source.width / Math.max(1, layer.source.height)
  let w = maxSide
  let h = maxSide / ratio
  if (h > maxSide) {
    h = maxSide
    w = maxSide * ratio
  }
  const corner: WatermarkCorner = wm?.corner ?? 'br'
  let x = frame.x + margin
  let y = frame.y + margin
  if (corner === 'tr' || corner === 'br') x = frame.x + frame.width - margin - w
  if (corner === 'bl' || corner === 'br') y = frame.y + frame.height - margin - h
  if (corner === 'tl') {
    x = frame.x + margin
    y = frame.y + margin
  }
  if (corner === 'center') {
    x = frame.x + (frame.width - w) / 2
    y = frame.y + (frame.height - h) / 2
  }
  return { x, y, w, h, opacity: (wm?.opacity ?? 1) * layer.opacity, rotation: wm?.rotation ?? 0 }
}

/**
 * Compositor keeps a per-layer cache of the "adjusted" bitmap so dragging a
 * slider on one layer never re-processes the others.
 */
export class Compositor {
  private cache = new Map<string, CacheEntry>()

  private adjustedLayer(layer: Layer, scale = 1): HTMLCanvasElement {
    const sw = Math.max(1, Math.round(layer.source.width * scale))
    const sh = Math.max(1, Math.round(layer.source.height * scale))
    if (isIdentityAdjustments(layer.adjustments)) {
      if (scale >= 0.999) return layer.source
      const key = `id:${sw}x${sh}`
      const hit = this.cache.get(layer.id)
      if (hit && hit.key === key && hit.source === layer.source) return hit.canvas
      const out = createCanvas(sw, sh)
      ctx2d(out, 'draw').drawImage(layer.source, 0, 0, sw, sh)
      this.cache.set(layer.id, { key, source: layer.source, canvas: out })
      return out
    }
    const key = `${adjustmentsKey(layer.adjustments)}:${sw}x${sh}`
    const hit = this.cache.get(layer.id)
    if (hit && hit.key === key && hit.source === layer.source) return hit.canvas

    const out = createCanvas(sw, sh)
    const ctx = ctx2d(out)
    ctx.drawImage(layer.source, 0, 0, sw, sh)
    const img = ctx.getImageData(0, 0, out.width, out.height)
    applyAdjustmentsToPixels(img.data, layer.adjustments, out.width, out.height)
    ctx.putImageData(img, 0, 0)
    this.cache.set(layer.id, { key, source: layer.source, canvas: out })
    return out
  }

  /** Renders the whole document into `target` (created if omitted). */
  render(doc: DocumentState, target?: HTMLCanvasElement, opts?: { scale?: number }): HTMLCanvasElement {
    const scale = opts?.scale && opts.scale > 0 ? Math.min(1, opts.scale) : 1
    const width = Math.max(1, Math.round(doc.width * scale))
    const height = Math.max(1, Math.round(doc.height * scale))
    const out = target ?? createCanvas(width, height)
    if (out.width !== width || out.height !== height) {
      out.width = width
      out.height = height
    }
    const ctx = ctx2d(out, 'draw')
    ctx.clearRect(0, 0, out.width, out.height)
    const watermarks: Layer[] = []
    for (const layer of doc.layers) {
      if (!layer.visible || layer.opacity <= 0) continue
      if (layer.kind === 'watermark' || layer.watermark) {
        watermarks.push(layer)
        continue
      }
      const src = this.adjustedLayer(layer, scale)
      ctx.globalAlpha = layer.opacity
      ctx.globalCompositeOperation = BLEND_TO_COMPOSITE[layer.blendMode]
      drawDocumentLayer(ctx, layer, src, scale)
    }
    ctx.globalCompositeOperation = 'source-over'
    for (const layer of watermarks) {
      const dest = watermarkDest(doc, layer)
      const src = this.adjustedLayer(layer, scale)
      ctx.save()
      ctx.globalAlpha = dest.opacity
      if (dest.rotation) {
        ctx.translate((dest.x + dest.w / 2) * scale, (dest.y + dest.h / 2) * scale)
        ctx.rotate((dest.rotation * Math.PI) / 180)
        ctx.drawImage(src, (-dest.w / 2) * scale, (-dest.h / 2) * scale, dest.w * scale, dest.h * scale)
      } else {
        ctx.drawImage(src, dest.x * scale, dest.y * scale, dest.w * scale, dest.h * scale)
      }
      ctx.restore()
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    return out
  }

  /** Full composite clipped to the live crop (or the whole canvas). */
  renderOutput(doc: DocumentState): HTMLCanvasElement {
    const full = this.render(doc)
    if (!doc.crop) return full
    const { x, y, width, height } = doc.crop
    const out = createCanvas(Math.max(1, Math.round(width)), Math.max(1, Math.round(height)))
    ctx2d(out).drawImage(full, -x, -y)
    return out
  }

  /** Renders a single layer with its adjustments baked in, in document space. */
  flattenLayer(layer: Layer, width: number, height: number): HTMLCanvasElement {
    const out = createCanvas(width, height)
    const ctx = ctx2d(out)
    drawDocumentLayer(ctx, layer, this.adjustedLayer(layer), 1)
    return out
  }

  prune(liveIds: Set<string>) {
    for (const id of this.cache.keys()) if (!liveIds.has(id)) this.cache.delete(id)
  }
}

export const compositor = new Compositor()

function clipSlotPath(
  ctx: CanvasRenderingContext2D,
  shape: NonNullable<Layer['collageSlot']>['shape'],
  hw: number,
  hh: number,
) {
  ctx.beginPath()
  if (shape === 'circle') {
    ctx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2)
  } else if (shape === 'rounded' || shape === 'polaroid') {
    const r = Math.min(hw, hh) * (shape === 'polaroid' ? 0.04 : 0.16)
    const x = -hw
    const y = -hh
    const w = hw * 2
    const h = hh * 2
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r)
    else ctx.rect(x, y, w, h)
  } else {
    ctx.rect(-hw, -hh, hw * 2, hh * 2)
  }
  ctx.clip()
}

export function drawDocumentLayer(
  ctx: CanvasRenderingContext2D,
  layer: Layer,
  src: HTMLCanvasElement,
  scale: number,
) {
  const destW = Math.max(1, (layer.collageCell?.width ?? layer.source.width) * scale)
  const destH = Math.max(1, (layer.collageCell?.height ?? layer.source.height) * scale)
  const dx = layer.x * scale
  const dy = layer.y * scale
  const slot = layer.collageSlot
  const isSlot = !!(layer.collageCell || slot)
  if (!isSlot) {
    ctx.drawImage(src, dx, dy, destW, destH)
    return
  }

  const shape = slot?.shape ?? 'rect'
  const rotation = ((slot?.rotation ?? 0) * Math.PI) / 180
  const cx = dx + destW / 2
  const cy = dy + destH / 2
  ctx.save()
  ctx.translate(cx, cy)
  if (rotation) ctx.rotate(rotation)

  if (shape === 'polaroid') {
    const { side, bottom } = polaroidChrome(destW, destH)
    ctx.shadowColor = 'rgba(40, 28, 18, 0.28)'
    ctx.shadowBlur = Math.max(8, 14 * scale)
    ctx.shadowOffsetY = Math.max(3, 6 * scale)
    ctx.fillStyle = '#fffdf8'
    ctx.fillRect(-destW / 2 - side, -destH / 2 - side, destW + side * 2, destH + side + bottom)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
  } else if (shape !== 'rect' || rotation) {
    ctx.shadowColor = 'rgba(40, 28, 18, 0.16)'
    ctx.shadowBlur = Math.max(6, 10 * scale)
    ctx.shadowOffsetY = Math.max(2, 4 * scale)
    ctx.fillStyle = 'rgba(0,0,0,0.001)'
    ctx.fillRect(-destW / 2, -destH / 2, destW, destH)
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0
  }

  clipSlotPath(ctx, shape, destW / 2, destH / 2)
  ctx.drawImage(src, -destW / 2, -destH / 2, destW, destH)
  ctx.restore()
}

