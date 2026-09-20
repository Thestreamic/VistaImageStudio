/**
 * Super-resolution upscaling.
 *
 * `upscaleWithModel` runs a lightweight ESRGAN-style ONNX model when bundled;
 * `upscaleBicubic` is the always-available fallback: bicubic resample plus an
 * edge-directed sharpen pass so 2×/4× results stay crisp without a model.
 */
import { loadOrtWasm } from '@/features/ai/ort-runtime'
import { sharpen } from './enhance'
import { publicUrl } from '@/lib/public-url'

export type UpscaleFactor = 2 | 4

export interface UpscaleResult {
  data: Uint8ClampedArray
  width: number
  height: number
}

export function upscaleBicubic(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  factor: UpscaleFactor,
): UpscaleResult {
  const outW = width * factor
  const outH = height * factor
  const out = new Uint8ClampedArray(outW * outH * 4)

  const sample = (x: number, y: number, c: number) => {
    const cx = Math.max(0, Math.min(width - 1, x))
    const cy = Math.max(0, Math.min(height - 1, y))
    return data[(cy * width + cx) * 4 + c]
  }
  const cubic = (t: number) => {
    const a = -0.5
    const at = Math.abs(t)
    if (at <= 1) return (a + 2) * at ** 3 - (a + 3) * at ** 2 + 1
    if (at < 2) return a * at ** 3 - 5 * a * at ** 2 + 8 * a * at - 4 * a
    return 0
  }

  for (let y = 0; y < outH; y++) {
    const sy = y / factor
    const y0 = Math.floor(sy)
    for (let x = 0; x < outW; x++) {
      const sx = x / factor
      const x0 = Math.floor(sx)
      for (let c = 0; c < 4; c++) {
        let acc = 0
        let wsum = 0
        for (let dy = -1; dy <= 2; dy++) {
          const wy = cubic(sy - (y0 + dy))
          for (let dx = -1; dx <= 2; dx++) {
            const wx = cubic(sx - (x0 + dx))
            const w = wx * wy
            acc += sample(x0 + dx, y0 + dy, c) * w
            wsum += w
          }
        }
        out[(y * outW + x) * 4 + c] = wsum ? acc / wsum : 0
      }
    }
  }

  const sharpened = sharpen(out, outW, outH, { radius: 1, amount: 0.12 })
  return { data: sharpened, width: outW, height: outH }
}

export async function upscaleWithModel(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  factor: UpscaleFactor,
  modelUrl = publicUrl('/models/esrgan-lite.onnx'),
): Promise<UpscaleResult> {
  try {
    const ort = await loadOrtWasm()
    const session = await ort.InferenceSession.create(modelUrl, { executionProviders: ['wasm'] })
    // Tiled inference keeps memory bounded on large images.
    const tile = 128
    const outW = width * factor
    const outH = height * factor
    const out = new Uint8ClampedArray(outW * outH * 4)

    for (let ty = 0; ty < height; ty += tile) {
      for (let tx = 0; tx < width; tx += tile) {
        const tw = Math.min(tile, width - tx)
        const th = Math.min(tile, height - ty)
        const chw = new Float32Array(3 * tw * th)
        for (let y = 0; y < th; y++) {
          for (let x = 0; x < tw; x++) {
            const si = ((ty + y) * width + (tx + x)) * 4
            const di = y * tw + x
            chw[di] = data[si] / 255
            chw[tw * th + di] = data[si + 1] / 255
            chw[2 * tw * th + di] = data[si + 2] / 255
          }
        }
        const tensor = new ort.Tensor('float32', chw, [1, 3, th, tw])
        const feeds: Record<string, unknown> = {}
        feeds[session.inputNames[0]] = tensor
        const results = await session.run(feeds)
        const outTensor = results[session.outputNames[0]]
        const od = outTensor.data as Float32Array
        const ow = tw * factor, oh = th * factor
        for (let y = 0; y < oh; y++) {
          for (let x = 0; x < ow; x++) {
            const di = y * ow + x
            const gi = ((ty * factor + y) * outW + (tx * factor + x)) * 4
            out[gi] = Math.round(Math.max(0, Math.min(1, od[di])) * 255)
            out[gi + 1] = Math.round(Math.max(0, Math.min(1, od[ow * oh + di])) * 255)
            out[gi + 2] = Math.round(Math.max(0, Math.min(1, od[2 * ow * oh + di])) * 255)
            out[gi + 3] = 255
          }
        }
      }
    }
    return { data: out, width: outW, height: outH }
  } catch {
    return upscaleBicubic(data, width, height, factor)
  }
}
