import { bilateralFilter, skinMask, unsharpMask } from './filters'

export interface DenoiseParams {
  strength: number // 0..100
}

/** Edge-preserving denoise: bilateral pass sized by strength, then a light re-sharpen. */
export function denoise(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  { strength }: DenoiseParams,
): Uint8ClampedArray {
  const s = Math.max(0, Math.min(100, strength)) / 100
  if (s === 0) return data
  const radius = 1 + Math.round(s * 3)
  const sigmaColor = 8 + s * 40
  const smooth = bilateralFilter(data, width, height, radius, sigmaColor)
  // Recover a little micro-contrast so the result does not look waxy.
  return unsharpMask(smooth, width, height, 1, 0.25 * s, 6)
}

export interface SharpenParams {
  radius: number
  amount: number
}

/** Post-resample sharpening used by the upscaler. */
export function sharpen(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  { radius, amount }: SharpenParams,
): Uint8ClampedArray {
  return unsharpMask(data, width, height, radius, amount, 3)
}

export interface FaceEnhanceParams {
  smoothing: number // 0..100
  clarity: number // 0..100
}

/**
 * Portrait retouch: detects skin via YCbCr, applies a bilateral smooth only
 * inside the skin mask (so eyes, hair and clothing stay sharp), then adds
 * clarity to non-skin regions and a subtle warm lift to skin.
 */
export function faceEnhance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  { smoothing, clarity }: FaceEnhanceParams,
): Uint8ClampedArray {
  const skin = skinMask(data, width, height)
  const sm = smoothing / 100
  const cl = clarity / 100

  let out = data
  if (sm > 0) {
    out = bilateralFilter(out, width, height, 2 + Math.round(sm * 2), 14 + sm * 30, skin)
  }
  if (cl > 0) {
    const sharp = unsharpMask(out, width, height, 2, 0.6 * cl, 4)
    for (let p = 0, i = 0; p < skin.length; p++, i += 4) {
      const k = 1 - skin[p] / 255
      out[i] = out[i] + (sharp[i] - out[i]) * k
      out[i + 1] = out[i + 1] + (sharp[i + 1] - out[i + 1]) * k
      out[i + 2] = out[i + 2] + (sharp[i + 2] - out[i + 2]) * k
    }
  }
  // Warm lift on skin: +red/+green a touch, slight luminance bump.
  for (let p = 0, i = 0; p < skin.length; p++, i += 4) {
    const k = (skin[p] / 255) * sm
    if (!k) continue
    out[i] = Math.min(255, out[i] + 4 * k)
    out[i + 1] = Math.min(255, out[i + 1] + 2 * k)
  }
  return out
}
