import { describe, it, expect } from 'vitest'
import {
  CREATOR_PACK_IDS,
  cropRectForRatio,
  presetsByIds,
  resolveExportFitMode,
  storySafeZones,
} from '@/features/editor/export-kit'

describe('creator export kit', () => {
  it('selects the Instagram / YouTube / Pinterest pack', () => {
    const pack = presetsByIds(CREATOR_PACK_IDS)
    expect(pack.map((p) => p.id)).toEqual([...CREATOR_PACK_IDS])
    expect(pack.every((p) => p.width && p.height)).toBe(true)
  })

  it('squeezes YouTube thumbnails instead of cropping top and bottom', () => {
    expect(resolveExportFitMode('yt-thumb', 'fill')).toBe('stretch')
    expect(resolveExportFitMode('yt-thumb', 'fit')).toBe('fit')
    expect(resolveExportFitMode('ig-post', 'fill')).toBe('fill')
    expect(resolveExportFitMode('ig-story', 'fill')).toBe('fill')
  })

  it('fits a 4:5 crop inside a landscape document', () => {
    const crop = cropRectForRatio(1350, 1080, 4 / 5)
    expect(crop.width / crop.height).toBeCloseTo(0.8, 5)
    expect(crop.x + crop.width).toBeLessThanOrEqual(1350 + 0.01)
    expect(crop.y + crop.height).toBeLessThanOrEqual(1080 + 0.01)
  })

  it('keeps story chrome inside the frame', () => {
    const z = storySafeZones(1080, 1920)
    expect(z.top + z.bottom).toBeLessThan(1920)
    expect(z.right).toBeLessThan(1080)
  })
})
