/**
 * Auto colour correction.
 *
 * 1. Grey-world white balance (blended, so strongly tinted scenes are not
 *    fully neutralised).
 * 2. Per-channel histogram stretch with light clipping at both ends.
 * 3. Gentle S-curve for mid-tone contrast.
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
  contrast: 0.12,
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

  // --- histograms after white balance --------------------------------------
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)]
  const gains = [gainR, gainG, gainB]
  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let v = data[i + c] * gains[c]
      v = v < 0 ? 0 : v > 255 ? 255 : v
      data[i + c] = v
      hist[c][Math.round(v)]++
    }
  }

  const clip = Math.max(1, Math.floor(n * params.clipPercent))
  const luts: Uint8ClampedArray[] = []
  for (let c = 0; c < 3; c++) {
    let lo = 0
    let acc = 0
    while (lo < 255 && acc + hist[c][lo] < clip) acc += hist[c][lo++]
    let hi = 255
    acc = 0
    while (hi > 0 && acc + hist[c][hi] < clip) acc += hist[c][hi--]
    if (hi - lo < 16) {
      lo = Math.max(0, lo - 8)
      hi = Math.min(255, hi + 8)
    }
    const lut = new Uint8ClampedArray(256)
    const scale = 255 / (hi - lo || 1)
    for (let v = 0; v < 256; v++) {
      let t = (v - lo) * scale
      t = t < 0 ? 0 : t > 255 ? 255 : t
      // S-curve around mid-grey; strength scales the sigmoid mix.
      const x = t / 255
      const s = x * x * (3 - 2 * x)
      lut[v] = (x + (s - x) * params.contrast) * 255
    }
    luts.push(lut)
  }

  for (let i = 0; i < data.length; i += 4) {
    data[i] = luts[0][data[i]]
    data[i + 1] = luts[1][data[i + 1]]
    data[i + 2] = luts[2][data[i + 2]]
  }
  return data
}
