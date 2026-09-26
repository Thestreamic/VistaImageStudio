import type { Adjustments } from '../types'
import { isIdentityAdjustments } from '../types'
import { curveToLut, isIdentityCurve } from './curves'

/**
 * Builds a per-channel LUT that folds exposure, brightness, contrast,
 * temperature, tint, tone (highlights/shadows/whites/blacks) and curves
 * into a single 256-entry table per channel.
 * Saturation and vibrance need neighbouring channels, so they run per pixel.
 */
export function buildAdjustmentLuts(a: Adjustments): {
  r: Uint8ClampedArray
  g: Uint8ClampedArray
  b: Uint8ClampedArray
} {
  const exposureGain = Math.pow(2, a.exposure)
  const brightnessOffset = (a.brightness / 100) * 128
  const c = a.contrast / 100
  const contrastFactor = c >= 0 ? 1 + c * 2 : 1 + c
  const tempShift = (a.temperature / 100) * 40
  const tintShift = (a.tint / 100) * 30
  const shadows = a.shadows / 100
  const highlights = a.highlights / 100
  const whites = a.whites / 100
  const blacks = a.blacks / 100

  const base = new Float32Array(256)
  for (let i = 0; i < 256; i++) {
    let v = i * exposureGain
    v = (v - 128) * contrastFactor + 128
    v += brightnessOffset
    const t = i / 255
    v += shadows * 50 * (1 - t) * (1 - t)
    v += highlights * 50 * t * t
    v += blacks * 30 * (1 - t)
    v += whites * 30 * t
    base[i] = v
  }

  const rgbLut = isIdentityCurve(a.curves.rgb) ? null : curveToLut(a.curves.rgb)
  const perChannel = {
    r: isIdentityCurve(a.curves.r) ? null : curveToLut(a.curves.r),
    g: isIdentityCurve(a.curves.g) ? null : curveToLut(a.curves.g),
    b: isIdentityCurve(a.curves.b) ? null : curveToLut(a.curves.b),
  }

  const make = (
    channelCurve: Uint8ClampedArray | null,
    shift: number,
  ): Uint8ClampedArray => {
    const lut = new Uint8ClampedArray(256)
    for (let i = 0; i < 256; i++) {
      let v = base[i] + shift
      v = v < 0 ? 0 : v > 255 ? 255 : v
      if (rgbLut) v = rgbLut[Math.round(v)]
      if (channelCurve) v = channelCurve[Math.round(v)]
      lut[i] = v
    }
    return lut
  }

  return {
    r: make(perChannel.r, tempShift - tintShift * 0.35),
    g: make(perChannel.g, tintShift),
    b: make(perChannel.b, -tempShift - tintShift * 0.35),
  }
}

function applySharpness(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
) {
  if (!amount) return
  const src = new Uint8ClampedArray(data)
  const k = amount / 100
  const cap = 28
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = (y * width + x) * 4
      for (let c = 0; c < 3; c++) {
        let blur = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            blur += src[((y + dy) * width + (x + dx)) * 4 + c]
          }
        }
        blur /= 9
        const highpass = src[i + c] - blur
        const limited = highpass < -cap ? -cap : highpass > cap ? cap : highpass
        const edgeEase = 1 - smoothstep(20, 60, Math.abs(highpass))
        const v = src[i + c] + k * edgeEase * limited
        data[i + c] = v < 0 ? 0 : v > 255 ? 255 : v
      }
    }
  }
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0)
        break
      case g:
        h = (b - r) / d + 2
        break
      default:
        h = (r - g) / d + 4
        break
    }
    h *= 60
  }
  return [h, s, l]
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = l * 255
    return [v, v, v]
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const hk = h / 360
  return [
    hue2rgb(p, q, hk + 1 / 3) * 255,
    hue2rgb(p, q, hk) * 255,
    hue2rgb(p, q, hk - 1 / 3) * 255,
  ]
}

/**
 * Positive saturation with reduced strength in the skin-tone hue range
 * so global boosts don't push faces orange/red. Desaturation is not
 * attenuated (B&W must still grey skin).
 */
function applySkinSafeSaturation(
  r: number,
  g: number,
  b: number,
  saturationAmount: number,
): [number, number, number] {
  const [h, s, l] = rgbToHsl(r, g, b)
  const skinHueCenter = 25
  const skinHueWidth = 30
  const hueDist = Math.min(Math.abs(h - skinHueCenter), 360 - Math.abs(h - skinHueCenter))
  // 0 in the skin band, 1 outside — full sat on sky, 35% on faces.
  const skinProtection = smoothstep(0, skinHueWidth, hueDist)
  const protectedFactor = 0.35
  const effectiveAmount = saturationAmount * (protectedFactor + (1 - protectedFactor) * skinProtection)
  const newS = Math.max(0, Math.min(1, s * (1 + effectiveAmount / 100)))
  return hslToRgb(h, newS, l)
}

/**
 * Vibrance scale that shrinks only when a channel would leave 0–255.
 * The extreme channel lands on the gamut edge; hue and the other two
 * channels stay in proportion. In-range pixels are unchanged.
 */
function applyHueSafeVibrance(r: number, g: number, b: number, vib: number): [number, number, number] {
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
  const chroma = Math.max(r, g, b) - Math.min(r, g, b)
  const mute = 1 - chroma / 255
  const boost = 1 + vib * 0.9 * mute
  let nr = y + (r - y) * boost
  let ng = y + (g - y) * boost
  let nb = y + (b - y) * boost
  const hi = Math.max(nr, ng, nb)
  const lo = Math.min(nr, ng, nb)
  if (hi <= 255 && lo >= 0) return [nr, ng, nb]
  let scale = 1
  if (hi > 255 && hi > y) scale = Math.min(scale, (255 - y) / (hi - y))
  if (lo < 0 && lo < y) scale = Math.min(scale, (0 - y) / (lo - y))
  if (!(scale >= 0)) scale = 0
  nr = y + (nr - y) * scale
  ng = y + (ng - y) * scale
  nb = y + (nb - y) * scale
  return [nr, ng, nb]
}

/**
 * Applies adjustments to RGBA pixel data in place. Pure and synchronous so it
 * can run in a worker or in unit tests without a DOM.
 */
export function applyAdjustmentsToPixels(
  data: Uint8ClampedArray,
  a: Adjustments,
  width?: number,
  height?: number,
): Uint8ClampedArray {
  if (isIdentityAdjustments(a)) return data
  const { r: lr, g: lg, b: lb } = buildAdjustmentLuts(a)
  const satBoost = a.saturation > 0
  const satCut = a.saturation < 0
  const sat = 1 + a.saturation / 100
  const vib = a.vibrance / 100
  const applyVib = a.vibrance !== 0

  for (let i = 0; i < data.length; i += 4) {
    let r = lr[data[i]]
    let g = lg[data[i + 1]]
    let b = lb[data[i + 2]]
    if (satBoost) {
      const next = applySkinSafeSaturation(r, g, b, a.saturation)
      r = next[0]
      g = next[1]
      b = next[2]
    } else if (satCut) {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
      r = l + (r - l) * sat
      g = l + (g - l) * sat
      b = l + (b - l) * sat
    }
    if (applyVib) {
      const next = applyHueSafeVibrance(r, g, b, vib)
      r = next[0]
      g = next[1]
      b = next[2]
    }
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }

  if (a.sharpness && width && height) applySharpness(data, width, height, a.sharpness)
  return data
}

/** Stable string key so render caches know when adjustments changed. */
export function adjustmentsKey(a: Adjustments): string {
  return JSON.stringify(a)
}
