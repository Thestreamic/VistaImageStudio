import { describe, it, expect } from 'vitest'
import {
  applyAlphaMatte,
  modnetInputSize,
  segmentHeuristic,
  segmentWithModel,
  upsampleMatte,
} from '@/features/ai/algorithms/background-removal'

/** A red square subject on a uniform white background. */
function subjectOnBackground(w: number, h: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const inSubject = x > w * 0.3 && x < w * 0.7 && y > h * 0.3 && y < h * 0.7
      if (inSubject) { data[i] = 220; data[i + 1] = 30; data[i + 2] = 30 }
      else { data[i] = 250; data[i + 1] = 250; data[i + 2] = 250 }
      data[i + 3] = 255
    }
  }
  return data
}

describe('segmentHeuristic', () => {
  it('marks background pixels near 0 and subject pixels near 255', () => {
    const w = 40, h = 40
    const data = subjectOnBackground(w, h)
    const matte = segmentHeuristic(data, w, h, { feather: 0, erode: 0 })
    const bgIdx = 2 * w + 2 // corner, background
    const fgIdx = (h / 2) * w + w / 2 // center, subject
    expect(matte[bgIdx]).toBeLessThan(80)
    expect(matte[fgIdx]).toBeGreaterThan(180)
  })

  it('returns a matte the same size as the image', () => {
    const w = 20, h = 30
    const matte = segmentHeuristic(subjectOnBackground(w, h), w, h)
    expect(matte.length).toBe(w * h)
  })

  it('still cuts out a two-tone backdrop', () => {
    // Sky over grass with a subject in the middle. A single median background
    // colour lands between the two tones, matches neither, and removes
    // nothing — which is what made background removal look like a no-op.
    const w = 48, h = 48
    const data = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const inSubject = x > w * 0.35 && x < w * 0.65 && y > h * 0.2 && y < h * 0.8
        if (inSubject) { data[i] = 210; data[i + 1] = 40; data[i + 2] = 40 }
        else if (y < h / 2) { data[i] = 90; data[i + 1] = 150; data[i + 2] = 220 }
        else { data[i] = 70; data[i + 1] = 130; data[i + 2] = 60 }
        data[i + 3] = 255
      }
    }

    const matte = segmentHeuristic(data, w, h, { feather: 0, erode: 0 })

    expect(matte[2 * w + 2]).toBeLessThan(80) // sky corner
    expect(matte[(h - 3) * w + 2]).toBeLessThan(80) // grass corner
    expect(matte[(h / 2) * w + w / 2]).toBeGreaterThan(180) // subject
  })

  it('keeps a subject that touches the frame edge', () => {
    // The subject runs off the bottom of the frame, so its colour appears in
    // the border samples. It is a minority there, so it must not be treated
    // as backdrop and eaten from the outside in.
    const w = 48, h = 48
    const data = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const inSubject = x > w * 0.4 && x < w * 0.6 && y > h * 0.5
        if (inSubject) { data[i] = 210; data[i + 1] = 40; data[i + 2] = 40 }
        else { data[i] = 245; data[i + 1] = 245; data[i + 2] = 245 }
        data[i + 3] = 255
      }
    }

    const matte = segmentHeuristic(data, w, h, { feather: 0, erode: 0 })

    expect(matte[2 * w + 2]).toBeLessThan(80) // backdrop
    expect(matte[(h - 2) * w + Math.floor(w / 2)]).toBeGreaterThan(180) // subject at the edge
  })
})

describe('upsampleMatte', () => {
  it('bilinear-upsamples a 0..1 matte instead of nearest-neighbour', () => {
    const small = new Float32Array([0, 1, 0, 1])
    const out = upsampleMatte(small, 2, 2, 4, 4)
    expect(out[0]).toBeLessThan(20)
    expect(out[3]).toBeGreaterThan(230)
    expect(out[1]).toBeGreaterThan(out[0])
    expect(out[1]).toBeLessThan(out[3])
  })
})

describe('applyAlphaMatte', () => {
  it('clears background alpha and keeps subject RGB', () => {
    const data = new Uint8ClampedArray([200, 30, 40, 255, 10, 20, 30, 255])
    const matte = new Uint8ClampedArray([255, 0])
    const out = applyAlphaMatte(data, matte)
    expect(out[0]).toBe(200)
    expect(out[3]).toBe(255)
    expect(out[4]).toBe(10)
    expect(out[7]).toBe(0)
    expect(data[7]).toBe(255)
  })
})

describe('modnetInputSize', () => {
  it('uses a 512-ref size rounded down to a multiple of 32', () => {
    const landscape = modnetInputSize(1024, 768)
    expect(landscape.h).toBe(512)
    expect(landscape.w % 32).toBe(0)
    expect(landscape.w).toBeGreaterThan(landscape.h)
  })
})

describe('segmentWithModel', () => {
  it('throws instead of returning a flood-fill matte when the ONNX is missing', async () => {
    const w = 24
    const h = 24
    const data = subjectOnBackground(w, h)
    await expect(segmentWithModel(data, w, h, '/models/missing-modnet.onnx')).rejects.toThrow(
      /Portrait matting model failed/,
    )
  })
})
