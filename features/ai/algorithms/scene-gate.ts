/**
 * Scene-aware gates so conservative local AI does not bake extra punch
 * into already-processed iPhone photos.
 */
export interface SceneStats {
  medianLuma: number
  lumaContrast: number
  meanR: number
  meanG: number
  meanB: number
  meanSat: number
  haze: number
  noise: number
  edge: number
}

function luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function sceneStats(data: Uint8ClampedArray, width: number, height: number): SceneStats {
  const hist = new Uint32Array(256)
  let sr = 0
  let sg = 0
  let sb = 0
  let sat = 0
  let dark = 0
  let noise = 0
  let noiseN = 0
  let edge = 0
  let edgeN = 0
  let n = 0
  const step = Math.max(1, Math.floor(Math.min(width, height) / 96))

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const i = (y * width + x) * 4
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      const yv = Math.max(0, Math.min(255, Math.round(luma(r, g, b))))
      hist[yv]++
      sr += r
      sg += g
      sb += b
      sat += Math.max(r, g, b) - Math.min(r, g, b)
      dark += Math.min(r, g, b)
      n++
      if (x + step < width) {
        const j = (y * width + x + step) * 4
        const ny = luma(data[j], data[j + 1], data[j + 2])
        const d = Math.abs(yv - ny)
        edge += d
        edgeN++
        // Cap edge spikes so grain in flats still registers as noise.
        noise += Math.min(d, 10)
        noiseN++
      }
    }
  }

  const count = Math.max(1, n)
  let acc = 0
  const mid = count / 2
  let median = 128
  for (let v = 0; v < 256; v++) {
    acc += hist[v]
    if (acc >= mid) {
      median = v
      break
    }
  }
  let loAcc = 0
  let hiAcc = 0
  let p5 = 0
  let p95 = 255
  const loNeed = count * 0.05
  const hiNeed = count * 0.05
  for (let v = 0; v < 256; v++) {
    loAcc += hist[v]
    if (loAcc >= loNeed) {
      p5 = v
      break
    }
  }
  for (let v = 255; v >= 0; v--) {
    hiAcc += hist[v]
    if (hiAcc >= hiNeed) {
      p95 = v
      break
    }
  }

  return {
    medianLuma: median,
    lumaContrast: p95 - p5,
    meanR: sr / count,
    meanG: sg / count,
    meanB: sb / count,
    meanSat: sat / count,
    haze: dark / count / 255,
    noise: noiseN ? noise / noiseN : 0,
    edge: edgeN ? edge / edgeN : 0,
  }
}

export function shouldSkipAutoColor(stats: SceneStats): boolean {
  const spread = Math.max(stats.meanR, stats.meanG, stats.meanB) - Math.min(stats.meanR, stats.meanG, stats.meanB)
  const wellExposed = stats.medianLuma > 70 && stats.medianLuma < 190
  if (!wellExposed) return false
  if (stats.lumaContrast > 85) return true
  return spread < 18 && stats.lumaContrast > 45
}

export function shouldSkipDenoise(stats: SceneStats): boolean {
  return stats.noise < 6
}

export function shouldSkipLowLight(stats: SceneStats): boolean {
  return stats.medianLuma >= 72
}

export function shouldSkipDehaze(stats: SceneStats): boolean {
  return stats.haze < 0.48
}

export function shouldSkipClarity(stats: SceneStats): boolean {
  return stats.edge > 18
}

export function shouldSkipVibrance(stats: SceneStats): boolean {
  return stats.meanSat > 48
}

export function skinFraction(mask: Uint8ClampedArray): number {
  if (mask.length === 0) return 0
  let sum = 0
  for (let i = 0; i < mask.length; i++) sum += mask[i]
  return sum / (mask.length * 255)
}

export function shouldSkipFaceEnhance(fraction: number): boolean {
  return fraction < 0.08 || fraction > 0.45
}

export function shouldSkipUpscale(width: number, height: number): boolean {
  return Math.max(width, height) >= 2000
}

/** Heuristic matte is only safe on a simple subject-vs-backdrop cutout. */
export function matteIsTrustworthy(matte: Uint8ClampedArray, width: number, height: number): boolean {
  let cleared = 0
  let center = 0
  let centerN = 0
  const x0 = Math.floor(width * 0.35)
  const x1 = Math.ceil(width * 0.65)
  const y0 = Math.floor(height * 0.35)
  const y1 = Math.ceil(height * 0.65)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = y * width + x
      if (matte[p] < 8) cleared++
      if (x >= x0 && x < x1 && y >= y0 && y < y1) {
        center += matte[p]
        centerN++
      }
    }
  }
  const frac = cleared / Math.max(1, matte.length)
  const centerMean = centerN ? center / centerN / 255 : 0
  return frac >= 0.15 && frac <= 0.85 && centerMean >= 0.7
}
