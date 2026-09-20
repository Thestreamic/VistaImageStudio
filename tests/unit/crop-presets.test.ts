import { describe, it, expect } from 'vitest'
import { clampCrop, cropRectForCustom, cropRectForPreset, CROP_PRESETS, storySafeZones } from '@/features/editor/crop-presets'

describe('crop presets', () => {
  it('includes social ratios', () => {
    expect(CROP_PRESETS.map((p) => p.id)).toEqual(expect.arrayContaining(['1:1', '4:5', '9:16', '16:9']))
  })

  it('clamps a crop inside the document', () => {
    const c = clampCrop({ x: -20, y: -5, width: 4000, height: 4000 }, 100, 80)
    expect(c.x).toBeGreaterThanOrEqual(0)
    expect(c.y).toBeGreaterThanOrEqual(0)
    expect(c.x + c.width).toBeLessThanOrEqual(100)
    expect(c.y + c.height).toBeLessThanOrEqual(80)
  })

  it('builds a 4:5 custom crop', () => {
    const c = cropRectForCustom(1350, 1080, 4, 5)
    expect(c.width / c.height).toBeCloseTo(0.8, 5)
  })

  it('maps preset ids', () => {
    const c = cropRectForPreset(1080, 1920, '1:1')
    expect(c.width).toBeCloseTo(c.height, 5)
  })

  it('keeps story chrome inside the frame', () => {
    const z = storySafeZones(1080, 1920)
    expect(z.top + z.bottom).toBeLessThan(1920)
  })
})
