import type { CropRect } from './types'

export interface CropPreset {
  id: string
  label: string
  /** Width / height. Null means free/custom. */
  ratio: number | null
}

/** Social crop chips used by Transform, commands, and recipes. */
export const CROP_PRESETS: CropPreset[] = [
  { id: 'free', label: 'Free', ratio: null },
  { id: '1:1', label: '1:1 Post', ratio: 1 },
  { id: '4:5', label: '4:5 Portrait', ratio: 4 / 5 },
  { id: '9:16', label: '9:16 Story', ratio: 9 / 16 },
  { id: '16:9', label: '16:9 Thumb', ratio: 16 / 9 },
]

/** Story / Reel / TikTok UI chrome as fractions of the frame. */
export const SAFE_ZONE_FRACTIONS = {
  top: 0.14,
  bottom: 0.22,
  right: 0.18,
} as const

export function storySafeZones(width: number, height: number) {
  return {
    top: height * SAFE_ZONE_FRACTIONS.top,
    bottom: height * SAFE_ZONE_FRACTIONS.bottom,
    right: width * SAFE_ZONE_FRACTIONS.right,
  }
}

/**
 * Largest centered crop of `ratio` (width/height) that fits inside the document.
 */
export function cropRectForRatio(docW: number, docH: number, ratio: number): CropRect {
  let width = docW
  let height = width / ratio
  if (height > docH) {
    height = docH
    width = height * ratio
  }
  return {
    x: (docW - width) / 2,
    y: (docH - height) / 2,
    width,
    height,
  }
}

export function cropRectForPreset(docW: number, docH: number, presetId: string): CropRect {
  const preset = CROP_PRESETS.find((p) => p.id === presetId)
  if (!preset || preset.ratio == null) {
    return { x: docW * 0.1, y: docH * 0.1, width: docW * 0.8, height: docH * 0.8 }
  }
  return cropRectForRatio(docW, docH, preset.ratio)
}

export function cropRectForCustom(docW: number, docH: number, rw: number, rh: number): CropRect {
  const ratio = rw > 0 && rh > 0 ? rw / rh : 1
  return cropRectForRatio(docW, docH, ratio)
}

export function clampCrop(rect: CropRect, docW: number, docH: number, ratio?: number | null): CropRect {
  let { x, y, width, height } = rect
  width = Math.max(8, Math.min(width, docW))
  height = Math.max(8, Math.min(height, docH))
  if (ratio && ratio > 0) {
    if (width / height > ratio) width = height * ratio
    else height = width / ratio
    width = Math.min(width, docW)
    height = Math.min(height, docH)
    if (width / height > ratio) width = height * ratio
    else height = width / ratio
  }
  x = Math.max(0, Math.min(x, docW - width))
  y = Math.max(0, Math.min(y, docH - height))
  return { x, y, width, height }
}
