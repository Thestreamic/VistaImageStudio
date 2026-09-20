import { describe, expect, it } from 'vitest'
import {
  applyMaskHole,
  compositeInpaint,
  inpaint,
  inpaintObject,
  lamaFeeds,
  maskToNchw01,
  nchwToRgba,
  padMask,
  padRgba,
  rgbaToNchw01,
  unpadRgba,
} from '@/features/ai/algorithms/inpaint'

describe('inpaint helpers', () => {
  it('zeros RGB inside the hole and leaves the rest', () => {
    const rgba = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255])
    const mask = new Uint8ClampedArray([255, 0])
    const out = applyMaskHole(rgba, mask, 2, 1)
    expect([...out.slice(0, 4)]).toEqual([0, 0, 0, 255])
    expect([...out.slice(4, 8)]).toEqual([40, 50, 60, 255])
    expect(rgba[0]).toBe(10)
  })

  it('composites only the masked pixels', () => {
    const w = 12
    const original = new Uint8ClampedArray(w * 4)
    const filled = new Uint8ClampedArray(w * 4)
    const mask = new Uint8ClampedArray(w)
    for (let i = 0; i < w; i++) {
      original[i * 4] = 10
      original[i * 4 + 1] = 10
      original[i * 4 + 2] = 10
      original[i * 4 + 3] = 255
      filled[i * 4] = 200
      filled[i * 4 + 3] = 255
    }
    mask[0] = 255
    mask[1] = 255
    const out = compositeInpaint(original, filled, mask, w, 1)
    expect(out[0]).toBeGreaterThan(100)
    const far = (w - 1) * 4
    expect(out[far]).toBe(10)
  })

  it('encodes image as 0-1 NCHW and mask as 0/1', () => {
    const rgba = new Uint8ClampedArray([255, 128, 0, 255])
    const chw = rgbaToNchw01(rgba, 1, 1)
    expect(chw[0]).toBeCloseTo(1)
    expect(chw[1]).toBeCloseTo(128 / 255)
    expect(chw[2]).toBeCloseTo(0)
    expect([...maskToNchw01(new Uint8ClampedArray([200, 10]), 2, 1)]).toEqual([1, 0])
  })

  it('decodes both 0-1 and 0-255 LaMa outputs', () => {
    const unit = nchwToRgba(new Float32Array([1, 0, 0]), 1, 1)
    expect(unit[0]).toBe(255)
    const byte = nchwToRgba(new Float32Array([200, 10, 5]), 1, 1)
    expect(byte[0]).toBe(200)
    expect(byte[1]).toBe(10)
  })

  it('maps session input names onto image and mask tensors', () => {
    const feeds = lamaFeeds({ inputNames: ['mask', 'image'] }, 'IMG', 'MSK')
    expect(feeds.image).toBe('IMG')
    expect(feeds.mask).toBe('MSK')
  })

  it('pads then unpads without changing the original pixels', () => {
    const src = new Uint8ClampedArray(2 * 2 * 4)
    for (let i = 0; i < src.length; i++) src[i] = i + 3
    const padded = padRgba(src, 2, 2, 4, 4)
    const back = unpadRgba(padded, 4, 4, 2, 2)
    expect([...back]).toEqual([...src])
    const mask = new Uint8ClampedArray([1, 2, 3, 4])
    expect([...padMask(mask, 2, 2, 3, 3).slice(0, 2)]).toEqual([1, 2])
    expect(padMask(mask, 2, 2, 3, 3)[2]).toBe(0)
  })
})

describe('diffusion inpaint', () => {
  it('fills a hole from neighbouring colour', () => {
    const w = 16
    const h = 16
    const data = new Uint8ClampedArray(w * h * 4)
    const mask = new Uint8ClampedArray(w * h)
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = 200
      data[i * 4 + 1] = 30
      data[i * 4 + 2] = 30
      data[i * 4 + 3] = 255
    }
    for (let y = 6; y <= 9; y++) {
      for (let x = 6; x <= 9; x++) {
        const i = y * w + x
        data[i * 4] = 0
        data[i * 4 + 1] = 255
        data[i * 4 + 2] = 0
        mask[i] = 255
      }
    }
    const out = inpaint(data, w, h, mask)
    const c = (8 * w + 8) * 4
    expect(out[c + 1]).toBeLessThan(120)
    expect(out[c]).toBeGreaterThan(100)
  })

  it('returns immediately when the mask is empty', async () => {
    const data = new Uint8ClampedArray([9, 8, 7, 255])
    const mask = new Uint8ClampedArray([0])
    const out = await inpaintObject(data, 1, 1, mask)
    expect(out.backend).toBe('diffusion')
    expect(out.data).toBe(data)
  })
})
