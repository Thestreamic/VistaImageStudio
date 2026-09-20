import { describe, it, expect } from 'vitest'
import { smartSelectFloodFill } from '@/features/ai/algorithms/smart-select'

describe('smartSelectFloodFill', () => {
  it('selects a contiguous flat region and stops at a hard colour edge', () => {
    const w = 20, h = 20
    const data = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const left = x < w / 2
        data[i] = left ? 30 : 220
        data[i + 1] = left ? 30 : 220
        data[i + 2] = left ? 30 : 220
        data[i + 3] = 255
      }
    }
    const mask = smartSelectFloodFill(data, w, h, 2, 2, { tolerance: 10, contiguous: true })
    expect(mask[2 * w + 2]).toBe(255) // seed region selected
    expect(mask[2 * w + (w - 3)]).toBe(0) // far side not selected
  })
})
