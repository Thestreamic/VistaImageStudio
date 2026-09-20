/**
 * Background removal.
 *
 * Live path: `segmentWithModel` / `estimateAlphaMatte` run bundled MODNet
 * (photographic portrait matting) via onnxruntime-web. Failure throws —
 * there is no silent flood-fill fallback on Remove Background.
 *
 * `segmentHeuristic` remains for unit tests and other callers that still
 * import it (`local-enhance.ts`). It is not the product path.
 */

import { loadOrtWasm, resolvePublicHref } from '@/features/ai/ort-runtime'
import { publicUrl } from '@/lib/public-url'

export const MODNET_URL = publicUrl('/models/modnet.onnx')
export const MODNET_REF_SIZE = 512

export interface BgRemovalParams {
  /** Edge feather radius in px, softens the matte boundary. */
  feather: number
  /** Extra erosion (px) applied before feathering, trims halo fringing. */
  erode: number
}

export const DEFAULT_BG_REMOVAL: BgRemovalParams = { feather: 2, erode: 1 }

/** Flood-fill border colour distance → binary-ish matte, then refine. */
export function segmentHeuristic(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: BgRemovalParams = DEFAULT_BG_REMOVAL,
): Uint8ClampedArray {
  const matte = new Uint8ClampedArray(width * height).fill(255)
  const visited = new Uint8Array(width * height)
  const idx = (x: number, y: number) => y * width + x

  // Background estimate as a set of border colour *clusters*, not one median.
  // A median collapses a multi-tone backdrop (sky over grass, a gradient, a
  // vignette) into a colour that sits between the real ones and therefore
  // matches none of them, so the fill below removes nothing at all and the
  // whole feature looks broken.
  const clusters = clusterBorderColors(data, width, height)

  // BFS flood fill from all border pixels within colour tolerance.
  const stack: number[] = []
  for (let x = 0; x < width; x++) { stack.push(idx(x, 0)); stack.push(idx(x, height - 1)) }
  for (let y = 0; y < height; y++) { stack.push(idx(0, y)); stack.push(idx(width - 1, y)) }

  const tolerance = 34
  while (stack.length) {
    const p = stack.pop()!
    if (visited[p]) continue
    visited[p] = 1
    const [r, g, b] = pixelAt(data, p)
    const dist = distanceToNearest([r, g, b], clusters)
    if (dist > tolerance) continue
    matte[p] = 0
    const x = p % width
    const y = (p - x) / width
    if (x > 0) stack.push(p - 1)
    if (x < width - 1) stack.push(p + 1)
    if (y > 0) stack.push(p - width)
    if (y < height - 1) stack.push(p + width)
  }

  erodeMatte(matte, width, height, params.erode)
  return featherMatte(matte, width, height, params.feather)
}

type OrtSession = {
  inputNames: readonly string[]
  outputNames: readonly string[]
  run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: unknown; dims?: readonly number[] }>>
}

const sessionCache = new Map<string, Promise<OrtSession>>()

async function getModnetSession(modelUrl: string): Promise<OrtSession> {
  const hit = sessionCache.get(modelUrl)
  if (hit) return hit
  const loading = (async () => {
    const ort = await loadOrtWasm()
    const href = /^(https?:|blob:|file:)/i.test(modelUrl) ? modelUrl : resolvePublicHref(modelUrl)
    return (await ort.InferenceSession.create(href, {
      executionProviders: ['wasm'],
    })) as unknown as OrtSession
  })()
  sessionCache.set(modelUrl, loading)
  try {
    return await loading
  } catch (err) {
    sessionCache.delete(modelUrl)
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Portrait matting model failed (${modelUrl}): ${detail}`)
  }
}

/** Official MODNet ONNX spatial size: ref 512, multiple of 32, keep aspect. */
export function modnetInputSize(width: number, height: number, refSize = MODNET_REF_SIZE): { w: number; h: number } {
  let rh: number
  let rw: number
  if (Math.max(height, width) < refSize || Math.min(height, width) > refSize) {
    if (width >= height) {
      rh = refSize
      rw = Math.round((width / Math.max(1, height)) * refSize)
    } else {
      rw = refSize
      rh = Math.round((height / Math.max(1, width)) * refSize)
    }
  } else {
    rh = height
    rw = width
  }
  rw = Math.max(32, rw - (rw % 32))
  rh = Math.max(32, rh - (rh % 32))
  return { w: rw, h: rh }
}

/**
 * Raw MODNet alpha at original resolution (0..255). No erode/feather.
 * Throws if the ONNX or runtime is missing — callers must not swallow this
 * into the heuristic matte.
 */
export async function estimateAlphaMatte(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  modelUrl = MODNET_URL,
): Promise<Uint8ClampedArray> {
  const session = await getModnetSession(modelUrl)
  const { w: nw, h: nh } = modnetInputSize(width, height)
  const chw = resizeRgbToNchwMinusOneOne(data, width, height, nw, nh)
  const ort = await loadOrtWasm()
  const tensor = new ort.Tensor('float32', chw, [1, 3, nh, nw])
  const feeds: Record<string, unknown> = {}
  feeds[session.inputNames[0]] = tensor
  const results = await session.run(feeds)
  const output = results[session.outputNames[0]]
  const dims = output.dims ?? []
  let sh = nh
  let sw = nw
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
  return upsampleMatte(output.data as Float32Array, sw, sh, width, height)
}

export function refineAlphaMatte(
  matte: Uint8ClampedArray,
  width: number,
  height: number,
  params: BgRemovalParams = DEFAULT_BG_REMOVAL,
): Uint8ClampedArray {
  const out = matte.slice()
  erodeMatte(out, width, height, params.erode)
  return featherMatte(out, width, height, params.feather)
}

/** Writes the matte into alpha. RGB unchanged. Does not mutate `data`. */
export function applyAlphaMatte(data: Uint8ClampedArray, matte: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data)
  const n = Math.min(matte.length, (out.length / 4) | 0)
  for (let i = 0; i < n; i++) out[i * 4 + 3] = matte[i]
  return out
}

/**
 * MODNet segmentation + edge refine. Throws if the model cannot run.
 * Never falls back to `segmentHeuristic`.
 */
export async function segmentWithModel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  modelUrl = MODNET_URL,
): Promise<Uint8ClampedArray> {
  const matte = await estimateAlphaMatte(data, width, height, modelUrl)
  return refineAlphaMatte(matte, width, height)
}

// ─── helpers ───────────────────────────────────────────────────────────────
function pixelAt(data: Uint8ClampedArray, pixelIndex: number): [number, number, number] {
  const i = pixelIndex * 4
  return [data[i], data[i + 1], data[i + 2]]
}

function colorDist(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)
}

/** Colours joined into one cluster; roughly "the same tone" to the eye. */
const CLUSTER_RADIUS = 28
/** A cluster this small along the border is treated as subject, not backdrop. */
const MIN_CLUSTER_SHARE = 0.12

/**
 * Greedy one-pass clustering of the border pixels. Clusters holding only a
 * small share of the border are dropped: a backdrop wraps most of the frame,
 * whereas a subject that merely touches an edge does not — without that
 * filter the fill would happily eat the subject from the outside in.
 */
export function clusterBorderColors(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): [number, number, number][] {
  const idx = (x: number, y: number) => y * width + x
  const samples: [number, number, number][] = []
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 64))) {
    samples.push(pixelAt(data, idx(x, 0)), pixelAt(data, idx(x, height - 1)))
  }
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 64))) {
    samples.push(pixelAt(data, idx(0, y)), pixelAt(data, idx(width - 1, y)))
  }

  const sums: [number, number, number][] = []
  const counts: number[] = []
  for (const s of samples) {
    let best = -1
    let bestDist = Infinity
    for (let i = 0; i < sums.length; i++) {
      const d = colorDist(s, centroid(sums[i], counts[i]))
      if (d < bestDist) { bestDist = d; best = i }
    }
    if (best >= 0 && bestDist <= CLUSTER_RADIUS) {
      sums[best][0] += s[0]; sums[best][1] += s[1]; sums[best][2] += s[2]
      counts[best]++
    } else {
      sums.push([...s])
      counts.push(1)
    }
  }

  const kept = counts
    .map((count, i) => ({ count, color: centroid(sums[i], count) }))
    .filter(({ count }) => count / samples.length >= MIN_CLUSTER_SHARE)
    .map(({ color }) => color)

  // Every cluster tiny (a busy, detailed edge) — fall back to the largest one
  // so the caller still gets a best-effort matte rather than a no-op.
  if (kept.length > 0) return kept
  const largest = counts.indexOf(Math.max(...counts))
  return largest >= 0 ? [centroid(sums[largest], counts[largest])] : []
}

function centroid(sum: [number, number, number], count: number): [number, number, number] {
  return [sum[0] / count, sum[1] / count, sum[2] / count]
}

function distanceToNearest(
  color: [number, number, number],
  clusters: [number, number, number][],
): number {
  let best = Infinity
  for (const c of clusters) best = Math.min(best, colorDist(color, c))
  return best
}

function erodeMatte(matte: Uint8ClampedArray, width: number, height: number, radius: number) {
  if (radius <= 0) return
  const src = matte.slice()
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minV = 255
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx, ny = y + dy
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
          minV = Math.min(minV, src[ny * width + nx])
        }
      }
      matte[y * width + x] = minV
    }
  }
}

function featherMatte(matte: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
  if (radius <= 0) return matte
  // Simple separable box blur for a soft feather (fast, good enough at small radii).
  const out = new Float32Array(matte.length)
  const tmp = new Float32Array(matte.length)
  const norm = 1 / (radius * 2 + 1)
  for (let y = 0; y < height; y++) {
    let acc = 0
    for (let x = -radius; x <= radius; x++) acc += matte[y * width + Math.max(0, Math.min(width - 1, x))]
    for (let x = 0; x < width; x++) {
      tmp[y * width + x] = acc * norm
      const addX = Math.min(width - 1, x + radius + 1)
      const subX = Math.max(0, x - radius)
      acc += matte[y * width + addX] - matte[y * width + subX]
    }
  }
  for (let x = 0; x < width; x++) {
    let acc = 0
    for (let y = -radius; y <= radius; y++) acc += tmp[Math.max(0, Math.min(height - 1, y)) * width + x]
    for (let y = 0; y < height; y++) {
      out[y * width + x] = acc * norm
      const addY = Math.min(height - 1, y + radius + 1)
      const subY = Math.max(0, y - radius)
      acc += tmp[addY * width + x] - tmp[subY * width + x]
    }
  }
  return Uint8ClampedArray.from(out)
}

/** Bilinear RGB resize → NCHW float32 in [-1, 1], matching official MODNet ONNX inference. */
function resizeRgbToNchwMinusOneOne(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  outW: number,
  outH: number,
): Float32Array {
  const plane = outW * outH
  const out = new Float32Array(3 * plane)
  const xScale = (width - 1) / Math.max(1, outW - 1)
  const yScale = (height - 1) / Math.max(1, outH - 1)
  for (let y = 0; y < outH; y++) {
    const fy = y * yScale
    const y0 = Math.floor(fy)
    const y1 = Math.min(height - 1, y0 + 1)
    const ty = fy - y0
    for (let x = 0; x < outW; x++) {
      const fx = x * xScale
      const x0 = Math.floor(fx)
      const x1 = Math.min(width - 1, x0 + 1)
      const tx = fx - x0
      const i00 = (y0 * width + x0) * 4
      const i10 = (y0 * width + x1) * 4
      const i01 = (y1 * width + x0) * 4
      const i11 = (y1 * width + x1) * 4
      const di = y * outW + x
      for (let c = 0; c < 3; c++) {
        const v =
          data[i00 + c] * (1 - tx) * (1 - ty) +
          data[i10 + c] * tx * (1 - ty) +
          data[i01 + c] * (1 - tx) * ty +
          data[i11 + c] * tx * ty
        out[c * plane + di] = (v - 127.5) / 127.5
      }
    }
  }
  return out
}

/** Bilinear upsample of a 0..1 (or 0..255) matte to full resolution, 0..255. */
export function upsampleMatte(
  small: Float32Array | Uint8ClampedArray,
  smallW: number,
  smallH: number,
  width: number,
  height: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height)
  const xScale = (smallW - 1) / Math.max(1, width - 1)
  const yScale = (smallH - 1) / Math.max(1, height - 1)
  const as01 = small instanceof Float32Array
  const at = (x: number, y: number) => {
    const v = small[y * smallW + x]
    return as01 ? v * 255 : v
  }
  for (let y = 0; y < height; y++) {
    const fy = y * yScale
    const y0 = Math.floor(fy)
    const y1 = Math.min(smallH - 1, y0 + 1)
    const ty = fy - y0
    for (let x = 0; x < width; x++) {
      const fx = x * xScale
      const x0 = Math.floor(fx)
      const x1 = Math.min(smallW - 1, x0 + 1)
      const tx = fx - x0
      const v =
        at(x0, y0) * (1 - tx) * (1 - ty) +
        at(x1, y0) * tx * (1 - ty) +
        at(x0, y1) * (1 - tx) * ty +
        at(x1, y1) * tx * ty
      out[y * width + x] = v
    }
  }
  return out
}
