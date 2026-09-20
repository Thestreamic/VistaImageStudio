import { createCanvas, ctx2d } from '@/lib/image/canvas'
import type { CollageBackgroundPattern, CollageShapeKind } from './template-types'

function unitNoise(i: number): number {
  const x = Math.sin(i * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

export function paintBackgroundPattern(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pattern: CollageBackgroundPattern | undefined,
): void {
  if (!pattern || pattern === 'none') return
  if (pattern === 'speckle') {
    ctx.save()
    ctx.globalAlpha = 0.18
    const count = Math.round((width * height) / 1400)
    for (let i = 0; i < count; i++) {
      const x = unitNoise(i * 3.1) * width
      const y = unitNoise(i * 7.7 + 4) * height
      const r = 0.6 + unitNoise(i * 11.3) * 1.4
      ctx.fillStyle = i % 5 === 0 ? 'rgba(255,255,255,0.7)' : 'rgba(80,50,30,0.35)'
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    return
  }
  ctx.save()
  ctx.strokeStyle = 'rgba(90, 70, 40, 0.06)'
  ctx.lineWidth = 1
  const step = 6
  for (let x = 0; x < width + height; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x - height, height)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
  for (let x = -height; x < width; x += step) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x + height, height)
    ctx.stroke()
  }
  ctx.restore()
}

export function drawDecorShape(
  kind: CollageShapeKind,
  width: number,
  height: number,
  color: string,
): HTMLCanvasElement {
  const w = Math.max(8, Math.round(width))
  const h = Math.max(8, Math.round(height))
  const canvas = createCanvas(w, h)
  const ctx = ctx2d(canvas, 'draw')
  ctx.fillStyle = color
  ctx.strokeStyle = color
  if (kind === 'heart') drawHeart(ctx, w, h)
  else if (kind === 'dot') drawDot(ctx, w, h)
  else if (kind === 'sprig') drawSprig(ctx, w, h, color)
  else if (kind === 'tape') drawTape(ctx, w, h, color)
  else drawFlower(ctx, w, h, color)
  return canvas
}

function drawHeart(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.beginPath()
  const x = w / 2
  ctx.moveTo(x, h * 0.86)
  ctx.bezierCurveTo(w * 0.05, h * 0.58, w * 0.02, h * 0.18, x, h * 0.32)
  ctx.bezierCurveTo(w * 0.98, h * 0.18, w * 0.95, h * 0.58, x, h * 0.86)
  ctx.fill()
}

function drawDot(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.beginPath()
  ctx.ellipse(w / 2, h / 2, w * 0.42, h * 0.42, 0, 0, Math.PI * 2)
  ctx.fill()
}

function drawSprig(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(1.5, Math.min(w, h) * 0.06)
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(w * 0.15, h * 0.85)
  ctx.quadraticCurveTo(w * 0.45, h * 0.4, w * 0.85, h * 0.18)
  ctx.stroke()
  for (const leaf of [
    [0.32, 0.68, 0.18, 0.52],
    [0.48, 0.5, 0.62, 0.36],
    [0.62, 0.36, 0.52, 0.2],
    [0.4, 0.58, 0.55, 0.7],
  ] as const) {
    ctx.beginPath()
    ctx.moveTo(w * leaf[0], h * leaf[1])
    ctx.quadraticCurveTo(w * ((leaf[0] + leaf[2]) / 2 + 0.08), h * ((leaf[1] + leaf[3]) / 2), w * leaf[2], h * leaf[3])
    ctx.quadraticCurveTo(w * ((leaf[0] + leaf[2]) / 2 - 0.04), h * ((leaf[1] + leaf[3]) / 2 + 0.04), w * leaf[0], h * leaf[1])
    ctx.fill()
  }
}

function drawTape(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.rotate(-0.18)
  ctx.fillStyle = color
  ctx.globalAlpha = 0.82
  const tw = w * 0.92
  const th = h * 0.55
  ctx.fillRect(-tw / 2, -th / 2, tw, th)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = 1
  ctx.strokeRect(-tw / 2 + 1, -th / 2 + 1, tw - 2, th - 2)
  ctx.restore()
}

function drawFlower(ctx: CanvasRenderingContext2D, w: number, h: number, color: string) {
  const cx = w * 0.5
  const cy = h * 0.55
  const petals = 5
  const pr = Math.min(w, h) * 0.22
  for (let i = 0; i < petals; i++) {
    const a = (i / petals) * Math.PI * 2 - Math.PI / 2
    ctx.beginPath()
    ctx.ellipse(cx + Math.cos(a) * pr * 0.85, cy + Math.sin(a) * pr * 0.85, pr, pr * 0.7, a, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.beginPath()
  ctx.arc(cx, cy, pr * 0.42, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(w * 0.28, h * 0.28, pr * 0.55, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.ellipse(w * 0.72, h * 0.22, pr * 0.7, pr * 0.4, 0.4, 0, Math.PI * 2)
  ctx.fill()
}
