/**
 * Shared spatial filters used by the denoise, upscale and face enhancement
 * pipelines. All functions are pure over RGBA buffers.
 */

/** Separable Gaussian blur, returns a new buffer. Alpha is copied through. */
export function gaussianBlur(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  const r = Math.max(1, Math.round(radius))
  const sigma = r / 2
  const kernel = new Float32Array(r * 2 + 1)
  let sum = 0
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / (2 * sigma * sigma))
    kernel[i + r] = v
    sum += v
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum

  const tmp = new Float32Array(src.length)
  const out = new Uint8ClampedArray(src.length)

  // horizontal
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      let rr = 0
      let gg = 0
      let bb = 0
      for (let k = -r; k <= r; k++) {
        let xx = x + k
        if (xx < 0) xx = 0
        else if (xx >= width) xx = width - 1
        const p = (row + xx) * 4
        const w = kernel[k + r]
        rr += src[p] * w
        gg += src[p + 1] * w
        bb += src[p + 2] * w
      }
      const o = (row + x) * 4
      tmp[o] = rr
      tmp[o + 1] = gg
      tmp[o + 2] = bb
      tmp[o + 3] = src[o + 3]
    }
  }
  // vertical
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let rr = 0
      let gg = 0
      let bb = 0
      for (let k = -r; k <= r; k++) {
        let yy = y + k
        if (yy < 0) yy = 0
        else if (yy >= height) yy = height - 1
        const p = (yy * width + x) * 4
        const w = kernel[k + r]
        rr += tmp[p] * w
        gg += tmp[p + 1] * w
        bb += tmp[p + 2] * w
      }
      const o = (y * width + x) * 4
      out[o] = rr
      out[o + 1] = gg
      out[o + 2] = bb
      out[o + 3] = src[o + 3]
    }
  }
  return out
}

/**
 * Unsharp mask: out = src + amount * (src - blur(src)), with a threshold so
 * flat regions (and noise) are left alone. Returns a new buffer.
 */
export function unsharpMask(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  amount: number,
  threshold = 2,
): Uint8ClampedArray {
  const blurred = gaussianBlur(src, width, height, radius)
  const out = new Uint8ClampedArray(src.length)
  for (let i = 0; i < src.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const d = src[i + c] - blurred[i + c]
      out[i + c] = Math.abs(d) > threshold ? src[i + c] + d * amount : src[i + c]
    }
    out[i + 3] = src[i + 3]
  }
  return out
}

/**
 * Bilateral filter: edge-preserving smoothing. Pixels are averaged with
 * neighbours weighted by both spatial distance and colour similarity, so
 * noise is flattened while edges stay crisp. O(N * (2r+1)^2); keep r <= 4.
 */
export function bilateralFilter(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
  sigmaColor: number,
  mask?: Uint8ClampedArray,
): Uint8ClampedArray {
  const r = Math.max(1, Math.min(4, Math.round(radius)))
  const sigmaSpace = r
  const spatial = new Float32Array((2 * r + 1) * (2 * r + 1))
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      spatial[(dy + r) * (2 * r + 1) + (dx + r)] = Math.exp(
        -(dx * dx + dy * dy) / (2 * sigmaSpace * sigmaSpace),
      )
    }
  }
  const colorLut = new Float32Array(256 * 3)
  const twoSigma2 = 2 * sigmaColor * sigmaColor
  for (let d = 0; d < colorLut.length; d++) colorLut[d] = Math.exp(-(d * d) / twoSigma2)

  const out = new Uint8ClampedArray(src.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const m = mask ? mask[y * width + x] / 255 : 1
      if (m === 0) {
        out[i] = src[i]
        out[i + 1] = src[i + 1]
        out[i + 2] = src[i + 2]
        out[i + 3] = src[i + 3]
        continue
      }
      const cr = src[i]
      const cg = src[i + 1]
      const cb = src[i + 2]
      let wr = 0
      let wg = 0
      let wb = 0
      let wsum = 0
      for (let dy = -r; dy <= r; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= height) continue
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= width) continue
          const j = (yy * width + xx) * 4
          const dist = Math.abs(src[j] - cr) + Math.abs(src[j + 1] - cg) + Math.abs(src[j + 2] - cb)
          const w = spatial[(dy + r) * (2 * r + 1) + (dx + r)] * colorLut[dist]
          wr += src[j] * w
          wg += src[j + 1] * w
          wb += src[j + 2] * w
          wsum += w
        }
      }
      const fr = wr / wsum
      const fg = wg / wsum
      const fb = wb / wsum
      out[i] = cr + (fr - cr) * m
      out[i + 1] = cg + (fg - cg) * m
      out[i + 2] = cb + (fb - cb) * m
      out[i + 3] = src[i + 3]
    }
  }
  return out
}

/** Returns a 0..255 skin-likelihood mask using YCbCr thresholds. */
export function skinMask(src: Uint8ClampedArray, width: number, height: number): Uint8ClampedArray {
  const mask = new Uint8ClampedArray(width * height)
  for (let p = 0, i = 0; p < mask.length; p++, i += 4) {
    const r = src[i]
    const g = src[i + 1]
    const b = src[i + 2]
    const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b
    const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
    const inRange = cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && r > g && r > b
    if (inRange) {
      // Soft edges: distance from the centre of the skin cluster.
      const dcb = Math.abs(cb - 102) / 25
      const dcr = Math.abs(cr - 153) / 20
      const d = Math.max(dcb, dcr)
      mask[p] = (1 - Math.min(1, d) * 0.6) * 255
    }
  }
  return gaussianBlurMask(mask, width, height, 3)
}

function gaussianBlurMask(
  mask: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  // Reuse the RGBA blur by expanding to a single-channel RGBA buffer.
  const rgba = new Uint8ClampedArray(mask.length * 4)
  for (let i = 0; i < mask.length; i++) rgba[i * 4] = mask[i]
  const blurred = gaussianBlur(rgba, width, height, radius)
  const out = new Uint8ClampedArray(mask.length)
  for (let i = 0; i < mask.length; i++) out[i] = blurred[i * 4]
  return out
}
