import { describe, it, expect } from 'vitest'
import { recipeFromCurrent, validateRecipe } from '@/features/editor/recipes/schema'
import { formatExportName, estimateExportBytes } from '@/features/editor/export-kit'
import { watermarkDest } from '@/features/editor/engine/compositor'
import { defaultAdjustments, defaultWatermark } from '@/features/editor/types'

describe('recipes and export extras', () => {
  it('validates a local recipe and rejects remote junk', () => {
    const recipe = recipeFromCurrent({ name: 'IG pack', cropPresetId: '4:5', lookId: 'warm', exportPresetId: 'ig-portrait' })
    expect(validateRecipe(recipe)?.name).toBe('IG pack')
    expect(validateRecipe({ kind: 'lumen-recipe', id: 'x', name: 'bad', lookId: 'not-a-look' })).toBeNull()
  })

  it('formats export names and estimates size', () => {
    expect(formatExportName('{name}-{preset}-{date}', { name: 'shot', preset: 'ig-post', date: '2026-09-15' })).toBe(
      'shot-ig-post-2026-09-15',
    )
    expect(estimateExportBytes(1080, 1080, 'jpeg', 90)).toBeGreaterThan(1000)
  })

  it('places a BR watermark in the crop frame', () => {
    const doc = {
      id: 'd',
      createdAt: '',
      modifiedAt: '',
      width: 200,
      height: 100,
      layers: [],
      activeLayerId: null,
      selection: null,
      fileName: 'x',
      projectPath: null,
      crop: { x: 10, y: 10, width: 80, height: 80 },
      lookId: null,
      lookIntensity: 100,
      lastExport: null,
    }
    const layer = {
      id: 'w',
      name: 'Logo',
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal' as const,
      kind: 'watermark' as const,
      source: { width: 40, height: 20 } as HTMLCanvasElement,
      x: 0,
      y: 0,
      adjustments: defaultAdjustments(),
      watermark: defaultWatermark({ corner: 'br', scale: 0.2, margin: 4 }),
    }
    const dest = watermarkDest(doc, layer)
    expect(dest.x + dest.w).toBeLessThanOrEqual(10 + 80)
    expect(dest.y + dest.h).toBeLessThanOrEqual(10 + 80)
  })
})
