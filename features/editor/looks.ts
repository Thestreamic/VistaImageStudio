import type { Adjustments, CurvePoint, Curves } from './types'
import { DEFAULT_CURVES, defaultAdjustments } from './types'

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function mixPoints(from: CurvePoint[], to: CurvePoint[], t: number): CurvePoint[] {
  const n = Math.max(from.length, to.length)
  const out: CurvePoint[] = []
  for (let i = 0; i < n; i++) {
    const a = from[Math.min(i, from.length - 1)]
    const b = to[Math.min(i, to.length - 1)]
    out.push({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) })
  }
  return out.sort((p, q) => p.x - q.x)
}

function mixCurves(from: Curves, to: Curves, t: number): Curves {
  return {
    rgb: mixPoints(from.rgb, to.rgb, t),
    r: mixPoints(from.r, to.r, t),
    g: mixPoints(from.g, to.g, t),
    b: mixPoints(from.b, to.b, t),
  }
}

export function mixAdjustments(from: Adjustments, to: Adjustments, t: number): Adjustments {
  const k = Math.max(0, Math.min(1, t))
  if (k === 0) return structuredClone(from)
  if (k === 1) return structuredClone(to)
  return {
    brightness: lerp(from.brightness, to.brightness, k),
    contrast: lerp(from.contrast, to.contrast, k),
    saturation: lerp(from.saturation, to.saturation, k),
    exposure: lerp(from.exposure, to.exposure, k),
    temperature: lerp(from.temperature, to.temperature, k),
    tint: lerp(from.tint, to.tint, k),
    highlights: lerp(from.highlights, to.highlights, k),
    shadows: lerp(from.shadows, to.shadows, k),
    whites: lerp(from.whites, to.whites, k),
    blacks: lerp(from.blacks, to.blacks, k),
    vibrance: lerp(from.vibrance, to.vibrance, k),
    sharpness: lerp(from.sharpness, to.sharpness, k),
    curves: mixCurves(from.curves, to.curves, k),
  }
}

/** Interpolate a look toward identity. intensity 0 = no look, 100 = full preset. */
export function adjustmentsFromLook(preset: Partial<Adjustments>, intensity: number): Adjustments {
  const target = { ...defaultAdjustments(), ...preset, curves: preset.curves ?? DEFAULT_CURVES }
  return mixAdjustments(defaultAdjustments(), target, intensity / 100)
}
