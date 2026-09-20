import { describe, it, expect } from 'vitest'
import { denoise, sharpen } from '@/features/ai/algorithms/enhance'

function noisyImage(w: number, h: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4)
  let seed = 42
  const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  for (let i = 0; i < data.length; i += 4) {
    const base = 128
    const noise = (rand() - 0.5) * 80
    data[i] = data[i + 1] = data[i + 2] = base + noise
    data[i + 3] = 255
  }
  return data
}

describe('denoise', () => {
  it('strength=0 is a no-op', () => {
    const data = noisyImage(16, 16)
    const copy = data.slice()
    const out = denoise(data, 16, 16, { strength: 0 })
    expect(out).toEqual(copy)
  })

  it('reduces pixel-to-pixel variance', () => {
    const data = noisyImage(24, 24)
    const variance = (buf: Uint8ClampedArray) => {
      let sum = 0, sumSq = 0, n = 0
      for (let i = 0; i < buf.length; i += 4) { sum += buf[i]; sumSq += buf[i] ** 2; n++ }
      const mean = sum / n
      return sumSq / n - mean ** 2
    }
    const before = variance(data)
    const out = denoise(data.slice(), 24, 24, { strength: 80 })
    expect(variance(out)).toBeLessThan(before)
  })
})

describe('sharpen', () => {
  it('preserves buffer length and byte range', () => {
    const data = noisyImage(12, 12)
    const out = sharpen(data, 12, 12, { radius: 1, amount: 0.5 })
    expect(out.length).toBe(data.length)
    for (const v of out) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(255) }
  })
})
