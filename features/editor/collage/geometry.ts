import type { CollageSlotShape } from './template-types'

export type CollageSlotGeom = {
  shape?: CollageSlotShape | string
  rotation?: number
}

export type CollageGeomLayer = {
  x: number
  y: number
  source: { width: number; height: number }
  collageCell?: { width?: number; height?: number }
  collageSlot?: CollageSlotGeom
}

export function collageSlotSize(layer: CollageGeomLayer): { w: number; h: number } {
  return {
    w: layer.collageCell?.width ?? layer.source.width,
    h: layer.collageCell?.height ?? layer.source.height,
  }
}

/** White polaroid mat around the photo (document pixels). */
export function polaroidChrome(width: number, height: number): { side: number; bottom: number } {
  const side = Math.min(width, height) * 0.08
  const bottom = height * 0.22
  return { side, bottom }
}

function asSlotShape(value?: string): CollageSlotShape {
  if (value === 'rounded' || value === 'circle' || value === 'polaroid') return value
  return 'rect'
}

/** Map a screen/document delta into the slot's un-rotated local axes. */
export function inverseRotateDelta(dx: number, dy: number, rotationDeg = 0): { dx: number; dy: number } {
  if (!rotationDeg) return { dx, dy }
  const rad = (-rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  return { dx: dx * cos - dy * sin, dy: dx * sin + dy * cos }
}

export function pointInCollageSlot(layer: CollageGeomLayer, x: number, y: number): boolean {
  const { w, h } = collageSlotSize(layer)
  const cx = layer.x + w / 2
  const cy = layer.y + h / 2
  const local = inverseRotateDelta(x - cx, y - cy, layer.collageSlot?.rotation ?? 0)
  const shape = asSlotShape(layer.collageSlot?.shape)
  if (shape === 'circle') {
    const rx = w / 2
    const ry = h / 2
    if (rx < 0.5 || ry < 0.5) return false
    return (local.dx * local.dx) / (rx * rx) + (local.dy * local.dy) / (ry * ry) <= 1
  }
  return local.dx >= -w / 2 && local.dx <= w / 2 && local.dy >= -h / 2 && local.dy <= h / 2
}

export function collageSlotOverlayBox(
  layer: CollageGeomLayer,
  zoom: number,
): {
  left: number
  top: number
  width: number
  height: number
  originX: number
  originY: number
  rotation: number
  radius: number
  shape: CollageSlotShape
} {
  const { w, h } = collageSlotSize(layer)
  const shape = asSlotShape(layer.collageSlot?.shape)
  const rotation = layer.collageSlot?.rotation ?? 0
  const baseRadius = Math.max(10, Math.min(22, Math.round(Math.min(w, h) * zoom * 0.035)))
  if (shape === 'polaroid') {
    const { side, bottom } = polaroidChrome(w, h)
    return {
      left: (layer.x - side) * zoom,
      top: (layer.y - side) * zoom,
      width: (w + side * 2) * zoom,
      height: (h + side + bottom) * zoom,
      originX: (side + w / 2) * zoom,
      originY: (side + h / 2) * zoom,
      rotation,
      radius: Math.max(4, Math.round(Math.min(w, h) * zoom * 0.02)),
      shape,
    }
  }
  return {
    left: layer.x * zoom,
    top: layer.y * zoom,
    width: w * zoom,
    height: h * zoom,
    originX: (w / 2) * zoom,
    originY: (h / 2) * zoom,
    rotation,
    radius: shape === 'circle' ? 999 : shape === 'rounded' ? Math.max(baseRadius, Math.round(Math.min(w, h) * zoom * 0.08)) : baseRadius,
    shape,
  }
}
