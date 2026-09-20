import { describe, it, expect } from 'vitest'
import { applyAdjustmentsToPixels, buildAdjustmentLuts } from '@/features/editor/engine/adjustments'
import { defaultAdjustments, isIdentityAdjustments } from '@/features/editor/types'

describe('adjustments', () => {
  it('default adjustments are identity', () => {
    expect(isIdentityAdjustments(defaultAdjustments())).toBe(true)
  })

  it('identity adjustments produce identity LUTs', () => {
    const luts = buildAdjustmentLuts(defaultAdjustments())
    expect(luts.r[128]).toBe(128)
    expect(luts.g[0]).toBe(0)
    expect(luts.b[255]).toBe(255)
  })

  it('positive brightness raises mid-tones', () => {
    const a = { ...defaultAdjustments(), brightness: 50 }
    const luts = buildAdjustmentLuts(a)
    expect(luts.r[128]).toBeGreaterThan(128)
  })

  it('negative contrast compresses the range toward mid-grey', () => {
    const a = { ...defaultAdjustments(), contrast: -80 }
    const luts = buildAdjustmentLuts(a)
    expect(luts.r[255] - luts.r[0]).toBeLessThan(255)
  })

  it('positive tint boosts green relative to red', () => {
    const a = { ...defaultAdjustments(), tint: 80 }
    const luts = buildAdjustmentLuts(a)
    expect(luts.g[128]).toBeGreaterThan(luts.r[128])
  })

  it('positive shadows lifts low values', () => {
    const a = { ...defaultAdjustments(), shadows: 80 }
    const luts = buildAdjustmentLuts(a)
    expect(luts.r[32]).toBeGreaterThan(32)
  })

  it('positive temperature warms (boosts red, cuts blue) relative to green', () => {
    const a = { ...defaultAdjustments(), temperature: 60 }
    const luts = buildAdjustmentLuts(a)
    expect(luts.r[128]).toBeGreaterThan(luts.g[128])
    expect(luts.b[128]).toBeLessThan(luts.g[128])
  })

  it('positive saturation boosts sky chroma more than skin chroma', () => {
    const a = { ...defaultAdjustments(), saturation: 35 }
    const skin = new Uint8ClampedArray([210, 160, 130, 255])
    const sky = new Uint8ClampedArray([90, 140, 210, 255])
    const skinOut = applyAdjustmentsToPixels(skin.slice(), a, 1, 1)
    const skyOut = applyAdjustmentsToPixels(sky.slice(), a, 1, 1)
    const chroma = (p: Uint8ClampedArray) => Math.max(p[0], p[1], p[2]) - Math.min(p[0], p[1], p[2])
    expect(chroma(skinOut) - chroma(skin)).toBeLessThan(chroma(skyOut) - chroma(sky))
    expect((skinOut[0] - skinOut[2]) - (skin[0] - skin[2])).toBeLessThan(18)
  })

  it('full desaturation still greys skin', () => {
    const a = { ...defaultAdjustments(), saturation: -100 }
    const skin = new Uint8ClampedArray([210, 160, 130, 255])
    const out = applyAdjustmentsToPixels(skin.slice(), a, 1, 1)
    expect(Math.abs(out[0] - out[1]) + Math.abs(out[1] - out[2])).toBeLessThan(4)
  })
})
