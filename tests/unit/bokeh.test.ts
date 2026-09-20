import { describe, expect, it } from 'vitest'
import {
  applyDiscBokehCpu,
  blurRadiusForDepth,
  boostHighlights,
  DEFAULT_BOKEH,
  downsampleRgba,
  highlightBoostFactor,
  lumaGradientMap,
  syntheticDepthMap,
} from '@/features/ai/algorithms/bokeh'
import { applyDepthBlur, depthFromAlphaMatte } from '@/features/ai/algorithms/portrait-blur'

function px(data: Uint8ClampedArray, width: number, x: number, y: number) {
  const i = (y * width + x) * 4
  return [data[i], data[i + 1], data[i + 2]] as const
}

describe('bokeh', () => {
  it('boosts highlights above the threshold and leaves dim pixels alone', () => {
    const data = new Uint8ClampedArray([
      10, 10, 10, 255,
      240, 220, 80, 255,
    ])
    const out = boostHighlights(data, 0.7, 3)
    expect(out[0]).toBeCloseTo(10, 5)
    expect(out[4]).toBeGreaterThan(240)
    expect(out[5]).toBeGreaterThan(220)
  })

  it('blurs far pixels more than mid-ground so architecture can stay readable', () => {
    expect(blurRadiusForDepth(1, DEFAULT_BOKEH)).toBe(0)
    expect(blurRadiusForDepth(0.7, DEFAULT_BOKEH)).toBe(0)
    const mid = blurRadiusForDepth(0.35, DEFAULT_BOKEH)
    const far = blurRadiusForDepth(0.02, DEFAULT_BOKEH)
    expect(mid).toBeGreaterThan(0)
    expect(far).toBeGreaterThan(mid * 1.6)
  })

  it('turns a bright point in the far field into a soft disc, not a hard pixel', () => {
    const w = 48
    const h = 48
    const data = new Uint8ClampedArray(w * h * 4)
    const depth = new Float32Array(w * h)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 8
      data[i + 1] = 8
      data[i + 2] = 12
      data[i + 3] = 255
    }
    const cx = 36
    const cy = 12
    for (let y = cy - 1; y <= cy + 1; y++) {
      for (let x = cx - 1; x <= cx + 1; x++) {
        const i = (y * w + x) * 4
        data[i] = 255
        data[i + 1] = 210
        data[i + 2] = 90
      }
    }
    const out = applyDiscBokehCpu(data, w, h, depth, { ...DEFAULT_BOKEH, maxBlurRadius: 10, samples: 32 })
    let bloom = 0
    for (let y = cy - 6; y <= cy + 6; y++) {
      for (let x = cx - 6; x <= cx + 6; x++) {
        if (Math.abs(x - cx) <= 1 && Math.abs(y - cy) <= 1) continue
        const [r, g] = px(out, w, x, y)
        const [sr, sg] = px(data, w, x, y)
        if (r + g > sr + sg + 10) bloom++
      }
    }
    expect(bloom).toBeGreaterThan(8)
  })

  it('keeps the subject sharp after compositing', () => {
    const w = 32
    const h = 32
    const data = new Uint8ClampedArray(w * h * 4)
    const depth = new Float32Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const near = x > 8 && x < 24 && y > 8 && y < 24
        data[i] = near ? 200 : (x * 11 + y * 5) % 180
        data[i + 1] = near ? 40 : (x * 3 + y * 13) % 180
        data[i + 2] = near ? 40 : (x * 7 + y) % 180
        data[i + 3] = 255
        depth[y * w + x] = near ? 1 : 0.05
      }
    }
    const out = applyDepthBlur(data, w, h, depth, {
      maxBlurRadius: 8,
      subjectThreshold: 0.55,
      samples: 20,
    })
    const c = (16 * w + 16) * 4
    expect(out[c]).toBe(data[c])
    expect(out[c + 1]).toBe(data[c + 1])
    const corner = px(out, w, 1, 1)
    const src = px(data, w, 1, 1)
    expect(Math.abs(corner[0] - src[0]) + Math.abs(corner[1] - src[1])).toBeGreaterThan(0)
  })

  it('builds a graduated depth map from a subject keep mask', () => {
    const w = 20
    const h = 20
    const keep = new Float32Array(w * h)
    for (let y = 8; y < 12; y++) for (let x = 8; x < 12; x++) keep[y * w + x] = 1
    const depth = syntheticDepthMap(keep, w, h)
    expect(depth[10 * w + 10]).toBeGreaterThan(0.85)
    expect(depth[1]).toBeLessThan(depth[10 * w + 10])
    expect(depth[1]).toBeLessThan(depth[10 * w + 14])
  })

  it('makes background next to the subject nearer than a far corner', () => {
    const w = 24
    const h = 24
    const keep = new Float32Array(w * h)
    for (let y = 8; y < 16; y++) for (let x = 8; x < 16; x++) keep[y * w + x] = 1
    const depth = syntheticDepthMap(keep, w, h)
    expect(depth[12 * w + 17]).toBeGreaterThan(depth[1])
    expect(depth[12 * w + 17]).toBeLessThan(depth[12 * w + 12])
  })

  it('seeds the disc with the centre pixel so a glyph is not replaced by a ring of neighbours', () => {
    const w = 40
    const h = 40
    const data = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 30
      data[i + 1] = 90
      data[i + 2] = 190
      data[i + 3] = 255
    }
    for (let y = 16; y <= 23; y++) {
      for (let x = 16; x <= 23; x++) {
        const i = (y * w + x) * 4
        data[i] = 250
        data[i + 1] = 230
        data[i + 2] = 40
      }
    }
    const depth = new Float32Array(w * h)
    const out = applyDiscBokehCpu(data, w, h, depth, { ...DEFAULT_BOKEH, maxBlurRadius: 14, samples: 32 })
    const [r, g, b] = px(out, w, 16, 20)
    const [sr, sg] = px(data, w, 16, 20)
    const [nr] = px(data, w, 10, 20)
    expect(r).toBeGreaterThan(90)
    expect(g).toBeGreaterThan(80)
    expect(r + g).toBeGreaterThan(b)
    expect(r).toBeGreaterThan(nr + 40)
    expect(Math.abs(r - sr) + Math.abs(g - sg)).toBeGreaterThan(0)
  })

  it('does not raise far-field pixels above the brightest source sample', () => {
    const w = 24
    const h = 24
    const data = new Uint8ClampedArray(w * h * 4)
    const depth = new Float32Array(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const bright = x >= w / 2
        data[i] = bright ? 240 : 40
        data[i + 1] = bright ? 240 : 40
        data[i + 2] = bright ? 240 : 40
        data[i + 3] = 255
      }
    }
    const out = applyDiscBokehCpu(data, w, h, depth, { ...DEFAULT_BOKEH, maxBlurRadius: 12, samples: 32 })
    let maxR = 0
    let mixed = 0
    for (let i = 0; i < out.length; i += 4) {
      if (out[i] > maxR) maxR = out[i]
      if (out[i] > 50 && out[i] < 230) mixed++
    }
    expect(maxR).toBeLessThanOrEqual(240)
    expect(mixed).toBeGreaterThan(8)
  })

  it('does not highlight-boost high-gradient edges the way it boosts smooth speculars', () => {
    expect(highlightBoostFactor(0.95, 0.02, 0.72, 2.6)).toBeGreaterThan(2)
    expect(highlightBoostFactor(0.95, 0.9, 0.72, 2.6)).toBeLessThan(1.15)
    const w = 8
    const h = 8
    const data = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const v = x < 4 ? 10 : 250
        data[i] = v
        data[i + 1] = v
        data[i + 2] = v
        data[i + 3] = 255
      }
    }
    const g = lumaGradientMap(data, w, h)
    expect(g[3]).toBeGreaterThan(0.4)
    expect(g[1]).toBeLessThan(0.15)
  })

  it('box-filters on downsample instead of picking a single nearest pixel', () => {
    const src = new Uint8ClampedArray([
      255, 0, 0, 255, 0, 0, 0, 255,
      0, 0, 0, 255, 255, 0, 0, 255,
    ])
    const out = downsampleRgba(src, 2, 2, 1, 1)
    expect(out[0]).toBeGreaterThan(120)
    expect(out[0]).toBeLessThan(140)
    expect(out[1]).toBe(0)
  })
})

describe('portrait depth from a matte', () => {
  it('keeps a centred subject sharp', () => {
    const w = 40
    const h = 40
    const data = new Uint8ClampedArray(w * h * 4)
    const matte = new Uint8ClampedArray(w * h)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const inSubject = x > 12 && x < 28 && y > 12 && y < 28
        data[i] = inSubject ? 220 : 40
        data[i + 1] = inSubject ? 30 : 160
        data[i + 2] = inSubject ? 30 : 70
        data[i + 3] = 255
        matte[y * w + x] = inSubject ? 255 : 0
      }
    }
    const { depth, source } = depthFromAlphaMatte(matte, w, h)
    expect(source).toBe('matte')
    const out = applyDepthBlur(data, w, h, depth, {
      maxBlurRadius: 6,
      subjectThreshold: 0.55,
      samples: 16,
    })
    const c = (20 * w + 20) * 4
    expect(out[c]).toBe(220)
    expect(out[c + 1]).toBe(30)
  })
})
