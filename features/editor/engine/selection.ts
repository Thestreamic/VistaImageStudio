import type { CropRect, Selection } from '../types'

export function rectSelection(width: number, height: number, rect: CropRect): Selection {
  const mask = new Uint8ClampedArray(width * height)
  const x0 = Math.max(0, Math.floor(rect.x))
  const y0 = Math.max(0, Math.floor(rect.y))
  const x1 = Math.min(width, Math.ceil(rect.x + rect.width))
  const y1 = Math.min(height, Math.ceil(rect.y + rect.height))
  for (let y = y0; y < y1; y++) {
    mask.fill(255, y * width + x0, y * width + x1)
  }
  return { width, height, mask }
}

/**
 * Magic-wand style selection: scanline flood fill from a seed pixel, taking
 * every 4-connected neighbour whose colour distance is within `tolerance`.
 * Pure function over RGBA data so it is testable without a canvas.
 */
export function floodSelect(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  seedX: number,
  seedY: number,
  tolerance: number,
  contiguous = true,
): Selection {
  const mask = new Uint8ClampedArray(width * height)
  const sx = Math.floor(seedX)
  const sy = Math.floor(seedY)
  if (sx < 0 || sy < 0 || sx >= width || sy >= height) return { width, height, mask }

  const si = (sy * width + sx) * 4
  const sr = data[si]
  const sg = data[si + 1]
  const sb = data[si + 2]
  const sa = data[si + 3]
  const tol2 = tolerance * tolerance * 3

  const matches = (i: number) => {
    const p = i * 4
    const dr = data[p] - sr
    const dg = data[p + 1] - sg
    const db = data[p + 2] - sb
    const da = data[p + 3] - sa
    return dr * dr + dg * dg + db * db + da * da <= tol2
  }

  if (!contiguous) {
    for (let i = 0; i < width * height; i++) if (matches(i)) mask[i] = 255
    return { width, height, mask }
  }

  const stack: number[] = [sy * width + sx]
  while (stack.length) {
    const idx = stack.pop() as number
    if (mask[idx]) continue
    const y = Math.floor(idx / width)
    let x = idx - y * width
    // Walk left to the run start.
    while (x > 0 && !mask[idx - (idx % width) + x - 1] && matches(idx - (idx % width) + x - 1)) x--
    let spanUp = false
    let spanDown = false
    const rowStart = y * width
    while (x < width && !mask[rowStart + x] && matches(rowStart + x)) {
      mask[rowStart + x] = 255
      if (y > 0) {
        const up = rowStart - width + x
        const m = !mask[up] && matches(up)
        if (m && !spanUp) {
          stack.push(up)
          spanUp = true
        } else if (!m) spanUp = false
      }
      if (y < height - 1) {
        const down = rowStart + width + x
        const m = !mask[down] && matches(down)
        if (m && !spanDown) {
          stack.push(down)
          spanDown = true
        } else if (!m) spanDown = false
      }
      x++
    }
  }
  return { width, height, mask }
}

export function invertSelection(sel: Selection): Selection {
  const mask = new Uint8ClampedArray(sel.mask.length)
  for (let i = 0; i < mask.length; i++) mask[i] = 255 - sel.mask[i]
  return { ...sel, mask }
}

export function combineSelections(
  a: Selection | null,
  b: Selection,
  mode: 'replace' | 'add' | 'subtract',
): Selection {
  if (!a || mode === 'replace' || a.width !== b.width || a.height !== b.height) return b
  const mask = new Uint8ClampedArray(b.mask.length)
  for (let i = 0; i < mask.length; i++) {
    mask[i] = mode === 'add' ? Math.max(a.mask[i], b.mask[i]) : Math.max(0, a.mask[i] - b.mask[i])
  }
  return { ...b, mask }
}

/** Grows a mask by `radius` pixels (box dilation) — used before inpainting. */
export function dilateMask(sel: Selection, radius: number): Selection {
  if (radius <= 0) return sel
  const { width, height } = sel
  const tmp = new Uint8ClampedArray(sel.mask.length)
  const out = new Uint8ClampedArray(sel.mask.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m = 0
      for (let k = -radius; k <= radius; k++) {
        const xx = x + k
        if (xx >= 0 && xx < width) m = Math.max(m, sel.mask[y * width + xx])
      }
      tmp[y * width + x] = m
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m = 0
      for (let k = -radius; k <= radius; k++) {
        const yy = y + k
        if (yy >= 0 && yy < height) m = Math.max(m, tmp[yy * width + x])
      }
      out[y * width + x] = m
    }
  }
  return { ...sel, mask: out }
}

export function selectionBounds(sel: Selection): CropRect | null {
  let minX = sel.width
  let minY = sel.height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < sel.height; y++) {
    for (let x = 0; x < sel.width; x++) {
      if (sel.mask[y * sel.width + x]) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}

export function selectionCoverage(sel: Selection): number {
  let n = 0
  for (let i = 0; i < sel.mask.length; i++) if (sel.mask[i] > 127) n++
  return n / sel.mask.length
}

/** Copy a document-space selection onto a layer's pixel grid. */
export function selectionMaskForLayer(
  sel: Selection,
  layer: { x: number; y: number; source: { width: number; height: number } },
): Uint8ClampedArray {
  const w = layer.source.width
  const h = layer.source.height
  const out = new Uint8ClampedArray(w * h)
  const ox = Math.round(layer.x)
  const oy = Math.round(layer.y)
  for (let y = 0; y < h; y++) {
    const dy = y + oy
    if (dy < 0 || dy >= sel.height) continue
    for (let x = 0; x < w; x++) {
      const dx = x + ox
      if (dx < 0 || dx >= sel.width) continue
      out[y * w + x] = sel.mask[dy * sel.width + dx]
    }
  }
  return out
}
