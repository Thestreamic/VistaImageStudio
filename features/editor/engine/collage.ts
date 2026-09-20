import { createCanvas, ctx2d } from '@/lib/image/canvas'
import { paintBackgroundPattern } from '../collage/decor-draw'
import type { CollageBackgroundPattern } from '../collage/template-types'
import { collageFrameColor } from '../collage-frame'
import type { CollageFit } from '../types'

export type CollageFitHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'se' | 'sw'

export const DEFAULT_COLLAGE_FIT: CollageFit = { scale: 1, panX: 0.5, panY: 0.5 }

export function clampCollageFit(fit?: Partial<CollageFit> | null): CollageFit {
  const scale = fit?.scale ?? DEFAULT_COLLAGE_FIT.scale
  const panX = fit?.panX ?? DEFAULT_COLLAGE_FIT.panX
  const panY = fit?.panY ?? DEFAULT_COLLAGE_FIT.panY
  return {
    scale: scale < 1 ? 1 : scale > 8 ? 8 : scale,
    panX: panX < 0 ? 0 : panX > 1 ? 1 : panX,
    panY: panY < 0 ? 0 : panY > 1 ? 1 : panY,
  }
}

/** Where the photo is drawn inside a collage box (CSS cover + pan/zoom). */
export function coverDrawRect(
  sourceW: number,
  sourceH: number,
  targetW: number,
  targetH: number,
  fit?: Partial<CollageFit> | null,
): { dx: number; dy: number; dw: number; dh: number } {
  const { scale, panX, panY } = clampCollageFit(fit)
  const srcRatio = sourceW / Math.max(1, sourceH)
  const dstRatio = targetW / Math.max(1, targetH)
  let dw: number
  let dh: number
  if (srcRatio > dstRatio) {
    dh = targetH * scale
    dw = dh * srcRatio
  } else {
    dw = targetW * scale
    dh = dw / srcRatio
  }
  return {
    dx: (targetW - dw) * panX,
    dy: (targetH - dh) * panY,
    dw,
    dh,
  }
}

/** Drag the photo inside a frame: interior = x/y, edges = one axis, corners = zoom. */
export function collageFitFromDrag(
  start: Partial<CollageFit> | null | undefined,
  handle: CollageFitHandle,
  dx: number,
  dy: number,
  sourceW: number,
  sourceH: number,
  cellW: number,
  cellH: number,
): CollageFit {
  const startFit = clampCollageFit(start)
  if (handle === 'nw' || handle === 'ne' || handle === 'se' || handle === 'sw') {
    const signX = handle.includes('e') ? 1 : -1
    const signY = handle.includes('s') ? 1 : -1
    const span = Math.max(8, Math.min(cellW, cellH))
    const delta = (signX * dx + signY * dy) / span
    return clampCollageFit({ ...startFit, scale: startFit.scale * (1 + delta) })
  }
  const { dw, dh } = coverDrawRect(sourceW, sourceH, cellW, cellH, startFit)
  let panX = startFit.panX
  let panY = startFit.panY
  const overflowX = dw - cellW
  const overflowY = dh - cellH
  if ((handle === 'move' || handle === 'e' || handle === 'w') && overflowX > 0.5) {
    panX = startFit.panX - dx / overflowX
  }
  if ((handle === 'move' || handle === 'n' || handle === 's') && overflowY > 0.5) {
    panY = startFit.panY - dy / overflowY
  }
  return clampCollageFit({ ...startFit, panX, panY })
}

/** Scales + crops `source` to exactly fill a `targetW`×`targetH` box, like
 *  CSS `object-fit: cover` — no letterboxing. `fit` pans/zooms inside the box. */
export function coverCropToSize(
  source: HTMLCanvasElement,
  targetW: number,
  targetH: number,
  fit?: Partial<CollageFit> | null,
): HTMLCanvasElement {
  const out = createCanvas(Math.max(1, Math.round(targetW)), Math.max(1, Math.round(targetH)))
  const ctx = ctx2d(out, 'draw')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const { dx, dy, dw, dh } = coverDrawRect(source.width, source.height, out.width, out.height, fit)
  ctx.drawImage(source, dx, dy, dw, dh)
  return out
}

/** Cream + brand-wash page that shows through collage gutters (Canva-style mat). */
export function renderCollageMat(
  width: number,
  height: number,
  color?: string,
  pattern?: CollageBackgroundPattern,
): HTMLCanvasElement {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const canvas = createCanvas(w, h)
  const ctx = ctx2d(canvas, 'draw')
  if (color) {
    ctx.fillStyle = color
    ctx.fillRect(0, 0, w, h)
  } else {
    const wash = ctx.createLinearGradient(0, 0, w, h)
    wash.addColorStop(0, '#fff5fb')
    wash.addColorStop(0.45, '#f3edff')
    wash.addColorStop(1, '#e8f3ff')
    ctx.fillStyle = wash
    ctx.fillRect(0, 0, w, h)
  }
  paintBackgroundPattern(ctx, w, h, pattern)
  return canvas
}

/** A dashed, "tap to add a photo" placeholder cell — colourful Canva-style frame. */
export function renderCollagePlaceholder(width: number, height: number, cellNumber: number): HTMLCanvasElement {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const canvas = createCanvas(w, h)
  const ctx = ctx2d(canvas)
  const frame = collageFrameColor(cellNumber - 1)

  ctx.fillStyle = frame.canvasBg
  ctx.fillRect(0, 0, w, h)

  const pad = Math.max(10, Math.min(w, h) * 0.045)
  const radius = Math.max(12, Math.min(28, Math.min(w, h) * 0.04))
  ctx.strokeStyle = frame.stroke
  ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.012)
  ctx.setLineDash([10, 7])
  ctx.beginPath()
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(pad, pad, w - pad * 2, h - pad * 2, radius)
  } else {
    ctx.rect(pad, pad, w - pad * 2, h - pad * 2)
  }
  ctx.stroke()
  ctx.setLineDash([])

  const cx = w / 2
  const cy = h / 2 - Math.min(w, h) * 0.04
  const badge = Math.min(w, h) * 0.11
  ctx.fillStyle = frame.stroke
  ctx.beginPath()
  ctx.arc(cx, cy, badge, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.shadowColor = 'transparent'
  const plus = badge * 0.42
  ctx.lineWidth = Math.max(3, badge * 0.18)
  ctx.lineCap = 'round'
  ctx.strokeStyle = '#ffffff'
  ctx.beginPath()
  ctx.moveTo(cx - plus, cy)
  ctx.lineTo(cx + plus, cy)
  ctx.moveTo(cx, cy - plus)
  ctx.lineTo(cx, cy + plus)
  ctx.stroke()

  ctx.fillStyle = frame.ink
  ctx.font = `600 ${Math.max(12, Math.min(w, h) * 0.055)}px "Source Sans 3", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText('Add a photo', cx, cy + badge + Math.max(10, badge * 0.35))

  return canvas
}

/** Rotate a bitmap by quarter-turns (positive = clockwise) without changing origin. */
export function rotateCanvas90(src: HTMLCanvasElement, quarterTurns: 1 | -1 | 2): HTMLCanvasElement {
  const turns = ((quarterTurns % 4) + 4) % 4
  if (turns === 0) return src
  const swap = turns % 2 === 1
  const out = createCanvas(swap ? src.height : src.width, swap ? src.width : src.height)
  const ctx = ctx2d(out, 'draw')
  ctx.translate(out.width / 2, out.height / 2)
  ctx.rotate((turns * Math.PI) / 2)
  ctx.drawImage(src, -src.width / 2, -src.height / 2)
  return out
}

export function flipCanvas(src: HTMLCanvasElement, axis: 'horizontal' | 'vertical'): HTMLCanvasElement {
  const out = createCanvas(src.width, src.height)
  const ctx = ctx2d(out, 'draw')
  if (axis === 'horizontal') {
    ctx.translate(src.width, 0)
    ctx.scale(-1, 1)
  } else {
    ctx.translate(0, src.height)
    ctx.scale(1, -1)
  }
  ctx.drawImage(src, 0, 0)
  return out
}
