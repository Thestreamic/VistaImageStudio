import { describe, it, expect } from 'vitest'
import { upscaleBicubic } from '@/features/ai/algorithms/upscale'

describe('upscaleBicubic', () => {
  it('scales dimensions by the requested factor', () => {
    const w = 10, h = 8
    const data = new Uint8ClampedArray(w * h * 4).fill(128)
    const result = upscaleBicubic(data, w, h, 2)
    expect(result.width).toBe(w * 2)
    expect(result.height).toBe(h * 2)
    expect(result.data.length).toBe(w * 2 * h * 2 * 4)
  })

  it('keeps a flat image approximately flat after upscale', () => {
    const w = 6, h = 6
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < data.length; i += 4) { data[i] = 100; data[i + 1] = 150; data[i + 2] = 200; data[i + 3] = 255 }
    const result = upscaleBicubic(data, w, h, 2)
    const mid = Math.floor(result.data.length / 2 / 4) * 4
    expect(result.data[mid]).toBeGreaterThan(70)
    expect(result.data[mid]).toBeLessThan(130)
  })
})
