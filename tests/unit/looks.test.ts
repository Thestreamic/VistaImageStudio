import { describe, it, expect } from 'vitest'
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
