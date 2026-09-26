import { describe, it, expect } from 'vitest'
import { autoColor } from '@/features/ai/algorithms/auto-color'
import { gatedAutoColor } from '@/features/ai/algorithms/gated'

function flatImage(w: number, h: number, r: number, g: number, b: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255
  }
  return data
}

describe('autoColor', () => {
  it('does not throw on an empty buffer', () => {
    expect(() => autoColor(new Uint8ClampedArray(0))).not.toThrow()
  })

  it('neutralises a strong colour cast toward grey', () => {
    const data = flatImage(8, 8, 200, 120, 60) // warm cast
    autoColor(data)
    const spread = Math.max(data[0], data[1], data[2]) - Math.min(data[0], data[1], data[2])
    expect(spread).toBeLessThan(140) // pulled toward neutral vs original 140 spread
  })

  it('does not raise chroma on a saturated patch', () => {
    const w = 32
    const h = 32
    const data = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const v = Math.round((x / (w - 1)) * 255)
        data[i] = v
        data[i + 1] = v
        data[i + 2] = v
        data[i + 3] = 255
      }
    }
    const patch: number[] = []
    for (let y = 8; y < 16; y++) {
      for (let x = 8; x < 16; x++) {
        const i = (y * w + x) * 4
        data[i] = 200
        data[i + 1] = 40
        data[i + 2] = 40
        data[i + 3] = 255
        patch.push(i)
      }
    }
    const before = patch.map(
      (i) => Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2]),
    )
    autoColor(data)
    patch.forEach((i, n) => {
      const chroma = Math.max(data[i], data[i + 1], data[i + 2]) - Math.min(data[i], data[i + 1], data[i + 2])
      expect(chroma).toBeLessThanOrEqual(before[n] + 1)
    })
  })

  it('keeps output within valid byte range', () => {
    const data = flatImage(4, 4, 10, 250, 5)
    autoColor(data)
    for (const v of data) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(255)
    }
  })

  it('leaves a well-exposed balanced frame nearly unchanged when gated', () => {
    const w = 32
    const h = 32
    const src = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const v = 90 + Math.round((y / (h - 1)) * 80)
        src[i] = v
        src[i + 1] = v + 2
        src[i + 2] = v - 2
        src[i + 3] = 255
      }
    }
    const out = gatedAutoColor(src.slice(), w, h)
    let max = 0
    for (let i = 0; i < src.length; i++) {
      if (i % 4 === 3) continue
      max = Math.max(max, Math.abs(src[i] - out.data[i]))
    }
    expect(max).toBeLessThan(18)
  })
})
