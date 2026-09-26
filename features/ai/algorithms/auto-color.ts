/**
 * Auto colour correction.
 *
 * 1. Grey-world white balance (blended, so strongly tinted scenes are not
 *    fully neutralised).
 * 2. One Rec.709 luminance stretch, clipped the same amount at each end.
 * 3. Gentle S-curve on that luminance. R, G, and B share the luma gain so
 *    chroma ratios survive.
 *
 * Runs in a Web Worker; operates in place on RGBA data.
 */
export interface AutoColorParams {
  whiteBalance: number // 0..1 blend of grey-world correction
  clipPercent: number // fraction of pixels clipped per side (0.005 = 0.5%)
  contrast: number // 0..1 strength of the S-curve
}

export const DEFAULT_AUTO_COLOR: AutoColorParams = {
  whiteBalance: 0.25,
  clipPercent: 0.002,
  contrast: 0.1,
}

export function autoColor(
  data: Uint8ClampedArray,
  params: AutoColorParams = DEFAULT_AUTO_COLOR,
): Uint8ClampedArray {
  const n = data.length / 4
  if (n === 0) return data

  // --- grey-world means -----------------------------------------------------
  let sr = 0
  let sg = 0
  let sb = 0
  for (let i = 0; i < data.length; i += 4) {
    sr += data[i]
    sg += data[i + 1]
    sb += data[i + 2]
  }
  const mr = sr / n || 1
  const mg = sg / n || 1
  const mb = sb / n || 1
  const grey = (mr + mg + mb) / 3
  const wb = params.whiteBalance
  const gainR = 1 + ((grey / mr) - 1) * wb
  const gainG = 1 + ((grey / mg) - 1) * wb
  const gainB = 1 + ((grey / mb) - 1) * wb

  // --- one luminance histogram after white balance -------------------------
  const hist = new Uint32Array(256)
  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] * gainR
    let g = data[i + 1] * gainG
    let b = data[i + 2] * gainB
    r = r < 0 ? 0 : r > 255 ? 255 : r
    g = g < 0 ? 0 : g > 255 ? 255 : g
    b = b < 0 ? 0 : b > 255 ? 255 : b
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    const y = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b)
    hist[y < 0 ? 0 : y > 255 ? 255 : y]++
  }

  const clip = Math.max(1, Math.floor(n * params.clipPercent))
  let lo = 0
  let acc = 0
  while (lo < 255 && acc + hist[lo] < clip) acc += hist[lo++]
  let hi = 255
  acc = 0
  while (hi > 0 && acc + hist[hi] < clip) acc += hist[hi--]
  if (hi - lo < 16) {
    lo = Math.max(0, lo - 8)
    hi = Math.min(255, hi + 8)
  }
  const lut = new Float32Array(256)
  const scale = 255 / (hi - lo || 1)
  for (let v = 0; v < 256; v++) {
    let t = (v - lo) * scale
    t = t < 0 ? 0 : t > 255 ? 255 : t
    const x = t / 255
    const s = x * x * (3 - 2 * x)
    lut[v] = (x + (s - x) * params.contrast) * 255
  }

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b
    if (y < 1) continue
    const gain = lut[Math.round(Math.min(255, y))] / y
    let nr = r * gain
    let ng = g * gain
    let nb = b * gain
    data[i] = nr < 0 ? 0 : nr > 255 ? 255 : nr
    data[i + 1] = ng < 0 ? 0 : ng > 255 ? 255 : ng
    data[i + 2] = nb < 0 ? 0 : nb > 255 ? 255 : nb
  }
  return data
}
