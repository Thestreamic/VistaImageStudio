import { createCanvas, ctx2d } from '@/lib/image/canvas'
import type { TextLayerData } from '../types'

const PADDING = 24 // px, keeps stroke/shadow from clipping at the canvas edge

/**
 * Rasterises a text layer's content into a tightly-fitted canvas. Called any
 * time text properties change (content, font, color, ...); the resulting
 * canvas becomes the layer's `source`, so the rest of the pipeline — the
 * compositor, adjustments, transforms — treats a text layer exactly like any
 * pixel layer and needs no special-casing.
 */
export function renderTextLayer(data: TextLayerData): HTMLCanvasElement {
  const display = data.uppercase ? data.content.toUpperCase() : data.content
  const lines = display.split('\n')
  const font = `${data.fontWeight} ${data.fontSize}px "${data.fontFamily}", sans-serif`

  // Measure with a throwaway context first to size the real canvas.
  const measure = createCanvas(1, 1)
  const mctx = ctx2d(measure)
  mctx.font = font
  let maxWidth = 0
  for (const line of lines) {
    const w = measureLineWidth(mctx, line, data.letterSpacing)
    if (w > maxWidth) maxWidth = w
  }
  const lineHeightPx = data.fontSize * data.lineHeight
  const textHeight = lineHeightPx * lines.length

  const strokePad = data.strokeColor ? data.strokeWidth * 2 : 0
  const width = Math.max(1, Math.ceil(maxWidth + PADDING * 2 + strokePad))
  const height = Math.max(1, Math.ceil(textHeight + PADDING * 2 + strokePad))

  const canvas = createCanvas(width, height)
  const ctx = ctx2d(canvas)
  ctx.font = font
  ctx.textBaseline = 'alphabetic'

  if (data.backgroundColor) {
    ctx.fillStyle = data.backgroundColor
    roundRect(ctx, 0, 0, width, height, Math.min(16, height / 4))
    ctx.fill()
  }

  const centerX = width / 2
  const startY = PADDING + strokePad / 2 + data.fontSize * 0.82 // approximate cap-height baseline offset

  lines.forEach((line, i) => {
    const y = startY + i * lineHeightPx
    const lineWidth = measureLineWidth(ctx, line, data.letterSpacing)
    let x: number
    if (data.align === 'left') x = PADDING + strokePad / 2
    else if (data.align === 'right') x = width - PADDING - strokePad / 2 - lineWidth
    else x = centerX - lineWidth / 2

    drawLetterSpaced(ctx, line, x, y, data.letterSpacing, data.strokeColor, data.strokeWidth, data.color)
  })

  return canvas
}

function measureLineWidth(ctx: CanvasRenderingContext2D, line: string, letterSpacing: number): number {
  if (line.length === 0) return 0
  let w = 0
  for (const ch of line) w += ctx.measureText(ch).width + letterSpacing
  return w - letterSpacing
}

function drawLetterSpaced(
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  letterSpacing: number,
  strokeColor: string | null,
  strokeWidth: number,
  fillColor: string,
) {
  let cursor = x
  for (const ch of line) {
    if (strokeColor && strokeWidth > 0) {
      ctx.lineWidth = strokeWidth
      ctx.strokeStyle = strokeColor
      ctx.strokeText(ch, cursor, y)
    }
    ctx.fillStyle = fillColor
    ctx.fillText(ch, cursor, y)
    cursor += ctx.measureText(ch).width + letterSpacing
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}
