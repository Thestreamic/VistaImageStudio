import { describe, it, expect } from 'vitest'
import {
  gatedAutoColor,
  gatedClarity,
  gatedDehaze,
  gatedDenoise,
  gatedFaceEnhance,
  gatedLowLight,
  gatedUpscale,
  gatedVibrance,
  gatedBackgroundRemove,
} from '@/features/ai/algorithms/gated'
import {
  sceneStats,
  shouldSkipAutoColor,
  shouldSkipDehaze,
  shouldSkipDenoise,
  shouldSkipLowLight,
  shouldSkipUpscale,
  shouldSkipVibrance,
} from '@/features/ai/algorithms/scene-gate'

function maxAbsDelta(a: Uint8ClampedArray, b: Uint8ClampedArray): number {
  let m = 0
  for (let i = 0; i < a.length; i++) {
    if (i % 4 === 3) continue
    const d = Math.abs(a[i] - b[i])
    if (d > m) m = d
  }
  return m
}

function meanLuma(buf: Uint8ClampedArray): number {
  let s = 0
  let n = 0
  for (let i = 0; i < buf.length; i += 4) {
    s += 0.2126 * buf[i] + 0.7152 * buf[i + 1] + 0.0722 * buf[i + 2]
    n++
  }
  return s / n
}

function chroma(buf: Uint8ClampedArray, i: number): number {
  return Math.max(buf[i], buf[i + 1], buf[i + 2]) - Math.min(buf[i], buf[i + 1], buf[i + 2])
}

/** Well-exposed, low-noise, vivid iPhone-like still. */
function iphoneLike(w = 64, h = 64): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      let r: number
      let g: number
      let b: number
      if (y < h * 0.08) {
        r = g = b = 58
      } else if (y > h * 0.92) {
        r = g = b = 210
      } else {
        const left = x < w / 2
        const lift = (y / h - 0.5) * 24
        r = (left ? 168 : 92) + lift
        g = (left ? 148 : 158) + lift
        b = (left ? 132 : 148) + lift
      }
      data[i] = Math.max(0, Math.min(255, r))
      data[i + 1] = Math.max(0, Math.min(255, g))
      data[i + 2] = Math.max(0, Math.min(255, b))
      data[i + 3] = 255
    }
  }
  return data
}

function darkFrame(w = 48, h = 48): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 28
    data[i + 1] = 24
    data[i + 2] = 32
    data[i + 3] = 255
  }
  return data
}

function hazyFrame(w = 40, h = 40): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4)
  const A = 220
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const inSubject = x > 12 && x < 28 && y > 12 && y < 28
      const t = inSubject ? 0.45 : 0.22
      const jr = inSubject ? 200 : 40
      const jg = inSubject ? 30 : 70
      const jb = inSubject ? 30 : 90
      data[i] = jr * t + A * (1 - t)
      data[i + 1] = jg * t + A * (1 - t)
      data[i + 2] = jb * t + A * (1 - t)
      data[i + 3] = 255
    }
  }
  return data
}

function mutedFrame(w = 24, h = 24): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 140
    data[i + 1] = 148
    data[i + 2] = 142
    data[i + 3] = 255
  }
  return data
}

function noisyFrame(w = 32, h = 32): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4)
  let seed = 42
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  for (let i = 0; i < data.length; i += 4) {
    const noise = (rand() - 0.5) * 70
    data[i] = data[i + 1] = data[i + 2] = 128 + noise
    data[i + 3] = 255
  }
  return data
}

describe('scene gates', () => {
  it('skips punchy ops on a well-exposed iPhone-like buffer', () => {
    const w = 64
    const h = 64
    const stats = sceneStats(iphoneLike(w, h), w, h)
    expect(shouldSkipLowLight(stats)).toBe(true)
    expect(shouldSkipDenoise(stats)).toBe(true)
    expect(shouldSkipDehaze(stats) || shouldSkipAutoColor(stats) || shouldSkipVibrance(stats)).toBe(true)
  })

  it('still wants help on dark, hazy, muted, and noisy frames', () => {
    expect(shouldSkipLowLight(sceneStats(darkFrame(), 48, 48))).toBe(false)
    expect(shouldSkipDehaze(sceneStats(hazyFrame(), 40, 40))).toBe(false)
    expect(shouldSkipVibrance(sceneStats(mutedFrame(), 24, 24))).toBe(false)
    expect(shouldSkipDenoise(sceneStats(noisyFrame(), 32, 32))).toBe(false)
  })

  it('skips 2× upscale once the long edge is already large', () => {
    expect(shouldSkipUpscale(2000, 1500)).toBe(true)
    expect(shouldSkipUpscale(1600, 1200)).toBe(false)
  })
})

describe('gated ops leave a good iPhone-like buffer nearly unchanged', () => {
  it('does not bake harmful auto-color / denoise / low-light / dehaze / clarity / vibrance', () => {
    const w = 64
    const h = 64
    const src = iphoneLike(w, h)
    const ops = [
      gatedAutoColor(src.slice(), w, h),
      gatedDenoise(src.slice(), w, h, 18),
      gatedLowLight(src.slice(), w, h),
      gatedDehaze(src.slice(), w, h),
      gatedClarity(src.slice(), w, h),
      gatedVibrance(src.slice(), w, h),
    ]
    for (const out of ops) {
      expect(out.skipped || maxAbsDelta(src, out.data) < 18).toBe(true)
      expect(maxAbsDelta(src, out.data)).toBeLessThan(18)
    }
  })
})

describe('gated ops still improve frames that need help', () => {
  it('lifts a dark frame', () => {
    const w = 48
    const h = 48
    const src = darkFrame(w, h)
    const out = gatedLowLight(src.slice(), w, h)
    expect(out.skipped).toBe(false)
    expect(meanLuma(out.data)).toBeGreaterThan(meanLuma(src) + 1)
  })

  it('restores chroma on a hazy subject', () => {
    const w = 40
    const h = 40
    const src = hazyFrame(w, h)
    const out = gatedDehaze(src.slice(), w, h)
    expect(out.skipped).toBe(false)
    const center = (20 * w + 20) * 4
    expect(chroma(out.data, center)).toBeGreaterThan(chroma(src, center) + 4)
  })

  it('boosts a muted grey-green', () => {
    const w = 24
    const h = 24
    const src = mutedFrame(w, h)
    const out = gatedVibrance(src.slice(), w, h)
    expect(out.skipped).toBe(false)
    expect(chroma(out.data, 0)).toBeGreaterThan(chroma(src, 0))
  })

  it('reduces grain on a noisy frame', () => {
    const w = 32
    const h = 32
    const src = noisyFrame(w, h)
    const variance = (buf: Uint8ClampedArray) => {
      let sum = 0
      let sumSq = 0
      let n = 0
      for (let i = 0; i < buf.length; i += 4) {
        sum += buf[i]
        sumSq += buf[i] ** 2
        n++
      }
      const mean = sum / n
      return sumSq / n - mean ** 2
    }
    const out = gatedDenoise(src.slice(), w, h, 18)
    expect(out.skipped).toBe(false)
    expect(variance(out.data)).toBeLessThan(variance(src))
  })

  it('neutralises a strong warm cast when auto-color is allowed', () => {
    const w = 16
    const h = 16
    const src = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < src.length; i += 4) {
      src[i] = 200
      src[i + 1] = 120
      src[i + 2] = 60
      src[i + 3] = 255
    }
    const before = Math.max(src[0], src[1], src[2]) - Math.min(src[0], src[1], src[2])
    const out = gatedAutoColor(src.slice(), w, h)
    expect(out.skipped).toBe(false)
    const spread = Math.max(out.data[0], out.data[1], out.data[2]) - Math.min(out.data[0], out.data[1], out.data[2])
    expect(spread).toBeLessThan(before)
  })
})

describe('hard gates', () => {
  it('skips upscale on a 12MP-class long edge', () => {
    const data = new Uint8ClampedArray(8)
    data[3] = 255
    const out = gatedUpscale(data, 4032, 1, 2)
    expect(out.skipped).toBe(true)
    expect(out.width).toBe(4032)
  })

  it('upscales a small buffer', () => {
    const w = 8
    const h = 6
    const data = new Uint8ClampedArray(w * h * 4).fill(128)
    const out = gatedUpscale(data, w, h, 2)
    expect(out.skipped).toBe(false)
    expect(out.width).toBe(16)
    expect(out.height).toBe(12)
  })

  it('skips background removal on a uniform frame', () => {
    const w = 32
    const h = 32
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 180
      data[i + 1] = 180
      data[i + 2] = 180
      data[i + 3] = 255
    }
    const out = gatedBackgroundRemove(data.slice(), w, h)
    expect(out.skipped).toBe(true)
    expect(out.data[3]).toBe(255)
  })

  it('skips face enhance when almost no skin is present', () => {
    const w = 24
    const h = 24
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 30
      data[i + 1] = 160
      data[i + 2] = 40
      data[i + 3] = 255
    }
    const out = gatedFaceEnhance(data.slice(), w, h, 18, 10)
    expect(out.skipped).toBe(true)
    expect(out.data).toEqual(data)
  })
})

describe('autoColor conservative defaults', () => {
  it('barely moves a well-exposed balanced buffer', () => {
    const w = 16
    const h = 16
    const src = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const v = 110 + Math.round((y / h) * 50)
        src[i] = v
        src[i + 1] = v + 2
        src[i + 2] = v - 2
        src[i + 3] = 255
      }
    }
    const gated = gatedAutoColor(src.slice(), w, h)
    expect(maxAbsDelta(src, gated.data)).toBeLessThan(18)
  })
})
