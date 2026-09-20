import { describe, it, expect } from 'vitest'
import {
  applyDepthBlur,
  depthFromAlphaMatte,
  matteToDepthMap,
} from '@/features/ai/algorithms/portrait-blur'
import { segmentHeuristic } from '@/features/ai/algorithms/background-removal'

function fillSubject(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  paintBg: (x: number, y: number) => [number, number, number],
) {
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const inSubject = x > w * 0.3 && x < w * 0.7 && y > h * 0.3 && y < h * 0.7
      const [r, g, b] = inSubject ? [220, 30, 30] : paintBg(x, y)
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
}

describe('matteToDepthMap', () => {
  it('maps a 0..255 matte onto 0..1 depth', () => {
    const depth = matteToDepthMap(new Uint8ClampedArray([0, 128, 255]))
    expect(depth[0]).toBe(0)
    expect(depth[1]).toBeCloseTo(128 / 255, 5)
    expect(depth[2]).toBe(1)
  })
})

describe('applyDepthBlur', () => {
  it('keeps near pixels sharp and blurs far pixels', () => {
    const w = 32
    const h = 32
    const data = new Uint8ClampedArray(w * h * 4)
    fillSubject(data, w, h, (x, y) => [
      (x * 13 + y * 7) % 220,
      (x * 5 + y * 17) % 220,
      (x * 11 + y * 3) % 220,
    ])
    const depth = new Float32Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const inSubject = x > w * 0.3 && x < w * 0.7 && y > h * 0.3 && y < h * 0.7
        depth[y * w + x] = inSubject ? 1 : 0
      }
    }

    const out = applyDepthBlur(data, w, h, depth, {
      maxBlurRadius: 6,
      subjectThreshold: 0.55,
      levels: 3,
    })

    const center = (Math.floor(h / 2) * w + Math.floor(w / 2)) * 4
    expect(out[center]).toBe(data[center])
    expect(out[center + 1]).toBe(data[center + 1])
    expect(out[center + 2]).toBe(data[center + 2])
    expect(out[center + 3]).toBe(255)

    const corner = 2 * 4
    expect(Math.abs(out[corner] - data[corner]) + Math.abs(out[corner + 1] - data[corner + 1])).toBeGreaterThan(0)
  })
})

describe('depthFromAlphaMatte', () => {
  it('keeps a sleeve that is in the matte near, not far', () => {
    const w = 40
    const h = 40
    const matte = new Uint8ClampedArray(w * h)
    for (let y = 8; y <= 32; y++) {
      for (let x = 12; x <= 22; x++) matte[y * w + x] = 255
    }
    for (let y = 14; y <= 22; y++) {
      for (let x = 22; x <= 34; x++) matte[y * w + x] = 255
    }
    const { depth, source } = depthFromAlphaMatte(matte, w, h)
    expect(source).toBe('matte')
    expect(depth[18 * w + 28]).toBeGreaterThanOrEqual(0.94)
    expect(depth[18 * w + 17]).toBeGreaterThanOrEqual(0.94)
    expect(depth[2 * w + 2]).toBeLessThan(0.55)
  })
})

describe('applyDepthBlur from a matte', () => {
  it('keeps a centred subject sharp when given a person matte', () => {
    const w = 40
    const h = 40
    const data = new Uint8ClampedArray(w * h * 4)
    fillSubject(data, w, h, () => [40, 160, 70])
    const matte = new Uint8ClampedArray(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const inSubject = x > w * 0.3 && x < w * 0.7 && y > h * 0.3 && y < h * 0.7
        matte[y * w + x] = inSubject ? 255 : 0
      }
    }
    const { depth } = depthFromAlphaMatte(matte, w, h)
    const out = applyDepthBlur(data, w, h, depth, {
      maxBlurRadius: 5,
      subjectThreshold: 0.55,
      levels: 3,
    })
    const fg = Math.floor(h / 2) * w + Math.floor(w / 2)
    const px = fg * 4
    expect(out[px]).toBe(data[px])
    expect(out[px + 1]).toBe(data[px + 1])

    const heur = segmentHeuristic(data, w, h, { feather: 0, erode: 0 })
    expect(heur[fg]).toBeGreaterThan(180)
  })

  it('does not paste a 1px sky fringe as fully sharp subject', () => {
    const w = 48
    const h = 48
    const data = new Uint8ClampedArray(w * h * 4)
    const matte = new Uint8ClampedArray(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const inCore = x > 14 && x < 34 && y > 14 && y < 34
        const inFringe = !inCore && x > 13 && x < 35 && y > 13 && y < 35
        if (inCore) {
          data[i] = 200
          data[i + 1] = 40
          data[i + 2] = 30
          matte[y * w + x] = 255
        } else {
          data[i] = 140
          data[i + 1] = 190
          data[i + 2] = 230
          matte[y * w + x] = inFringe ? 255 : 0
        }
        data[i + 3] = 255
      }
    }
    const { depth, subjectAlpha } = depthFromAlphaMatte(matte, w, h)
    const out = applyDepthBlur(
      data,
      w,
      h,
      depth,
      { maxBlurRadius: 8, subjectThreshold: 0.55, samples: 16 },
      subjectAlpha,
    )
    const fringe = (14 * w + 24) * 4
    const core = (24 * w + 24) * 4
    expect(out[core]).toBe(200)
    expect(out[core + 1]).toBe(40)
    expect(Math.abs(out[fringe] - data[fringe]) + Math.abs(out[fringe + 1] - data[fringe + 1])).toBeGreaterThan(4)
  })
})
