import type { Adjustments, Curves } from './types'
import { DEFAULT_CURVES } from './types'

export interface FilterPreset {
  id: string
  label: string
  aliases?: string[]
  /** CSS filter approximating the look, used only for the button's own thumbnail. */
  cssPreview: string
  adjustments: Partial<Adjustments>
}

function sCurve(lift: number, gain: number): Curves {
  const rgb = [
    { x: 0, y: Math.round(lift) },
    { x: 96, y: Math.max(0, 96 - gain) },
    { x: 160, y: Math.min(255, 160 + gain) },
    { x: 255, y: 255 - Math.round(lift * 0.4) },
  ]
  return { ...structuredClone(DEFAULT_CURVES), rgb }
}

/**
 * One-click looks — each is a pre-baked combination of adjustment sliders
 * and a tone curve. Intensity (0–100) interpolates toward identity.
 */
export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'original',
    label: 'Original',
    cssPreview: 'none',
    adjustments: {},
  },
  {
    id: 'bw',
    label: 'B&W',
    cssPreview: 'grayscale(1) contrast(1.06)',
    adjustments: { saturation: -100, contrast: 10, shadows: 10, curves: sCurve(2, 8) },
  },
  {
    id: 'warm',
    label: 'Warm',
    cssPreview: 'sepia(0.2) saturate(1.1)',
    adjustments: { temperature: 28, saturation: 10, brightness: 4, shadows: 6 },
  },
  {
    id: 'cool',
    label: 'Cool',
    cssPreview: 'hue-rotate(-6deg) saturate(1.06)',
    adjustments: { temperature: -24, saturation: 6, contrast: 5, shadows: 6 },
  },
]
