/**
 * Scene-gated wrappers used by the AI worker. If a photo already looks
 * processed, return the original buffer and `skipped` instead of baking.
 */
import { autoColor, DEFAULT_AUTO_COLOR } from './auto-color'
import { denoise, faceEnhance } from './enhance'
import { skinMask } from './filters'
import { segmentHeuristic } from './background-removal'
import { upscaleBicubic, type UpscaleFactor } from './upscale'
import {
  applyBackgroundBlur,
  clarityEnhance,
  dehaze,
  lowLightEnhance,
  vibranceEnhance,
} from './local-enhance'
import {
  matteIsTrustworthy,
  sceneStats,
  shouldSkipAutoColor,
  shouldSkipClarity,
  shouldSkipDehaze,
  shouldSkipDenoise,
  shouldSkipFaceEnhance,
  shouldSkipLowLight,
  shouldSkipUpscale,
  shouldSkipVibrance,
  skinFraction,
} from './scene-gate'

export const AI_SKIPPED_MESSAGE = 'Already looks good — nothing applied'

export function aiSkipMessage(reason: unknown): string {
  if (reason === 'no-subject' || reason === 'no-background') {
    return "Couldn't find a person to keep sharp — nothing applied"
  }
  return AI_SKIPPED_MESSAGE
}

export interface GatedResult {
  data: Uint8ClampedArray
  width: number
  height: number
  skipped: boolean
  meta: Record<string, unknown>
}

function skip(data: Uint8ClampedArray, width: number, height: number, reason: string): GatedResult {
  return { data, width, height, skipped: true, meta: { skipped: true, reason } }
}

function pass(data: Uint8ClampedArray, width: number, height: number, extra: Record<string, unknown> = {}): GatedResult {
  return { data, width, height, skipped: false, meta: extra }
}

export function gatedAutoColor(data: Uint8ClampedArray, width: number, height: number): GatedResult {
  if (shouldSkipAutoColor(sceneStats(data, width, height))) return skip(data, width, height, 'scene')
  autoColor(data, DEFAULT_AUTO_COLOR)
  return pass(data, width, height)
}

export function gatedDenoise(data: Uint8ClampedArray, width: number, height: number, strength: number): GatedResult {
  if (shouldSkipDenoise(sceneStats(data, width, height))) return skip(data, width, height, 'noise')
  return pass(denoise(data, width, height, { strength }), width, height)
}

export function gatedLowLight(data: Uint8ClampedArray, width: number, height: number): GatedResult {
  if (shouldSkipLowLight(sceneStats(data, width, height))) return skip(data, width, height, 'exposure')
  return pass(lowLightEnhance(data, width, height), width, height)
}

export function gatedDehaze(data: Uint8ClampedArray, width: number, height: number): GatedResult {
  if (shouldSkipDehaze(sceneStats(data, width, height))) return skip(data, width, height, 'haze')
  return pass(dehaze(data, width, height), width, height)
}

export function gatedClarity(data: Uint8ClampedArray, width: number, height: number): GatedResult {
  if (shouldSkipClarity(sceneStats(data, width, height))) return skip(data, width, height, 'sharp')
  return pass(clarityEnhance(data, width, height), width, height)
}

export function gatedVibrance(data: Uint8ClampedArray, width: number, height: number): GatedResult {
  if (shouldSkipVibrance(sceneStats(data, width, height))) return skip(data, width, height, 'sat')
  return pass(vibranceEnhance(data, width, height), width, height)
}

export function gatedBackgroundRemove(data: Uint8ClampedArray, width: number, height: number): GatedResult {
  const matte = segmentHeuristic(data, width, height)
  if (!matteIsTrustworthy(matte, width, height)) return skip(data, width, height, 'matte')
  let cleared = 0
  for (let i = 0; i < matte.length; i++) {
    data[i * 4 + 3] = matte[i]
    if (matte[i] < 8) cleared++
  }
  return pass(data, width, height, { matte: true, clearedFraction: cleared / matte.length })
}

export function gatedBackgroundBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  strength = 0.78,
  mask?: Uint8ClampedArray,
): GatedResult {
  const out = applyBackgroundBlur(data, width, height, { strength, mask })
  if (out.skipped) {
    return skip(data, width, height, typeof out.reason === 'string' ? out.reason : 'no-subject')
  }
  return pass(out.data, width, height, { blur: true, reason: out.reason })
}

export function gatedFaceEnhance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  smoothing: number,
  clarity: number,
): GatedResult {
  const fraction = skinFraction(skinMask(data, width, height))
  if (shouldSkipFaceEnhance(fraction)) return skip(data, width, height, 'skin')
  return pass(
    faceEnhance(data, width, height, {
      smoothing: Math.min(smoothing, 22),
      clarity: Math.min(clarity, 14),
    }),
    width,
    height,
  )
}

export function gatedUpscale(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  factor: UpscaleFactor,
): GatedResult {
  if (shouldSkipUpscale(width, height)) return skip(data, width, height, 'resolution')
  const out = upscaleBicubic(data, width, height, factor)
  return pass(out.data, out.width, out.height)
}
