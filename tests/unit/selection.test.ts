import { describe, it, expect } from 'vitest'
import { combineSelections, invertSelection, selectionMaskForLayer } from '@/features/editor/engine/selection'
import type { Selection } from '@/features/editor/types'

function makeSelection(w: number, h: number, on: (x: number, y: number) => boolean): Selection {
  const mask = new Uint8ClampedArray(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (on(x, y)) mask[y * w + x] = 255
  return { width: w, height: h, mask }
}

describe('selection combine', () => {
  const left = makeSelection(4, 4, (x) => x < 2)
  const right = makeSelection(4, 4, (x) => x >= 2)

  it('replace uses only the new selection', () => {
    const result = combineSelections(left, right, 'replace')
    expect(Array.from(result.mask)).toEqual(Array.from(right.mask))
  })

  it('add unions both selections', () => {
    const result = combineSelections(left, right, 'add')
    expect(result.mask.every((v) => v === 255)).toBe(true)
  })

  it('subtract removes the new selection from the existing one', () => {
    const full = makeSelection(4, 4, () => true)
    const result = combineSelections(full, right, 'subtract')
    expect(result.mask[0]).toBe(255) // x=0 (left) still selected
    expect(result.mask[3]).toBe(0) // x=3 (right) removed
  })

  it('invert flips every pixel', () => {
    const sel = makeSelection(2, 2, (x, y) => x === 0 && y === 0)
    const inv = invertSelection(sel)
    expect(inv.mask[0]).toBe(0)
    expect(inv.mask[1]).toBe(255)
  })
})

describe('selectionMaskForLayer', () => {
  it('copies the overlapping document mask onto the layer', () => {
    const sel = makeSelection(4, 4, (x, y) => x === 2 && y === 1)
    const mask = selectionMaskForLayer(sel, { x: 1, y: 0, source: { width: 2, height: 2 } })
    expect(mask[1 * 2 + 1]).toBe(255) // layer (1,1) = doc (2,1)
    expect(mask[0]).toBe(0)
  })
})
