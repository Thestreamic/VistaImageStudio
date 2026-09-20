import { createCanvas, ctx2d } from '@/lib/image/canvas'

/** Renders a handle/watermark string to a transparent canvas for overlay layers. */
export function renderWatermarkText(text: string): HTMLCanvasElement {
  const label = text.trim() || '@studio'
  const fontSize = 72
  const pad = 16
  const measure = createCanvas(8, 8)
  const mctx = ctx2d(measure)
  mctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`
  const width = Math.ceil(mctx.measureText(label).width) + pad * 2
  const height = fontSize + pad * 2
  const c = createCanvas(width, height)
  const ctx = ctx2d(c)
  ctx.font = `600 ${fontSize}px Inter, system-ui, sans-serif`
  ctx.textBaseline = 'middle'
  ctx.fillStyle = 'rgba(0,0,0,0.45)'
  ctx.fillText(label, pad + 2, height / 2 + 2)
  ctx.fillStyle = '#ffffff'
  ctx.fillText(label, pad, height / 2)
  return c
}
