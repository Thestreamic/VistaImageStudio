import type { Adjustments, Curves } from './types'
import { DEFAULT_CURVES } from './types'

export interface CameraProfile {
  id: string
  label: string
  /** Short hint under the look tile / auto button. */
  hint?: string
  match: RegExp
  adjustments: Partial<Adjustments>
}

function curve(points: Array<[number, number]>): Curves {
  return { ...structuredClone(DEFAULT_CURVES), rgb: points.map(([x, y]) => ({ x, y })) }
}

/**
 * Flagship Pro Phone grade — tuned to the computational look people expect from
 * recent Pro-class phone cameras (open shadows, controlled highlights, warm-
 * neutral skin, crisp micro-contrast, restrained saturation + strong vibrance).
 * Descriptive style name; not an Apple product or partnership.
 */
export const PRO_PHONE_LOOK_ID = 'pro-phone'

export const PRO_PHONE_ADJUSTMENTS: Partial<Adjustments> = {
  // Photonic Engine-ish exposure + tone
  exposure: 0.1,
  brightness: 5,
  contrast: 11,
  // Smart HDR: open shadows, tame highlights, keep whites from clipping
  highlights: -22,
  shadows: 26,
  whites: -10,
  blacks: 10,
  // Warm-neutral skin, tiny magenta for healthy skin (not green cast)
  temperature: 7,
  tint: -3,
  // Color: keep saturation calm, push vibrance (muted greens/blues pop, skin safer)
  saturation: 7,
  vibrance: 32,
  // Edge crispness without crunchy oversharpen
  sharpness: 24,
  // Tone curve: lifted floor, gentle S, soft roll-off on the top
  curves: curve([
    [0, 8],
    [40, 42],
    [96, 98],
    [160, 168],
    [210, 214],
    [255, 250],
  ]),
}

/**
 * Mobile-inspired color grades with neutral names. Matcher covers common phrasing
 * (iphone / galaxy / pixel / auto optimize) via `match`.
 */
export const CAMERA_PROFILES: CameraProfile[] = [
  {
    id: PRO_PHONE_LOOK_ID,
    label: 'Optimize Image',
    hint: 'One-click tone, color, clarity',
    // Prefer this for auto-optimize and any Pro / 17 / 18 phrasing.
    match:
      /\boptimize image\b|\bauto[- ]?optim|\biphone\s*(1[78]|18|17)?(\s*pro)?\b|\bpro[- ]?phone\b|\bmake (it|this|the )?(photo|image|pic|shot)?\s*(look )?like (an? )?iphone\b|\biphone[- ]style\b/i,
    adjustments: PRO_PHONE_ADJUSTMENTS,
  },
  {
    id: 'natural-mobile',
    label: 'Natural Color',
    hint: 'iPhone-like true-to-life — sun stays white-gold, not mustard',
    match: /\bnatural[- ]?(color|colour|look|mobile)\b|\boptimize for natural\b/i,
    adjustments: {
      // iPhone 17 Standard/Natural: Smart HDR recovers the sun instead of
      // cooking it yellow. Keep global sat/temp almost neutral; only lift
      // muted foliage via a little vibrance (high-chroma sun is left alone).
      exposure: 0.04,
      brightness: 2,
      contrast: 5,
      highlights: -20,
      shadows: 14,
      whites: -10,
      blacks: 4,
      temperature: 0,
      tint: -1,
      saturation: -2,
      vibrance: 6,
      sharpness: 8,
      curves: curve([
        [0, 6],
        [48, 50],
        [128, 128],
        [200, 194],
        [255, 248],
      ]),
    },
  },
  {
    id: 'vivid-mobile',
    label: 'Vivid Mobile',
    match: /\bsamsung\b|\bgalaxy\b|\bvivid mobile\b/i,
    adjustments: {
      temperature: -10,
      contrast: 26,
      saturation: 30,
      exposure: 0.05,
      vibrance: 18,
      sharpness: 14,
      curves: curve([
        [0, 0],
        [64, 44],
        [128, 132],
        [192, 214],
        [255, 255],
      ]),
    },
  },
  {
    id: 'clean-portrait',
    label: 'Clean Portrait',
    match: /\bpixel\b|\bclean portrait\b/i,
    adjustments: {
      temperature: -4,
      contrast: 18,
      saturation: 10,
      exposure: 0.02,
      vibrance: 14,
      sharpness: 12,
      curves: curve([
        [0, 14],
        [64, 60],
        [128, 128],
        [192, 196],
        [255, 248],
      ]),
    },
  },
]

export function getProPhoneProfile(): CameraProfile {
  return CAMERA_PROFILES.find((p) => p.id === PRO_PHONE_LOOK_ID)!
}
