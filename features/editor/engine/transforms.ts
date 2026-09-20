import { createCanvas, ctx2d, resampleCanvas } from '@/lib/image/canvas'
import type { CropRect, DocumentState, Layer } from '../types'

/** Crops every layer to `rect` (document space) and shrinks the document. */
export function cropDocument(doc: DocumentState, rect: CropRect): DocumentState {
  const x = Math.max(0, Math.round(rect.x))
  const y = Math.max(0, Math.round(rect.y))
  const w = Math.max(1, Math.min(Math.round(rect.width), doc.width - x))
  const h = Math.max(1, Math.min(Math.round(rect.height), doc.height - y))

  const layers = doc.layers.map<Layer>((layer) => {
    const out = createCanvas(w, h)
    ctx2d(out).drawImage(layer.source, layer.x - x, layer.y - y)
    return { ...layer, source: out, x: 0, y: 0 }
  })
  return { ...doc, width: w, height: h, layers, selection: null }
}

/** Resizes the whole document, scaling every layer proportionally. */
export function resizeDocument(
  doc: DocumentState,
  width: number,
  height: number,
): DocumentState {
  const sx = width / doc.width
  const sy = height / doc.height
  const layers = doc.layers.map<Layer>((layer) => {
    const nw = Math.max(1, Math.round(layer.source.width * sx))
    const nh = Math.max(1, Math.round(layer.source.height * sy))
    return {
      ...layer,
      source: resampleCanvas(layer.source, nw, nh),
      x: Math.round(layer.x * sx),
      y: Math.round(layer.y * sy),
    }
  })
  return { ...doc, width, height, layers, selection: null }
}

/** Rotates the document by a multiple of 90 degrees (positive = clockwise). */
export function rotateDocument90(doc: DocumentState, quarterTurns: 1 | -1 | 2): DocumentState {
  const swap = quarterTurns !== 2
  const W = swap ? doc.height : doc.width
  const H = swap ? doc.width : doc.height

  const layers = doc.layers.map<Layer>((layer) => {
    // Flatten the layer into full document space first so offsets rotate too.
    const full = createCanvas(doc.width, doc.height)
    ctx2d(full).drawImage(layer.source, layer.x, layer.y)
    const out = createCanvas(W, H)
    const ctx = ctx2d(out)
    ctx.translate(W / 2, H / 2)
    ctx.rotate((quarterTurns * Math.PI) / 2)
    ctx.drawImage(full, -doc.width / 2, -doc.height / 2)
    return { ...layer, source: out, x: 0, y: 0 }
  })
  return { ...doc, width: W, height: H, layers, selection: null }
}

export function flipDocument(doc: DocumentState, axis: 'horizontal' | 'vertical'): DocumentState {
  const layers = doc.layers.map<Layer>((layer) => {
    const full = createCanvas(doc.width, doc.height)
    ctx2d(full).drawImage(layer.source, layer.x, layer.y)
    const out = createCanvas(doc.width, doc.height)
    const ctx = ctx2d(out)
    if (axis === 'horizontal') {
      ctx.translate(doc.width, 0)
      ctx.scale(-1, 1)
    } else {
      ctx.translate(0, doc.height)
      ctx.scale(1, -1)
    }
    ctx.drawImage(full, 0, 0)
    return { ...layer, source: out, x: 0, y: 0 }
  })
  return { ...doc, layers, selection: null }
}

/**
 * Rotates a single layer by an arbitrary angle around its centre. The layer's
 * canvas grows to fit the rotated bounds so nothing is clipped.
 */
export function rotateLayer(layer: Layer, degrees: number): Layer {
  const rad = (degrees * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const w = layer.source.width
  const h = layer.source.height
  const nw = Math.ceil(w * cos + h * sin)
  const nh = Math.ceil(w * sin + h * cos)
  const out = createCanvas(nw, nh)
  const ctx = ctx2d(out)
  ctx.imageSmoothingQuality = 'high'
  ctx.translate(nw / 2, nh / 2)
  ctx.rotate(rad)
  ctx.drawImage(layer.source, -w / 2, -h / 2)
  return {
    ...layer,
    source: out,
    x: Math.round(layer.x + w / 2 - nw / 2),
    y: Math.round(layer.y + h / 2 - nh / 2),
  }
}
