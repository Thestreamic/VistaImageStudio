/**
 * Depth-based portrait bokeh. Focus lock is phone-style:
 *   1. Optional tap/selection (object the user marked)
 *   2. MODNet person matte when it actually isolates a subject
 *   3. Single-camera object focus (iPhone 16e / Samsung / Xiaomi family)
 * Background gets a strong disc CoC; the in-focus plane is pasted back sharp.
 */
import { loadOrtWasm } from '@/features/ai/ort-runtime'
import { segmentWithModel } from './background-removal'
import { estimatePortraitSubject } from './local-enhance'
import { isUsableSubjectMatte, keepToMatte, objectFocusKeep } from './object-focus'
import { publicUrl } from '@/lib/public-url'
import {
  DEFAULT_BOKEH,
  applyBokehFit,
  backgroundDepthMap,
  erodeMap,
  featherDepth,
  phoneBlurRadius,
  type BokehParams,
} from './bokeh'

export interface PortraitBlurParams {
  /** Maximum disc radius (px at working resolution) on the farthest pixels. */
  maxBlurRadius: number
  /** 0..1. Depth at/above this stays fully sharp. */
  subjectThreshold: number
  /** Kept for callers; disc bokeh no longer uses a Gaussian pyramid. */
  levels?: number
  depthGamma?: number
  highlightThreshold?: number
  highlightGain?: number
  samples?: number
}

export const DEFAULT_PORTRAIT_BLUR: PortraitBlurParams = {
  maxBlurRadius: DEFAULT_BOKEH.maxBlurRadius,
  subjectThreshold: DEFAULT_BOKEH.subjectThreshold,
  depthGamma: DEFAULT_BOKEH.depthGamma,
  highlightThreshold: DEFAULT_BOKEH.highlightThreshold,
  highlightGain: DEFAULT_BOKEH.highlightGain,
  samples: DEFAULT_BOKEH.samples,
}

export { phoneBlurRadius } from './bokeh'

export const MIDAS_SMALL_URL = publicUrl('/models/midas-small.onnx')
const MIDAS_NET = 256

export function applyDepthBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  depthMap: Float32Array,
  params: PortraitBlurParams = DEFAULT_PORTRAIT_BLUR,
  subjectAlpha?: Float32Array,
): Uint8ClampedArray {
  return applyBokehFit(data, width, height, depthMap, toBokehParams(params), subjectAlpha)
}

/** Zero-model fallback: turns a binary subject/background matte (0..255,
 *  the same shape background-removal.ts already produces) into a depth
 *  map this function accepts — subject at full "near", background at
 *  full "far". No graduated depth-of-field between objects at different
 *  distances, but a genuinely correct sharp-subject/blurred-background
 *  result, and it needs nothing beyond what's already in this codebase. */
export function matteToDepthMap(matte: Uint8ClampedArray): Float32Array {
  const depth = new Float32Array(matte.length)
  for (let i = 0; i < matte.length; i++) depth[i] = matte[i] / 255
  return depth
}

export type DepthEstimate = {
  depth: Float32Array
  source: 'midas' | 'matte'
  /** Feathered, slightly eroded matte used to paste the sharp subject back. */
  subjectAlpha: Float32Array
}

type MidasSession = {
  inputNames: readonly string[]
  outputNames: readonly string[]
  run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: unknown; dims?: readonly number[] }>>
}

let midasSession: MidasSession | null = null

/** MODNet / any 0..255 alpha → depth: subject near, background far with falloff.
 *  Composite uses `subjectAlpha` (eroded + feathered), not the depth map, so a
 *  crisp matte does not leave a 1px mixed rim. Background depth is distance
 *  from the silhouette, not a radial fan from the centroid. */
export function depthFromAlphaMatte(
  matte: Uint8ClampedArray,
  width: number,
  height: number,
): DepthEstimate {
  const keep = new Float32Array(matte.length)
  for (let i = 0; i < matte.length; i++) keep[i] = matte[i] / 255
  const edge = Math.min(width, height)
  const erodeR = Math.max(1, Math.min(4, Math.round(edge * 0.0022)))
  const featherR = Math.max(2, Math.min(7, Math.round(edge * 0.0036)))
  const core = erodeMap(keep, width, height, erodeR)
  const subjectAlpha = featherDepth(core, width, height, featherR)
  let depth = featherDepth(backgroundDepthMap(core, width, height), width, height, Math.max(4, featherR))
  for (let i = 0; i < keep.length; i++) {
    if (core[i] > 0.5) depth[i] = 1
  }
  return { depth, source: 'matte', subjectAlpha }
}

/**
 * Runs the official Intel MiDaS v2.1 small ONNX (256×256) and returns a
 * full-resolution depth map, 0 = far, 1 = near. Throws if the model is missing.
 * Portrait Bokeh’s live path uses MODNet via `runPortraitBlur`, not this helper.
 */
export async function estimateDepthWithModel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  modelUrl = MIDAS_SMALL_URL,
): Promise<DepthEstimate> {
  try {
    const ort = await loadOrtWasm()
    if (!midasSession) {
      midasSession = (await ort.InferenceSession.create(modelUrl, {
        executionProviders: ['wasm'],
      })) as unknown as MidasSession
    }
    const session = midasSession
    const chw = resizeRgbToChw01(data, width, height, MIDAS_NET, MIDAS_NET)
    const tensor = new ort.Tensor('float32', chw, [1, 3, MIDAS_NET, MIDAS_NET])
    const feeds: Record<string, unknown> = {}
    feeds[session.inputNames[0]] = tensor
    const results = await session.run(feeds)
    const output = results[session.outputNames[0]]
    const dims = output.dims ?? []
    const raw = output.data as Float32Array
    let sh = MIDAS_NET
    let sw = MIDAS_NET
    if (dims.length === 4) {
      sh = dims[2]
      sw = dims[3]
    } else if (dims.length === 3) {
      sh = dims[1]
      sw = dims[2]
    } else if (dims.length === 2) {
      sh = dims[0]
      sw = dims[1]
    }
    const small = normalizeInverseDepth(raw, sw * sh)
    const depth = upsampleDepth(small, sw, sh, width, height)
    return { depth: featherDepth(depth, width, height, 2), source: 'midas', subjectAlpha: depth }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`MiDaS depth model failed: ${detail}`)
  }
}

export async function runPortraitBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  useModel: boolean,
  params: PortraitBlurParams = DEFAULT_PORTRAIT_BLUR,
  mask?: Uint8ClampedArray,
): Promise<{ data: Uint8ClampedArray; source: 'midas' | 'matte' }> {
  const matte = await resolveFocusMatte(data, width, height, useModel, mask)
  const estimate = depthFromAlphaMatte(matte, width, height)
  const sized: PortraitBlurParams = {
    ...params,
    maxBlurRadius:
      params.maxBlurRadius && params.maxBlurRadius > 8
        ? params.maxBlurRadius
        : phoneBlurRadius(Math.min(width, height)),
  }
  return {
    data: applyBokehFit(data, width, height, estimate.depth, toBokehParams(sized), estimate.subjectAlpha),
    source: estimate.source,
  }
}

async function resolveFocusMatte(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  useModel: boolean,
  mask?: Uint8ClampedArray,
): Promise<Uint8ClampedArray> {
  if (mask && mask.length === width * height && isUsableSubjectMatte(mask, width, height)) {
    return mask
  }
  if (useModel) {
    try {
      const person = await segmentWithModel(data, width, height)
      if (isUsableSubjectMatte(person, width, height)) return person
    } catch {
      // Object photos and missing weights fall through to single-camera focus.
    }
  }
  const portrait = estimatePortraitSubject(data, width, height, mask)
  if (portrait) {
    const fromPortrait = keepToMatte(portrait)
    if (isUsableSubjectMatte(fromPortrait, width, height)) return fromPortrait
  }
  const object = objectFocusKeep(data, width, height)
  if (object) {
    const fromObject = keepToMatte(object)
    if (isUsableSubjectMatte(fromObject, width, height)) return fromObject
  }
  if (mask && mask.length === width * height) return mask
  throw new Error('Could not lock focus on a subject. Select the object, then try Portrait Bokeh again.')
}

function toBokehParams(params: PortraitBlurParams): BokehParams {
  return {
    maxBlurRadius: params.maxBlurRadius,
    subjectThreshold: params.subjectThreshold ?? DEFAULT_BOKEH.subjectThreshold,
    depthGamma: params.depthGamma ?? DEFAULT_BOKEH.depthGamma,
    highlightThreshold: params.highlightThreshold ?? DEFAULT_BOKEH.highlightThreshold,
    highlightGain: params.highlightGain ?? DEFAULT_BOKEH.highlightGain,
    samples: params.samples ?? DEFAULT_BOKEH.samples,
  }
}

function resizeRgbToChw01(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  outW: number,
  outH: number,
): Float32Array {
  // Matches official tf/run_onnx.py: RGB 0..1, HWC → CHW, no extra mean/std.
  const plane = outW * outH
  const out = new Float32Array(3 * plane)
  for (let y = 0; y < outH; y++) {
    const sy = Math.min(height - 1, Math.floor((y / outH) * height))
    for (let x = 0; x < outW; x++) {
      const sx = Math.min(width - 1, Math.floor((x / outW) * width))
      const si = (sy * width + sx) * 4
      const di = y * outW + x
      out[di] = data[si] / 255
      out[plane + di] = data[si + 1] / 255
      out[2 * plane + di] = data[si + 2] / 255
    }
  }
  return out
}

function normalizeInverseDepth(raw: Float32Array, expected: number): Float32Array {
  const n = Math.min(raw.length, expected)
  let min = Infinity
  let max = -Infinity
  for (let i = 0; i < n; i++) {
    const v = raw[i]
    if (v < min) min = v
    if (v > max) max = v
  }
  const out = new Float32Array(expected)
  const span = max - min
  if (!Number.isFinite(span) || span < 1e-6) {
    out.fill(1)
    return out
  }
  // MiDaS inverse depth: larger = closer → 1 = near.
  for (let i = 0; i < n; i++) out[i] = (raw[i] - min) / span
  return out
}

function upsampleDepth(
  small: Float32Array,
  sw: number,
  sh: number,
  width: number,
  height: number,
): Float32Array {
  const out = new Float32Array(width * height)
  const xScale = (sw - 1) / Math.max(1, width - 1)
  const yScale = (sh - 1) / Math.max(1, height - 1)
  for (let y = 0; y < height; y++) {
    const fy = y * yScale
    const y0 = Math.floor(fy)
    const y1 = Math.min(sh - 1, y0 + 1)
    const ty = fy - y0
    for (let x = 0; x < width; x++) {
      const fx = x * xScale
      const x0 = Math.floor(fx)
      const x1 = Math.min(sw - 1, x0 + 1)
      const tx = fx - x0
      const v00 = small[y0 * sw + x0]
      const v10 = small[y0 * sw + x1]
      const v01 = small[y1 * sw + x0]
      const v11 = small[y1 * sw + x1]
      out[y * width + x] = v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty
    }
  }
  return out
}

export function paramsFromStrength(strength: number, minEdge = 1200): PortraitBlurParams {
  const s = Math.max(0, Math.min(1, strength))
  return {
    maxBlurRadius: phoneBlurRadius(minEdge, s),
    subjectThreshold: DEFAULT_BOKEH.subjectThreshold,
    depthGamma: DEFAULT_BOKEH.depthGamma,
    highlightThreshold: DEFAULT_BOKEH.highlightThreshold,
    highlightGain: DEFAULT_BOKEH.highlightGain,
    samples: DEFAULT_BOKEH.samples,
  }
}
