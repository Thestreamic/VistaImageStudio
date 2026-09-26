import { describe, it, expect } from 'vitest'

function hueDeg(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d < 1e-3) return 0
  let h = 0
  if (max === r) h = ((g - b) / d) % 6
  else if (max === g) h = (b - r) / d + 2
  else h = (r - g) / d + 4
  h *= 60
  if (h < 0) h += 360
  return h
}

function hueDelta(a: number, b: number): number {
  const d = Math.abs(a - b)
  return Math.min(d, 360 - d)
}
import { adjustmentsFromLook } from '@/features/editor/looks'
import { defaultAdjustments, isIdentityAdjustments } from '@/features/editor/types'
import { FILTER_PRESETS } from '@/features/editor/filter-presets'
import { CAMERA_PROFILES } from '@/features/editor/camera-profiles'
import { applyAdjustmentsToPixels } from '@/features/editor/engine/adjustments'

describe('looks', () => {
  it('intensity 0 is identity', () => {
    const warm = FILTER_PRESETS.find((p) => p.id === 'warm')!
    expect(isIdentityAdjustments(adjustmentsFromLook(warm.adjustments, 0))).toBe(true)
  })

  it('intensity 100 matches the preset numbers', () => {
    const cool = FILTER_PRESETS.find((p) => p.id === 'cool')!
    const full = adjustmentsFromLook(cool.adjustments, 100)
    expect(full.temperature).toBe(cool.adjustments.temperature)
  })

  it('keeps only Original, B&W, Warm, Cool and names Optimize Image', () => {
    expect(FILTER_PRESETS.map((p) => p.id)).toEqual(['original', 'bw', 'warm', 'cool'])
    expect(FILTER_PRESETS.some((p) => ['vivid', 'fade', 'dramatic', 'vintage', 'cinematic', 'punch'].includes(p.id))).toBe(false)
    expect(CAMERA_PROFILES.find((p) => p.id === 'pro-phone')?.label).toBe('Optimize Image')
  })

  it('halfway intensity is between identity and full', () => {
    const mid = adjustmentsFromLook({ brightness: 20 }, 50)
    expect(mid.brightness).toBeCloseTo(10)
    expect(defaultAdjustments().brightness).toBe(0)
  })

  it('Natural Color is a restrained iPhone-like grade, not a yellow punch', () => {
    const natural = CAMERA_PROFILES.find((p) => p.id === 'natural-mobile')!
    const adj = natural.adjustments
    expect(adj.temperature ?? 0).toBeLessThanOrEqual(2)
    expect(adj.saturation ?? 0).toBeLessThanOrEqual(0)
    expect(adj.vibrance ?? 0).toBeLessThanOrEqual(8)
    expect(adj.highlights ?? 0).toBeLessThan(0)
    const high = adj.curves?.rgb.find((p) => p.x >= 192)
    expect(high).toBeTruthy()
    expect(high!.y).toBeLessThanOrEqual(high!.x)
  })

  it('Natural Color keeps a gold sun disk from going mustard', () => {
    const natural = CAMERA_PROFILES.find((p) => p.id === 'natural-mobile')!
    const src = new Uint8ClampedArray([252, 228, 168, 255])
    const out = applyAdjustmentsToPixels(src.slice(), adjustmentsFromLook(natural.adjustments, 100), 1, 1)
    expect(out[0] - out[2]).toBeLessThanOrEqual(src[0] - src[2] + 4)
    expect(out[2]).toBeGreaterThan(150)
  })

  it('does not crush mid-shadow greys into near-black on one-click looks', () => {
    const looks = FILTER_PRESETS.filter((p) => p.id !== 'original')
    for (const preset of looks) {
      const adj = adjustmentsFromLook(preset.adjustments, 100)
      const at70 = applyAdjustmentsToPixels(new Uint8ClampedArray([70, 70, 70, 255]), adj, 1, 1)
      const y70 = 0.2126 * at70[0] + 0.7152 * at70[1] + 0.0722 * at70[2]
      expect(y70, `${preset.id} at i=70`).toBeGreaterThanOrEqual(32)
    }
  })

  it('Optimize Image keeps color calm and does not jump a near-clipped red hue', () => {
    const pro = CAMERA_PROFILES.find((p) => p.id === 'pro-phone')!
    expect(pro.adjustments.temperature ?? 0).toBe(0)
    expect(pro.adjustments.tint ?? 0).toBe(0)
    expect(pro.adjustments.vibrance ?? 0).toBeLessThanOrEqual(8)
    expect(pro.adjustments.saturation ?? 0).toBe(0)
    const src = new Uint8ClampedArray([250, 40, 30, 255])
    const out = applyAdjustmentsToPixels(src.slice(), adjustmentsFromLook(pro.adjustments, 100), 1, 1)
    expect(out[0]).toBeGreaterThan(out[1])
    expect(out[0]).toBeGreaterThan(out[2])
    expect(hueDelta(hueDeg(src[0], src[1], src[2]), hueDeg(out[0], out[1], out[2]))).toBeLessThan(12)
  })

  it('Optimize Image does not yellow a neutral white', () => {
    const pro = CAMERA_PROFILES.find((p) => p.id === 'pro-phone')!
    const src = new Uint8ClampedArray([238, 234, 234, 255])
    const out = applyAdjustmentsToPixels(src.slice(), adjustmentsFromLook(pro.adjustments, 100), 1, 1)
    expect(out[0] - out[2]).toBeLessThanOrEqual(src[0] - src[2] + 2)
  })

  it('shrinks vibrance at the gamut edge so a clipped channel does not shift hue', () => {
    const src = new Uint8ClampedArray([254, 200, 180, 255])
    const adj = defaultAdjustments()
    adj.vibrance = 100
    const out = applyAdjustmentsToPixels(src.slice(), adj, 1, 1)
    expect(hueDelta(hueDeg(src[0], src[1], src[2]), hueDeg(out[0], out[1], out[2]))).toBeLessThan(3)
    expect(Math.max(out[0], out[1], out[2])).toBeLessThanOrEqual(255)
  })

  it('leaves an in-range vibrance pixel on the unclamped scale', () => {
    const r = 80
    const g = 90
    const b = 100
    const vib = 40
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    const boost = 1 + (vib / 100) * 0.9 * (1 - chroma / 255)
    const expected = [y + (r - y) * boost, y + (g - y) * boost, y + (b - y) * boost]
    const adj = defaultAdjustments()
    adj.vibrance = vib
    const out = applyAdjustmentsToPixels(new Uint8ClampedArray([r, g, b, 255]), adj, 1, 1)
    expect(out[0]).toBe(Math.round(expected[0]))
    expect(out[1]).toBe(Math.round(expected[1]))
    expect(out[2]).toBe(Math.round(expected[2]))
  })

  it('Warm, Cool and B&W grade a sample pixel differently', () => {
    const ids = ['warm', 'cool', 'bw'] as const
    const src = new Uint8ClampedArray([180, 140, 120, 255])
    const outs = ids.map((id) => {
      const preset = FILTER_PRESETS.find((p) => p.id === id)!
      return applyAdjustmentsToPixels(src.slice(), adjustmentsFromLook(preset.adjustments, 100), 1, 1)
    })
    for (let i = 0; i < outs.length; i++) {
      for (let j = i + 1; j < outs.length; j++) {
        const d =
          Math.abs(outs[i][0] - outs[j][0]) +
          Math.abs(outs[i][1] - outs[j][1]) +
          Math.abs(outs[i][2] - outs[j][2])
        expect(d, `${ids[i]} vs ${ids[j]}`).toBeGreaterThan(12)
      }
    }
  })
})
