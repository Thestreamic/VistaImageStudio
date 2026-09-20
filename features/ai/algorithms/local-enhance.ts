/**
 * Five original, model-free pixel ops used by the AI panel.
 *
 * Nothing here is a port of Zero-DCE, MODNet, RMBG, or any other third-party
 * network: no weights, no copied layers, no NC-licensed code. Each function
 * is a closed-form transform over RGBA buffers so the product can ship
 * commercially without ripping features out later.
 */
import { gaussianBlur, unsharpMask, skinMask } from './filters'
import { segmentHeuristic } from './background-removal'
import { matteIsTrustworthy } from './scene-gate'

function copyRgba(src: Uint8ClampedArray): Uint8ClampedArray {
  return new Uint8ClampedArray(src)
}

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export interface StrengthParams {
  /** 0..1. */
  strength: number
  /** Optional 0..255 subject mask, one byte per pixel. 255 = keep sharp. */
  mask?: Uint8ClampedArray
}

/**
 * Night / underexposed lift. Shadows get most of the gain; highlights are
 * softly capped so a dark room does not blow out lamps and windows. A light
 * unsharp pass puts local contrast back after the lift.
 */
export function lowLightEnhance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  { strength }: StrengthParams = { strength: 0.35 },
): Uint8ClampedArray {
  const s = Math.max(0, Math.min(1, strength))
  if (s === 0) return copyRgba(data)
  const out = copyRgba(data)
  const maxGain = 1 + 1.9 * s
  const k = 2.4 * s
  const logNorm = Math.log(1 + k) || 1

  for (let i = 0; i < out.length; i += 4) {
    const r = out[i]
    const g = out[i + 1]
    const b = out[i + 2]
    const y = luma(r, g, b)
    if (y < 1) continue
    const yn = y / 255
    // Log lift opens the shadows; the (1-yn)^2 term keeps bright pixels still.
    const lifted = Math.log(1 + k * yn) / logNorm
    const shadow = 1 + (maxGain - 1) * Math.pow(1 - yn, 2.15)
    const mixed = yn * (1 - s * 0.85) + lifted * s * 0.85
    const gain = Math.min(shadow, mixed / yn)
    const nextY = Math.min(248, y * gain)
    const scale = nextY / y
    out[i] = r * scale
    out[i + 1] = g * scale
    out[i + 2] = b * scale
  }

  return unsharpMask(out, width, height, 2, 0.22 * s, 5)
}

/**
 * Haze / fog recovery from a simple scattering model:
 *   I = J * t + A * (1 - t)
 * Transmission t is estimated from a blurred per-pixel dark channel
 * (min of R,G,B), atmosphere A from the brightest dark-channel pixels.
 * Original implementation — not a copy of any published source dump.
 */
export function dehaze(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  { strength }: StrengthParams = { strength: 0.28 },
): Uint8ClampedArray {
  const s = Math.max(0, Math.min(1, strength))
  if (s === 0) return copyRgba(data)
  const n = width * height
  const dark = new Uint8ClampedArray(n)
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    dark[p] = Math.min(data[i], data[i + 1], data[i + 2])
  }

  // Soften the dark channel so transmission is spatially coherent.
  const darkRgba = new Uint8ClampedArray(n * 4)
  for (let p = 0; p < n; p++) {
    darkRgba[p * 4] = dark[p]
    darkRgba[p * 4 + 3] = 255
  }
  const smooth = gaussianBlur(darkRgba, width, height, 4)
  for (let p = 0; p < n; p++) dark[p] = smooth[p * 4]

  const [ar, ag, ab] = estimateAtmosphere(data, dark, n)
  const aMin = Math.max(1, Math.min(ar, ag, ab))
  const omega = 0.2 + 0.7 * s
  const t0 = 0.18
  const out = copyRgba(data)

  for (let p = 0, i = 0; p < n; p++, i += 4) {
    const t = Math.max(t0, 1 - (omega * dark[p]) / aMin)
    out[i] = (data[i] - ar) / t + ar
    out[i + 1] = (data[i + 1] - ag) / t + ag
    out[i + 2] = (data[i + 2] - ab) / t + ab
    out[i + 3] = data[i + 3]
  }
  return out
}

function estimateAtmosphere(
  data: Uint8ClampedArray,
  dark: Uint8ClampedArray,
  n: number,
): [number, number, number] {
  const hist = new Uint32Array(256)
  for (let p = 0; p < n; p++) hist[dark[p]]++
  const want = Math.max(1, Math.floor(n * 0.001))
  let acc = 0
  let threshold = 255
  for (let v = 255; v >= 0; v--) {
    acc += hist[v]
    if (acc >= want) { threshold = v; break }
  }
  let sr = 0
  let sg = 0
  let sb = 0
  let take = 0
  for (let p = 0; p < n; p++) {
    if (dark[p] < threshold) continue
    const i = p * 4
    sr += data[i]
    sg += data[i + 1]
    sb += data[i + 2]
    take++
  }
  if (take === 0) return [220, 220, 220]
  return [sr / take, sg / take, sb / take]
}

/**
 * Structure / local contrast: two-scale unsharp so both micro-detail and
 * larger edges lift. This is a spatial filter, not a tone-curve fake.
 */
export function clarityEnhance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  { strength }: StrengthParams = { strength: 0.22 },
): Uint8ClampedArray {
  const s = Math.max(0, Math.min(1, strength))
  if (s === 0) return copyRgba(data)
  return unsharpMask(data, width, height, 1.4, 0.32 * s, 3)
}

/**
 * Vibrance: saturates muted colours more than already-loud ones, and
 * eases off on skin so portraits don't go orange.
 */
export function vibranceEnhance(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  { strength }: StrengthParams = { strength: 0.22 },
): Uint8ClampedArray {
  const s = Math.max(0, Math.min(1, strength))
  if (s === 0) return copyRgba(data)
  const skin = skinMask(data, width, height)
  const out = copyRgba(data)

  for (let p = 0, i = 0; p < skin.length; p++, i += 4) {
    const r = out[i]
    const g = out[i + 1]
    const b = out[i + 2]
    const y = luma(r, g, b)
    const sat = Math.max(r, g, b) - Math.min(r, g, b)
    const mute = 1 - sat / 255
    const protect = 1 - 0.75 * (skin[p] / 255)
    const boost = 1 + s * 0.9 * mute * protect
    out[i] = y + (r - y) * boost
    out[i + 1] = y + (g - y) * boost
    out[i + 2] = y + (b - y) * boost
  }
  return out
}

export type BackgroundBlurPreset = 'soft' | 'portrait' | 'strong'

export const BACKGROUND_BLUR_PRESETS: Record<BackgroundBlurPreset, { label: string; strength: number }> = {
  soft: { label: 'Soft', strength: 0.55 },
  portrait: { label: 'Portrait', strength: 0.82 },
  strong: { label: 'Strong', strength: 0.96 },
}

const WORK_EDGE = 720

export type BackgroundBlurResult = {
  data: Uint8ClampedArray
  skipped: boolean
  reason?: string
}

/**
 * Portrait background blur.
 *
 * The previous keep-map (centre prior + “unlike the border ⇒ subject”)
 * marked most of a real photo as subject *and* mixed a downsampled blur at
 * ~30% over the rest — that is the grey fog in the lakeside selfie, not
 * depth of field. This path builds a near-binary subject mask (person from
 * skin, or a clean studio cutout, or an explicit selection) and composites:
 *   out = src * keep + blur(src) * (1 - keep)
 * If we cannot find a subject, we return the original instead of fogging it.
 */
export function backgroundBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: StrengthParams = { strength: BACKGROUND_BLUR_PRESETS.portrait.strength },
): Uint8ClampedArray {
  return applyBackgroundBlur(data, width, height, params).data
}

export function applyBackgroundBlur(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  { strength, mask }: StrengthParams = { strength: BACKGROUND_BLUR_PRESETS.portrait.strength },
): BackgroundBlurResult {
  const s = Math.max(0, Math.min(1, strength))
  if (s === 0) return { data: copyRgba(data), skipped: true, reason: 'zero' }

  const scale = Math.min(1, WORK_EDGE / Math.max(width, height))
  const dw = Math.max(8, Math.round(width * scale))
  const dh = Math.max(8, Math.round(height * scale))
  const small = scale < 0.999 ? downsampleArea(data, width, height, dw, dh) : data
  const smallMask = mask && mask.length === width * height && scale < 0.999
    ? downsampleMask(mask, width, height, dw, dh)
    : mask && mask.length === width * height
      ? mask
      : undefined

  const keep = buildSubjectKeep(small, dw, dh, smallMask)
  if (!keep) return { data: copyRgba(data), skipped: true, reason: 'no-subject' }

  let bg = 0
  for (let i = 0; i < keep.length; i++) if (keep[i] < 0.35) bg++
  if (bg / keep.length < 0.12) return { data: copyRgba(data), skipped: true, reason: 'no-background' }

  const radius = Math.max(8, Math.round(Math.min(dw, dh) * (0.09 + 0.11 * s)))
  const blurredSmall = stackBoxBlur(small, dw, dh, radius, 2)
  const mixAmt = 0.72 + 0.28 * s

  const out = copyRgba(data)
  const xScale = (dw - 1) / Math.max(1, width - 1)
  const yScale = (dh - 1) / Math.max(1, height - 1)
  for (let y = 0; y < height; y++) {
    const fy = y * yScale
    for (let x = 0; x < width; x++) {
      const fx = x * xScale
      const i = (y * width + x) * 4
      const k = sampleBilinearScalar(keep, dw, dh, fx, fy)
      const mix = (1 - k) * mixAmt
      if (mix < 0.01) continue
      const br = sampleBilinear(blurredSmall, dw, dh, fx, fy)
      out[i] = data[i] + (br[0] - data[i]) * mix
      out[i + 1] = data[i + 1] + (br[1] - data[i + 1]) * mix
      out[i + 2] = data[i + 2] + (br[2] - data[i + 2]) * mix
    }
  }
  return { data: out, skipped: false, reason: smallMask ? 'mask' : 'auto' }
}

/** Public subject keep-map for portrait bokeh when no depth model is available. */
export function estimatePortraitSubject(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  mask?: Uint8ClampedArray,
): Float32Array | null {
  if (mask && mask.length === width * height) return buildSubjectKeep(data, width, height, mask)
  const people = portraitFocalKeep(data, width, height)
  if (people) return growSubjectKeep(data, width, height, people)
  const fallback = buildSubjectKeep(data, width, height)
  return fallback ? growSubjectKeep(data, width, height, fallback) : fallback
}

function looksLikeSky(r: number, g: number, b: number): boolean {
  return b > r + 8 && b > g + 4 && b > 80
}

function looksLikeVeg(r: number, g: number, b: number): boolean {
  return g > r + 12 && g > b + 8 && g > 50
}

/**
 * Face ellipses miss outstretched arms. Grow the keep map from the high-confidence
 * core along similarly coloured connected pixels (a white jacket, a dark coat),
 * stopping at sky/vegetation and at a spill cap so the background cannot flood.
 */
export function growSubjectKeep(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  keep: Float32Array,
): Float32Array {
  const n = width * height
  if (keep.length < n || data.length < n * 4) return keep
  const out = new Float32Array(keep)
  const grown = new Uint8Array(n)
  const queue = new Int32Array(n)

  const flood = (isSeed: (i: number) => boolean, dist2: number, fill: number, cap: number): number => {
    let qh = 0
    let qt = 0
    for (let i = 0; i < n; i++) {
      if (grown[i] || !isSeed(i)) continue
      grown[i] = 1
      out[i] = Math.max(out[i], fill)
      queue[qt++] = i
    }
    if (qt === 0) return 0
    while (qh < qt) {
      if (qt > cap) return -1
      const i = queue[qh++]
      const x = i % width
      const y = (i / width) | 0
      const visit = (ni: number) => {
        if (grown[ni]) return
        const a = i * 4
        const b = ni * 4
        const dr = data[a] - data[b]
        const dg = data[a + 1] - data[b + 1]
        const db = data[a + 2] - data[b + 2]
        if (dr * dr + dg * dg + db * db > dist2) return
        grown[ni] = 1
        out[ni] = Math.max(out[ni], fill)
        queue[qt++] = ni
      }
      if (x > 0) visit(i - 1)
      if (x + 1 < width) visit(i + 1)
      if (y > 0) visit(i - width)
      if (y + 1 < height) visit(i + width)
    }
    return qt
  }

  const faceCount = flood((i) => {
    if (keep[i] < 0.68) return false
    const p = i * 4
    return skinLikelihood(data[p], data[p + 1], data[p + 2]) >= 0.22
  }, 40 * 40, 0.96, Math.floor(n * 0.55))
  if (faceCount < 0) return keep
  if (faceCount === 0) return keep

  const halo = dilateBinary(grown, width, height, 3)
  const afterFace = new Float32Array(out)
  const clothCount = flood((i) => {
    if (grown[i] || !halo[i]) return false
    const p = i * 4
    const r = data[p]
    const g = data[p + 1]
    const b = data[p + 2]
    return !looksLikeSky(r, g, b) && !looksLikeVeg(r, g, b)
  }, 52 * 52, 0.94, Math.floor(n * 0.5))
  if (clothCount < 0) return afterFace
  return out
}

function dilateBinary(src: Uint8Array, width: number, height: number, radius: number): Uint8Array {
  const n = width * height
  const r = Math.max(1, Math.round(radius))
  const tmp = new Uint8Array(n)
  const out = new Uint8Array(n)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = 0
      for (let k = -r; k <= r; k++) {
        const xx = x + k
        if (xx < 0 || xx >= width) continue
        if (src[y * width + xx]) {
          v = 1
          break
        }
      }
      tmp[y * width + x] = v
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let v = 0
      for (let k = -r; k <= r; k++) {
        const yy = y + k
        if (yy < 0 || yy >= height) continue
        if (tmp[yy * width + x]) {
          v = 1
          break
        }
      }
      out[y * width + x] = v
    }
  }
  return out
}

/** Every detected person as a torso-sized capsule so bodies stay sharp, not just faces. */
function portraitFocalKeep(data: Uint8ClampedArray, width: number, height: number): Float32Array | null {
  const blobs = allPersonBlobs(data, width, height)
  if (!blobs.length) return null
  const keep = new Float32Array(width * height)
  for (const blob of blobs) {
    const bw = blob.x1 - blob.x0 + 1
    const bh = blob.y1 - blob.y0 + 1
    const cx = (blob.x0 + blob.x1) / 2
    const cy = (blob.y0 + blob.y1) / 2 + bh * 0.9
    const rx = Math.max(12, bw * 1.55)
    const ry = Math.max(16, bh * 2.8)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const e = Math.hypot((x - cx) / rx, (y - cy) / ry)
        const i = y * width + x
        const v = 1 - smoothstep(0.58, 1.18, e)
        if (v > keep[i]) keep[i] = v
      }
    }
  }
  return keep
}

function allPersonBlobs(data: Uint8ClampedArray, width: number, height: number): SkinBlob[] {
  const seen = new Uint8Array(width * height)
  const blobs: SkinBlob[] = []
  const stack = new Int32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      if (seen[p]) continue
      const i = p * 4
      if (skinLikelihood(data[i], data[i + 1], data[i + 2]) < 0.28) {
        seen[p] = 1
        continue
      }
      let top = 0
      stack[top++] = p
      seen[p] = 1
      let n = 0
      let x0 = x
      let y0 = y
      let x1 = x
      let y1 = y
      while (top > 0) {
        const q = stack[--top]
        n++
        const qx = q % width
        const qy = (q / width) | 0
        if (qx < x0) x0 = qx
        if (qy < y0) y0 = qy
        if (qx > x1) x1 = qx
        if (qy > y1) y1 = qy
        const tryPush = (nx: number, ny: number) => {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) return
          const np = ny * width + nx
          if (seen[np]) return
          const ni = np * 4
          if (skinLikelihood(data[ni], data[ni + 1], data[ni + 2]) < 0.28) {
            seen[np] = 1
            return
          }
          seen[np] = 1
          stack[top++] = np
        }
        tryPush(qx - 1, qy)
        tryPush(qx + 1, qy)
        tryPush(qx, qy - 1)
        tryPush(qx, qy + 1)
      }
      const blob = { x0, y0, x1, y1, n }
      if (blobScore(blob, width, height) > 0) blobs.push(blob)
    }
  }
  return blobs
}

function buildSubjectKeep(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  mask?: Uint8ClampedArray,
): Float32Array | null {
  if (mask && mask.length === width * height) {
    const keep = new Float32Array(width * height)
    let sharp = 0
    for (let i = 0; i < keep.length; i++) {
      keep[i] = mask[i] / 255
      if (keep[i] > 0.5) sharp++
    }
    if (sharp < keep.length * 0.02 || sharp > keep.length * 0.92) return null
    return keep
  }

  const person = personKeepMap(data, width, height)
  if (person) return person

  const matte = segmentHeuristic(data, width, height, { feather: 6, erode: 1 })
  if (!matteIsTrustworthy(matte, width, height)) return null
  const keep = new Float32Array(width * height)
  for (let i = 0; i < keep.length; i++) keep[i] = matte[i] / 255
  return keep
}

/**
 * Largest skin-coloured blob → feathered ellipse. Correct for a selfie with
 * the face on an edge (centre-weighted maps keep the scenery and smear the
 * person — that was the lakeside flop).
 */
function personKeepMap(data: Uint8ClampedArray, width: number, height: number): Float32Array | null {
  const blob = bestPersonBlob(data, width, height)
  if (!blob) return null
  const bw = blob.x1 - blob.x0 + 1
  const bh = blob.y1 - blob.y0 + 1
  const cx = (blob.x0 + blob.x1) / 2
  const cy = (blob.y0 + blob.y1) / 2 + bh * 0.08
  const rx = Math.max(8, bw * 0.92)
  const ry = Math.max(8, bh * 1.12)
  const keep = new Float32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const e = Math.hypot((x - cx) / rx, (y - cy) / ry)
      keep[y * width + x] = 1 - smoothstep(0.68, 1.28, e)
    }
  }
  return keep
}

type SkinBlob = { x0: number; y0: number; x1: number; y1: number; n: number }

function blobScore(blob: SkinBlob, width: number, height: number): number {
  const bw = blob.x1 - blob.x0 + 1
  const bh = blob.y1 - blob.y0 + 1
  if (bw < 8 || bh < 8) return 0
  if (bh > bw * 3.6) return 0
  if (bw > width * 0.62 || bh > height * 0.9) return 0
  if (bw * bh > width * height * 0.42) return 0
  const compact = blob.n / (bw * bh)
  if (compact < 0.18) return 0
  const frac = blob.n / (width * height)
  if (frac < 0.003 || frac > 0.4) return 0
  return blob.n * compact
}

function bestPersonBlob(data: Uint8ClampedArray, width: number, height: number): SkinBlob | null {
  const seen = new Uint8Array(width * height)
  let best: SkinBlob | null = null
  let bestScore = 0
  const stack = new Int32Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      if (seen[p]) continue
      const i = p * 4
      if (skinLikelihood(data[i], data[i + 1], data[i + 2]) < 0.28) {
        seen[p] = 1
        continue
      }
      let top = 0
      stack[top++] = p
      seen[p] = 1
      let n = 0
      let x0 = x
      let y0 = y
      let x1 = x
      let y1 = y
      while (top > 0) {
        const q = stack[--top]
        n++
        const qx = q % width
        const qy = (q / width) | 0
        if (qx < x0) x0 = qx
        if (qy < y0) y0 = qy
        if (qx > x1) x1 = qx
        if (qy > y1) y1 = qy
        const tryPush = (nx: number, ny: number) => {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) return
          const np = ny * width + nx
          if (seen[np]) return
          const ni = np * 4
          if (skinLikelihood(data[ni], data[ni + 1], data[ni + 2]) < 0.28) {
            seen[np] = 1
            return
          }
          seen[np] = 1
          stack[top++] = np
        }
        tryPush(qx - 1, qy)
        tryPush(qx + 1, qy)
        tryPush(qx, qy - 1)
        tryPush(qx, qy + 1)
      }
      const blob = { x0, y0, x1, y1, n }
      const score = blobScore(blob, width, height)
      if (score > bestScore) {
        bestScore = score
        best = blob
      }
    }
  }
  return bestScore > 0 ? best : null
}

function downsampleMask(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dw * dh)
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor((y / dh) * sh))
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor((x / dw) * sw))
      out[y * dw + x] = src[sy * sw + sx]
    }
  }
  return out
}

function skinLikelihood(r: number, g: number, b: number): number {
  if (r < 60 || r <= g || r <= b || r - g < 12 || g > r * 0.85) return 0
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
  if (!(cb >= 77 && cb <= 127 && cr >= 133 && cr <= 180)) return 0
  const dcb = Math.abs(cb - 102) / 25
  const dcr = Math.abs(cr - 153) / 22
  return 1 - Math.min(1, Math.max(dcb, dcr)) * 0.6
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function downsampleArea(
  src: Uint8ClampedArray,
  sw: number,
  sh: number,
  dw: number,
  dh: number,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dw * dh * 4)
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor((y / dh) * sh)
    const y1 = Math.max(y0 + 1, Math.floor(((y + 1) / dh) * sh))
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor((x / dw) * sw)
      const x1 = Math.max(x0 + 1, Math.floor(((x + 1) / dw) * sw))
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      let n = 0
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * sw + xx) * 4
          r += src[i]
          g += src[i + 1]
          b += src[i + 2]
          a += src[i + 3]
          n++
        }
      }
      const o = (y * dw + x) * 4
      const inv = 1 / n
      out[o] = r * inv
      out[o + 1] = g * inv
      out[o + 2] = b * inv
      out[o + 3] = a * inv
    }
  }
  return out
}

function stackBoxBlur(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  passes: number,
): Uint8ClampedArray {
  let buf = src
  for (let p = 0; p < passes; p++) buf = boxBlurRgba(buf, width, height, radius)
  return buf
}

function boxBlurRgba(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  const r = Math.max(1, Math.round(radius))
  const n = r * 2 + 1
  const inv = 1 / n
  const tmp = new Float32Array(src.length)
  const out = new Uint8ClampedArray(src.length)

  for (let y = 0; y < height; y++) {
    let sr = 0
    let sg = 0
    let sb = 0
    for (let k = -r; k <= r; k++) {
      const x = Math.max(0, Math.min(width - 1, k))
      const i = (y * width + x) * 4
      sr += src[i]
      sg += src[i + 1]
      sb += src[i + 2]
    }
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4
      tmp[o] = sr * inv
      tmp[o + 1] = sg * inv
      tmp[o + 2] = sb * inv
      tmp[o + 3] = src[o + 3]
      const addX = Math.min(width - 1, x + r + 1)
      const subX = Math.max(0, x - r)
      const ia = (y * width + addX) * 4
      const is = (y * width + subX) * 4
      sr += src[ia] - src[is]
      sg += src[ia + 1] - src[is + 1]
      sb += src[ia + 2] - src[is + 2]
    }
  }

  for (let x = 0; x < width; x++) {
    let sr = 0
    let sg = 0
    let sb = 0
    for (let k = -r; k <= r; k++) {
      const y = Math.max(0, Math.min(height - 1, k))
      const i = (y * width + x) * 4
      sr += tmp[i]
      sg += tmp[i + 1]
      sb += tmp[i + 2]
    }
    for (let y = 0; y < height; y++) {
      const o = (y * width + x) * 4
      out[o] = sr * inv
      out[o + 1] = sg * inv
      out[o + 2] = sb * inv
      out[o + 3] = tmp[o + 3]
      const addY = Math.min(height - 1, y + r + 1)
      const subY = Math.max(0, y - r)
      const ia = (addY * width + x) * 4
      const is = (subY * width + x) * 4
      sr += tmp[ia] - tmp[is]
      sg += tmp[ia + 1] - tmp[is + 1]
      sb += tmp[ia + 2] - tmp[is + 2]
    }
  }
  return out
}

function sampleBilinear(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  fx: number,
  fy: number,
): [number, number, number] {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(fx)))
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(fy)))
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const tx = fx - x0
  const ty = fy - y0
  const i00 = (y0 * width + x0) * 4
  const i10 = (y0 * width + x1) * 4
  const i01 = (y1 * width + x0) * 4
  const i11 = (y1 * width + x1) * 4
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t
  return [
    lerp(lerp(src[i00], src[i10], tx), lerp(src[i01], src[i11], tx), ty),
    lerp(lerp(src[i00 + 1], src[i10 + 1], tx), lerp(src[i01 + 1], src[i11 + 1], tx), ty),
    lerp(lerp(src[i00 + 2], src[i10 + 2], tx), lerp(src[i01 + 2], src[i11 + 2], tx), ty),
  ]
}

function sampleBilinearScalar(
  src: Float32Array,
  width: number,
  height: number,
  fx: number,
  fy: number,
): number {
  const x0 = Math.max(0, Math.min(width - 1, Math.floor(fx)))
  const y0 = Math.max(0, Math.min(height - 1, Math.floor(fy)))
  const x1 = Math.min(width - 1, x0 + 1)
  const y1 = Math.min(height - 1, y0 + 1)
  const tx = fx - x0
  const ty = fy - y0
  const v00 = src[y0 * width + x0]
  const v10 = src[y0 * width + x1]
  const v01 = src[y1 * width + x0]
  const v11 = src[y1 * width + x1]
  return (v00 * (1 - tx) + v10 * tx) * (1 - ty) + (v01 * (1 - tx) + v11 * tx) * ty
}
