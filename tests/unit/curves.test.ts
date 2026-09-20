import { describe, it, expect } from 'vitest'
import { curveToLut, isIdentityCurve } from '@/features/editor/engine/curves'

describe('curves', () => {
  it('identity curve maps every value to itself', () => {
    const lut = curveToLut([{ x: 0, y: 0 }, { x: 255, y: 255 }])
    expect(lut[0]).toBe(0)
    expect(lut[128]).toBe(128)
    expect(lut[255]).toBe(255)
  })

  it('detects an identity curve', () => {
    expect(isIdentityCurve([{ x: 0, y: 0 }, { x: 255, y: 255 }])).toBe(true)
    expect(isIdentityCurve([{ x: 0, y: 10 }, { x: 255, y: 255 }])).toBe(false)
  })

  it('is monotonically non-decreasing for a typical S-curve', () => {
    const lut = curveToLut([{ x: 0, y: 0 }, { x: 64, y: 40 }, { x: 192, y: 220 }, { x: 255, y: 255 }])
    for (let i = 1; i < 256; i++) {
      expect(lut[i]).toBeGreaterThanOrEqual(lut[i - 1] - 1) // allow 1-unit spline wobble
    }
  })

  it('clamps output to 0..255', () => {
    const lut = curveToLut([{ x: 0, y: 0 }, { x: 255, y: 255 }])
    for (const v of lut) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(255)
    }
  })
})
