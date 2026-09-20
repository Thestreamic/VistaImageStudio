/**
 * Object removal by multi-scale diffusion inpainting, plus optional LaMa ONNX.
 *
 * The image and mask are downsampled into a pyramid. At the coarsest level the
 * hole is filled by iterated neighbour averaging (a Laplacian/heat-equation
 * solve), then each finer level is initialised from the coarser result and
 * refined with fewer iterations. This is the classic "smooth fill" approach:
 * fast, deterministic and good for skies, walls and soft backgrounds.
 *
 * Magic Eraser prefers bundled Carve/LaMa-ONNX (`public/models/lama.onnx`,
 * fixed 512×512, inputs `image` + `mask`). The hole is zeroed before inference
 * (LaMa does not "see through" a mask on its own). Diffusion is the fallback
 * when the ONNX is missing.
 */

import { loadOrtWasm, resolvePublicHref } from '@/features/ai/ort-runtime'

interface Level {
  width: number
  height: number
  rgb: Float32Array // 3 channels
  mask: Uint8Array // 1 = hole
}

function downsample(level: Level): Level {
  const w = Math.max(1, Math.floor(level.width / 2))
  const h = Math.max(1, Math.floor(level.height / 2))
  const rgb = new Float32Array(w * h * 3)
  const mask = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0
      let g = 0
      let b = 0
      let known = 0
      for (let dy = 0; dy < 2; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const sx = Math.min(level.width - 1, x * 2 + dx)
          const sy = Math.min(level.height - 1, y * 2 + dy)
          const si = sy * level.width + sx
          if (!level.mask[si]) {
            r += level.rgb[si * 3]
            g += level.rgb[si * 3 + 1]
            b += level.rgb[si * 3 + 2]
            known++
          }
        }
      }
      const oi = y * w + x
      if (known > 0) {
        rgb[oi * 3] = r / known
        rgb[oi * 3 + 1] = g / known
        rgb[oi * 3 + 2] = b / known
      } else {
        mask[oi] = 1
      }
    }
  }
  return { width: w, height: h, rgb, mask }
}

function diffuse(level: Level, iterations: number) {
  const { width, height, rgb, mask } = level
  const holes: number[] = []
  for (let i = 0; i < mask.length; i++) if (mask[i]) holes.push(i)
  if (!holes.length) return
  for (let it = 0; it < iterations; it++) {
    for (let k = 0; k < holes.length; k++) {
      const i = holes[k]
      const x = i % width
      const y = (i - x) / width
      let r = 0
      let g = 0
      let b = 0
      let n = 0
      if (x > 0) {
        r += rgb[(i - 1) * 3]
        g += rgb[(i - 1) * 3 + 1]
        b += rgb[(i - 1) * 3 + 2]
        n++
      }
      if (x < width - 1) {
        r += rgb[(i + 1) * 3]
        g += rgb[(i + 1) * 3 + 1]
        b += rgb[(i + 1) * 3 + 2]
        n++
      }
      if (y > 0) {
        r += rgb[(i - width) * 3]
        g += rgb[(i - width) * 3 + 1]
        b += rgb[(i - width) * 3 + 2]
        n++
      }
      if (y < height - 1) {
        r += rgb[(i + width) * 3]
        g += rgb[(i + width) * 3 + 1]
        b += rgb[(i + width) * 3 + 2]
        n++
      }
      if (n) {
        rgb[i * 3] = r / n
        rgb[i * 3 + 1] = g / n
        rgb[i * 3 + 2] = b / n
      }
    }
  }
}

/** Copies coarse hole values up into the fine level as an initial guess. */
function upsampleInto(coarse: Level, fine: Level) {
  for (let y = 0; y < fine.height; y++) {
    for (let x = 0; x < fine.width; x++) {
      const i = y * fine.width + x
      if (!fine.mask[i]) continue
      const cx = Math.min(coarse.width - 1, x >> 1)
      const cy = Math.min(coarse.height - 1, y >> 1)
      const ci = cy * coarse.width + cx
      fine.rgb[i * 3] = coarse.rgb[ci * 3]
      fine.rgb[i * 3 + 1] = coarse.rgb[ci * 3 + 1]
      fine.rgb[i * 3 + 2] = coarse.rgb[ci * 3 + 2]
    }
  }
}

export function inpaint(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  mask: Uint8ClampedArray,
  onProgress?: (p: number) => void,
): Uint8ClampedArray {
  const base: Level = {
    width,
    height,
    rgb: new Float32Array(width * height * 3),
    mask: new Uint8Array(width * height),
  }
  let holeCount = 0
  for (let i = 0; i < width * height; i++) {
    base.rgb[i * 3] = data[i * 4]
    base.rgb[i * 3 + 1] = data[i * 4 + 1]
    base.rgb[i * 3 + 2] = data[i * 4 + 2]
    if (mask[i] > 127) {
      base.mask[i] = 1
      holeCount++
    }
  }
  if (!holeCount) return data

  const pyramid: Level[] = [base]
  while (pyramid[pyramid.length - 1].width > 24 && pyramid[pyramid.length - 1].height > 24) {
    pyramid.push(downsample(pyramid[pyramid.length - 1]))
  }

  const coarsest = pyramid[pyramid.length - 1]
  diffuse(coarsest, 400)
  for (let l = pyramid.length - 2; l >= 0; l--) {
    upsampleInto(pyramid[l + 1], pyramid[l])
    // Finer levels need fewer sweeps because they start from a good guess.
    diffuse(pyramid[l], l === 0 ? 12 : 30)
    onProgress?.(1 - l / pyramid.length)
  }

  for (let i = 0; i < width * height; i++) {
    if (!base.mask[i]) continue
    data[i * 4] = base.rgb[i * 3]
    data[i * 4 + 1] = base.rgb[i * 3 + 1]
    data[i * 4 + 2] = base.rgb[i * 3 + 2]
    data[i * 4 + 3] = 255
  }
  return data
}

export const inpaintDiffusion = inpaint

/** Carve/LaMa-ONNX lama_fp32.onnx — fixed spatial size. */
export const LAMA_MODEL_SIZE = 512
export const LAMA_URL = '/models/lama.onnx'

type OrtSession = {
  inputNames: readonly string[]
  outputNames: readonly string[]
  run: (feeds: Record<string, unknown>) => Promise<Record<string, { data: unknown; dims?: readonly number[] }>>
}

let lamaSession: Promise<OrtSession> | null = null

export type InpaintBackend = 'lama' | 'diffusion'

export type InpaintResult = {
  data: Uint8ClampedArray
  backend: InpaintBackend
}

function lamaModelHref(modelUrl = LAMA_URL): string {
  if (/^(https?:|blob:|file:)/i.test(modelUrl)) return modelUrl
  return resolvePublicHref(modelUrl)
}

async function getLamaSession(modelUrl = LAMA_URL): Promise<OrtSession> {
  if (!lamaSession) {
    lamaSession = (async () => {
      const ort = await loadOrtWasm()
      return (await ort.InferenceSession.create(lamaModelHref(modelUrl), {
        executionProviders: ['wasm'],
      })) as unknown as OrtSession
    })()
  }
  try {
    return await lamaSession
  } catch (err) {
    lamaSession = null
    const detail = err instanceof Error ? err.message : String(err)
    throw new Error(`Magic Eraser model failed (${modelUrl}): ${detail}`)
  }
}

/** Grow a hole mask so object edges are fully covered. */
export function dilateHoleMask(mask: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
  const r = Math.max(0, Math.round(radius))
  if (r <= 0) return mask.slice()
  const tmp = new Uint8ClampedArray(mask.length)
  const out = new Uint8ClampedArray(mask.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m = 0
      for (let k = -r; k <= r; k++) {
        const xx = x + k
        if (xx >= 0 && xx < width) m = Math.max(m, mask[y * width + xx])
      }
      tmp[y * width + x] = m
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let m = 0
      for (let k = -r; k <= r; k++) {
        const yy = y + k
        if (yy >= 0 && yy < height) m = Math.max(m, tmp[yy * width + x])
      }
      out[y * width + x] = m
    }
  }
  return out
}

/**
 * Removes the masked region and fills it with plausible content.
 * `maskData` — same width/height as image, 0–255. 255 = erase this pixel.
 */
export async function removeObject(
  imageData: Uint8ClampedArray,
  maskData: Uint8ClampedArray,
  width: number,
  height: number,
  modelUrl = LAMA_URL,
): Promise<Uint8ClampedArray> {
  const sess = await getLamaSession(modelUrl)
  const ort = await loadOrtWasm()
  const hole = dilateHoleMask(maskData, width, height, 6)

  const scale = Math.min(1, LAMA_MODEL_SIZE / Math.max(width, height))
  const scaledW = Math.max(1, Math.round(width * scale))
  const scaledH = Math.max(1, Math.round(height * scale))
  const padW = LAMA_MODEL_SIZE
  const padH = LAMA_MODEL_SIZE

  const resizedImage = resizeRgba(imageData, width, height, scaledW, scaledH)
  const resizedMask = resizeMask(hole, width, height, scaledW, scaledH)
  const paddedImage = padRgba(resizedImage, scaledW, scaledH, padW, padH)
  const paddedMask = padMask(resizedMask, scaledW, scaledH, padW, padH)
  const blankedImage = applyMaskHole(paddedImage, paddedMask, padW, padH)

  const imageTensorData = rgbaToNchw01(blankedImage, padW, padH)
  const maskTensorData = maskToNchw01(paddedMask, padW, padH)
  const imageTensor = new ort.Tensor('float32', imageTensorData, [1, 3, padH, padW])
  const maskTensor = new ort.Tensor('float32', maskTensorData, [1, 1, padH, padW])
  const feeds = lamaFeeds(sess, imageTensor, maskTensor)
  const results = await sess.run(feeds)
  const outputName = sess.outputNames[0]
  const outputData = results[outputName].data as Float32Array

  const outputRgbaPadded = nchwToRgba(outputData, padW, padH)
  const outputRgbaScaled = unpadRgba(outputRgbaPadded, padW, padH, scaledW, scaledH)
  const outputFullRes = upsampleRgba(outputRgbaScaled, scaledW, scaledH, width, height)
  return compositeInpaint(imageData, outputFullRes, hole, width, height)
}

export function lamaFeeds(
  session: { inputNames: readonly string[] },
  image: unknown,
  mask: unknown,
): Record<string, unknown> {
  const names = session.inputNames
  const imageName = names.find((n) => /image|input/i.test(n) && !/mask/i.test(n)) ?? names[0]
  const maskName = names.find((n) => /mask/i.test(n)) ?? names[1] ?? names[0]
  return { [imageName]: image, [maskName]: mask }
}

/** LaMa when the ONNX is present; diffusion fill otherwise. */
export async function inpaintObject(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  maskData: Uint8ClampedArray,
  onProgress?: (p: number, detail?: string) => void,
): Promise<InpaintResult> {
  let holeCount = 0
  for (let i = 0; i < maskData.length; i++) if (maskData[i] > 127) holeCount++
  if (!holeCount) return { data: imageData, backend: 'diffusion' }

  onProgress?.(0.05, 'Loading Magic Eraser…')
  try {
    onProgress?.(0.2, 'Filling the selection…')
    const data = await removeObject(imageData, maskData, width, height)
    onProgress?.(1, 'Done')
    return { data, backend: 'lama' }
  } catch {
    onProgress?.(0.35, 'Filling region…')
    const data = inpaint(imageData, width, height, maskData, (p) => onProgress?.(0.35 + p * 0.6))
    onProgress?.(1, 'Done')
    return { data, backend: 'diffusion' }
  }
}

export function applyMaskHole(rgba: Uint8ClampedArray, mask: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(rgba)
  const n = Math.min(w * h, mask.length, (out.length / 4) | 0)
  for (let i = 0; i < n; i++) {
    if (mask[i] > 127) {
      const px = i * 4
      out[px] = 0
      out[px + 1] = 0
      out[px + 2] = 0
    }
  }
  return out
}

export function compositeInpaint(
  original: Uint8ClampedArray,
  inpainted: Uint8ClampedArray,
  mask: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8ClampedArray {
  const feathered = featherMask(mask, width, height, 3)
  const out = new Uint8ClampedArray(original.length)
  const n = width * height
  for (let i = 0; i < n; i++) {
    const px = i * 4
    const a = feathered[i] / 255
    out[px] = original[px] * (1 - a) + inpainted[px] * a
    out[px + 1] = original[px + 1] * (1 - a) + inpainted[px + 1] * a
    out[px + 2] = original[px + 2] * (1 - a) + inpainted[px + 2] * a
    out[px + 3] = original[px + 3]
  }
  return out
}

export function rgbaToNchw01(rgba: Uint8ClampedArray, w: number, h: number): Float32Array {
  const plane = w * h
  const out = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    const px = i * 4
    out[i] = rgba[px] / 255
    out[plane + i] = rgba[px + 1] / 255
    out[2 * plane + i] = rgba[px + 2] / 255
  }
  return out
}

/** Carve/LaMa output is commonly already 0–255; some exports are 0–1. */
export function nchwToRgba(data: Float32Array, w: number, h: number): Uint8ClampedArray {
  const plane = w * h
  let max = 0
  const n = Math.min(data.length, 3 * plane)
  for (let i = 0; i < n; i++) if (data[i] > max) max = data[i]
  const scale = max > 2 ? 1 : 255
  const out = new Uint8ClampedArray(plane * 4)
  for (let i = 0; i < plane; i++) {
    const px = i * 4
    out[px] = clamp255(data[i] * scale)
    out[px + 1] = clamp255(data[plane + i] * scale)
    out[px + 2] = clamp255(data[2 * plane + i] * scale)
    out[px + 3] = 255
  }
  return out
}

export function maskToNchw01(mask: Uint8ClampedArray, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) out[i] = mask[i] > 127 ? 1 : 0
  return out
}

function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

function resizeRgba(src: Uint8ClampedArray, sw: number, sh: number, dw: number, dh: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dw * dh * 4)
  const xScale = sw / dw
  const yScale = sh / dh
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor(y * yScale))
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor(x * xScale))
      const si = (sy * sw + sx) * 4
      const di = (y * dw + x) * 4
      out[di] = src[si]
      out[di + 1] = src[si + 1]
      out[di + 2] = src[si + 2]
      out[di + 3] = src[si + 3]
    }
  }
  return out
}

function resizeMask(src: Uint8ClampedArray, sw: number, sh: number, dw: number, dh: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dw * dh)
  const xScale = sw / dw
  const yScale = sh / dh
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor(y * yScale))
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor(x * xScale))
      out[y * dw + x] = src[sy * sw + sx]
    }
  }
  return out
}

export function padRgba(src: Uint8ClampedArray, sw: number, sh: number, dw: number, dh: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dw * dh * 4)
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const si = (y * sw + x) * 4
      const di = (y * dw + x) * 4
      out[di] = src[si]
      out[di + 1] = src[si + 1]
      out[di + 2] = src[si + 2]
      out[di + 3] = src[si + 3]
    }
  }
  reflectPadBorder(out, sw, sh, dw, dh)
  return out
}

export function padMask(src: Uint8ClampedArray, sw: number, sh: number, dw: number, dh: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dw * dh)
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) out[y * dw + x] = src[y * sw + x]
  }
  return out
}

function reflectIndex(i: number, size: number): number {
  if (size <= 1) return 0
  if (i < 0) i = -i
  const period = (size - 1) * 2
  i %= period
  return i < size ? i : period - i
}

function reflectPadBorder(rgba: Uint8ClampedArray, sw: number, sh: number, dw: number, dh: number) {
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      if (y < sh && x < sw) continue
      const sx = reflectIndex(x, sw)
      const sy = reflectIndex(y, sh)
      const si = (sy * dw + sx) * 4
      const di = (y * dw + x) * 4
      rgba[di] = rgba[si]
      rgba[di + 1] = rgba[si + 1]
      rgba[di + 2] = rgba[si + 2]
      rgba[di + 3] = rgba[si + 3]
    }
  }
}

export function unpadRgba(src: Uint8ClampedArray, sw: number, sh: number, dw: number, dh: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dw * dh * 4)
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const si = (y * sw + x) * 4
      const di = (y * dw + x) * 4
      out[di] = src[si]
      out[di + 1] = src[si + 1]
      out[di + 2] = src[si + 2]
      out[di + 3] = src[si + 3]
    }
  }
  return out
}

function upsampleRgba(src: Uint8ClampedArray, sw: number, sh: number, dw: number, dh: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(dw * dh * 4)
  const xScale = (sw - 1) / Math.max(1, dw - 1)
  const yScale = (sh - 1) / Math.max(1, dh - 1)
  for (let y = 0; y < dh; y++) {
    const fy = y * yScale
    const y0 = Math.floor(fy)
    const y1 = Math.min(sh - 1, y0 + 1)
    const ty = fy - y0
    for (let x = 0; x < dw; x++) {
      const fx = x * xScale
      const x0 = Math.floor(fx)
      const x1 = Math.min(sw - 1, x0 + 1)
      const tx = fx - x0
      const di = (y * dw + x) * 4
      for (let c = 0; c < 4; c++) {
        const s00 = src[(y0 * sw + x0) * 4 + c]
        const s10 = src[(y0 * sw + x1) * 4 + c]
        const s01 = src[(y1 * sw + x0) * 4 + c]
        const s11 = src[(y1 * sw + x1) * 4 + c]
        out[di + c] = s00 * (1 - tx) * (1 - ty) + s10 * tx * (1 - ty) + s01 * (1 - tx) * ty + s11 * tx * ty
      }
    }
  }
  return out
}

function featherMask(mask: Uint8ClampedArray, width: number, height: number, radius: number): Uint8ClampedArray {
  const r = Math.round(radius)
  if (r <= 0) return mask.slice()
  const tmp = new Float32Array(mask.length)
  const out = new Uint8ClampedArray(mask.length)
  const norm = 1 / (r * 2 + 1)
  for (let y = 0; y < height; y++) {
    let acc = 0
    for (let x = -r; x <= r; x++) acc += mask[y * width + clampi(x, 0, width - 1)]
    for (let x = 0; x < width; x++) {
      tmp[y * width + x] = acc * norm
      acc += mask[y * width + clampi(x + r + 1, 0, width - 1)] - mask[y * width + clampi(x - r, 0, width - 1)]
    }
  }
  for (let x = 0; x < width; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[clampi(y, 0, height - 1) * width + x]
    for (let y = 0; y < height; y++) {
      out[y * width + x] = Math.round(acc * norm)
      acc += tmp[clampi(y + r + 1, 0, height - 1) * width + x] - tmp[clampi(y - r, 0, height - 1) * width + x]
    }
  }
  return out
}

function clampi(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}
