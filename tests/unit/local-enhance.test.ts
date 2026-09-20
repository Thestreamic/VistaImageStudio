import { describe, it, expect } from 'vitest'
import {
  applyBackgroundBlur,
  backgroundBlur,
  clarityEnhance,
  dehaze,
  estimatePortraitSubject,
  growSubjectKeep,
  lowLightEnhance,
  vibranceEnhance,
} from '@/features/ai/algorithms/local-enhance'
import { gatedBackgroundBlur } from '@/features/ai/algorithms/gated'

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

function fillRect(
  data: Uint8ClampedArray,
  w: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  r: number,
  g: number,
  b: number,
) {
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * w + x) * 4
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
}

describe('lowLightEnhance', () => {
  it('lifts a dark frame without blowing a bright lamp', () => {
    const w = 32
    const h = 32
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, 0, w, h, 28, 24, 32)
    fillRect(data, w, 14, 14, 18, 18, 250, 240, 210)

    const out = lowLightEnhance(data, w, h, { strength: 0.8 })
    const lampBefore = meanLuma(data.slice((14 * w + 14) * 4, (14 * w + 15) * 4 + 4))
    expect(meanLuma(out)).toBeGreaterThan(meanLuma(data) + 8)
    expect(out[(16 * w + 16) * 4]).toBeLessThanOrEqual(255)
    expect(out[(16 * w + 16) * 4]).toBeGreaterThanOrEqual(lampBefore - 2)
  })

  it('strength 0 copies the input', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255])
    expect(lowLightEnhance(data, 2, 1, { strength: 0 })).toEqual(data)
  })
})

describe('dehaze', () => {
  it('restores contrast on a veiled subject', () => {
    const w = 40
    const h = 40
    const data = new Uint8ClampedArray(w * h * 4)
    // Veil: mix a red subject and grey backdrop toward a white atmosphere.
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

    const out = dehaze(data, w, h, { strength: 0.85 })
    const center = (20 * w + 20) * 4
    const beforeSpread = chroma(data, center)
    const afterSpread = chroma(out, center)
    expect(afterSpread).toBeGreaterThan(beforeSpread + 10)
  })
})

describe('clarityEnhance', () => {
  it('increases edge contrast on a checkerboard', () => {
    const w = 24
    const h = 24
    const data = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        const v = ((x >> 2) + (y >> 2)) % 2 === 0 ? 80 : 180
        data[i] = data[i + 1] = data[i + 2] = v
        data[i + 3] = 255
      }
    }
    const edgeEnergy = (buf: Uint8ClampedArray) => {
      let e = 0
      for (let y = 0; y < h; y++) {
        for (let x = 1; x < w; x++) {
          e += Math.abs(buf[(y * w + x) * 4] - buf[(y * w + x - 1) * 4])
        }
      }
      return e
    }
    const out = clarityEnhance(data, w, h, { strength: 0.8 })
    expect(edgeEnergy(out)).toBeGreaterThan(edgeEnergy(data))
  })
})

describe('vibranceEnhance', () => {
  it('boosts a muted colour more than an already-loud one', () => {
    const w = 16
    const h = 8
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, 0, 8, h, 140, 148, 142) // muted
    fillRect(data, w, 8, 0, 16, h, 230, 20, 20) // loud red

    const out = vibranceEnhance(data, w, h, { strength: 0.8 })
    const muteI = 4 * 4
    const loudI = (8 + 4) * 4
    const muteRel = chroma(out, muteI) / Math.max(1, chroma(data, muteI))
    const loudRel = chroma(out, loudI) / Math.max(1, chroma(data, loudI))
    expect(muteRel).toBeGreaterThan(loudRel)
    expect(chroma(out, muteI)).toBeGreaterThan(chroma(data, muteI) + 2)
  })
})

describe('backgroundBlur', () => {
  const SKIN = [216, 148, 118] as const

  function regionMad(
    out: Uint8ClampedArray,
    src: Uint8ClampedArray,
    w: number,
    x0: number,
    y0: number,
    x1: number,
    y1: number,
  ) {
    let sum = 0
    let n = 0
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4
        sum += Math.abs(out[i] - src[i]) + Math.abs(out[i + 1] - src[i + 1]) + Math.abs(out[i + 2] - src[i + 2])
        n++
      }
    }
    return sum / n
  }

  function checker(data: Uint8ClampedArray, w: number, h: number, xMax = w) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < xMax; x++) {
        const i = (y * w + x) * 4
        const on = ((x >> 1) + (y >> 1)) % 2 === 0
        data[i] = on ? 24 : 40
        data[i + 1] = on ? 170 : 90
        data[i + 2] = on ? 60 : 210
        data[i + 3] = 255
      }
    }
  }

  it('softens the backdrop of a subject-on-plain-background frame', () => {
    const w = 48
    const h = 48
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, 0, w, h, 240, 240, 240)
    fillRect(data, w, 10, 10, 38, 38, 200, 40, 40)
    for (let x = 0; x < w; x += 2) {
      const i = x * 4
      data[i] = data[i + 1] = data[i + 2] = 200
    }

    const out = backgroundBlur(data, w, h, { strength: 0.9 })
    const borderVar = (buf: Uint8ClampedArray) => {
      const vals = [buf[0], buf[4], buf[8], buf[12]]
      const m = vals.reduce((a, b) => a + b, 0) / vals.length
      return vals.reduce((a, b) => a + (b - m) ** 2, 0)
    }
    expect(borderVar(out)).toBeLessThan(borderVar(data))
    const c = (24 * w + 24) * 4
    expect(Math.abs(out[c] - 200)).toBeLessThan(20)
  })

  it('keeps a right-edge face sharp and actually blurs a busy landscape (selfie flop)', () => {
    const w = 160
    const h = 200
    const data = new Uint8ClampedArray(w * h * 4)
    checker(data, w, h)
    fillRect(data, w, 118, 48, 156, 148, SKIN[0], SKIN[1], SKIN[2])

    const result = applyBackgroundBlur(data, w, h, { strength: 0.9 })
    expect(result.skipped).toBe(false)
    const landscape = regionMad(result.data, data, w, 4, 4, 70, 80)
    const face = regionMad(result.data, data, w, 126, 70, 148, 120)
    expect(landscape).toBeGreaterThan(25)
    expect(face).toBeLessThan(landscape * 0.35)
    expect(face).toBeLessThan(18)
  })

  it('skips a busy scene with no person instead of fogging the whole frame', () => {
    const w = 96
    const h = 96
    const data = new Uint8ClampedArray(w * h * 4)
    checker(data, w, h)
    const result = applyBackgroundBlur(data, w, h, { strength: 0.9 })
    expect(result.skipped).toBe(true)
    expect(result.reason).toBe('no-subject')
    expect(regionMad(result.data, data, w, 0, 0, w, h)).toBe(0)
  })

  it('honors an explicit subject mask', () => {
    const w = 64
    const h = 64
    const data = new Uint8ClampedArray(w * h * 4)
    checker(data, w, h)
    const mask = new Uint8ClampedArray(w * h)
    for (let y = 18; y < 46; y++) {
      for (let x = 18; x < 46; x++) mask[y * w + x] = 255
    }
    const result = applyBackgroundBlur(data, w, h, { strength: 0.9, mask })
    expect(result.skipped).toBe(false)
    expect(regionMad(result.data, data, w, 2, 2, 12, 12)).toBeGreaterThan(20)
    expect(regionMad(result.data, data, w, 24, 24, 40, 40)).toBeLessThan(12)
  })

  it('blurs a busy detailed backdrop around a skin-coloured subject', () => {
    const w = 96
    const h = 96
    const data = new Uint8ClampedArray(w * h * 4)
    checker(data, w, h)
    fillRect(data, w, 32, 28, 64, 72, SKIN[0], SKIN[1], SKIN[2])
    const out = backgroundBlur(data, w, h, { strength: 0.9 })
    const contrast = (buf: Uint8ClampedArray, x: number, y: number) => {
      const a = buf[(y * w + x) * 4 + 1]
      const b = buf[(y * w + x + 2) * 4 + 1]
      return Math.abs(a - b)
    }
    expect(contrast(out, 2, 2)).toBeLessThan(contrast(data, 2, 2) * 0.45)
    const c = (50 * w + 48) * 4
    expect(Math.abs(out[c] - SKIN[0])).toBeLessThan(35)
  })

  it('strong preset blurs the backdrop more than soft', () => {
    const w = 64
    const h = 64
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, 0, w, h, 30, 180, 40)
    fillRect(data, w, 20, 18, 44, 48, SKIN[0], SKIN[1], SKIN[2])
    for (let x = 0; x < w; x += 2) {
      data[x * 4] = 20
      data[x * 4 + 1] = 40
      data[x * 4 + 2] = 200
    }
    const soft = backgroundBlur(data, w, h, { strength: 0.52 })
    const strong = backgroundBlur(data, w, h, { strength: 0.94 })
    const edgeDelta = (buf: Uint8ClampedArray) => Math.abs(buf[0] - data[0]) + Math.abs(buf[1] - data[1]) + Math.abs(buf[2] - data[2])
    expect(edgeDelta(strong)).toBeGreaterThan(edgeDelta(soft))
  })

  it('writes a visible before/after proof and actually changes the backdrop', () => {
    const w = 180
    const h = 220
    const data = new Uint8ClampedArray(w * h * 4)
    checker(data, w, h)
    fillRect(data, w, 52, 48, 128, 188, SKIN[0], SKIN[1], SKIN[2])
    fillRect(data, w, 70, 62, 110, 92, 232, 188, 168)

    const started = Date.now()
    const out = backgroundBlur(data, w, h, { strength: 0.9 })
    expect(Date.now() - started).toBeLessThan(2500)

    let borderMad = 0
    let borderN = 0
    for (let x = 0; x < w; x++) {
      for (const y of [1, 2, h - 3, h - 2]) {
        const i = (y * w + x) * 4
        borderMad += Math.abs(out[i] - data[i]) + Math.abs(out[i + 1] - data[i + 1]) + Math.abs(out[i + 2] - data[i + 2])
        borderN++
      }
    }
    expect(borderMad / borderN).toBeGreaterThan(25)

    const c = (118 * w + 90) * 4
    const centerDelta = Math.abs(out[c] - data[c]) + Math.abs(out[c + 1] - data[c + 1]) + Math.abs(out[c + 2] - data[c + 2])
    expect(centerDelta).toBeLessThan(80)
  })

  it('gated blur reports skip without baking fog', () => {
    const w = 48
    const h = 48
    const data = new Uint8ClampedArray(w * h * 4)
    checker(data, w, h)
    const gated = gatedBackgroundBlur(data, w, h, 0.9)
    expect(gated.skipped).toBe(true)
    expect(gated.meta.reason).toBe('no-subject')
  })
})

describe('growSubjectKeep', () => {
  it('extends a face keep-map along a white sleeve without flooding blue sky or yellow type', () => {
    const w = 72
    const h = 56
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, 0, w, h, 70, 140, 210)
    fillRect(data, w, 6, 1, 50, 7, 255, 220, 20)
    fillRect(data, w, 44, 14, 62, 34, 216, 148, 118)
    fillRect(data, w, 8, 26, 52, 46, 236, 236, 232)

    const keep = estimatePortraitSubject(data, w, h)
    expect(keep).not.toBeNull()
    const map = keep!
    expect(map[32 * w + 52]).toBeGreaterThan(0.6)
    expect(map[36 * w + 14]).toBeGreaterThan(0.7)
    expect(map[3 * w + 20]).toBeLessThan(0.35)
    expect(map[8 * w + 8]).toBeLessThan(0.45)
  })

  it('does not replace the source keep map when clothing would flood the frame', () => {
    const w = 32
    const h = 32
    const data = new Uint8ClampedArray(w * h * 4)
    fillRect(data, w, 0, 0, w, h, 230, 230, 228)
    const keep = new Float32Array(w * h)
    keep[16 * w + 16] = 0.9
    const out = growSubjectKeep(data, w, h, keep)
    let high = 0
    for (let i = 0; i < out.length; i++) if (out[i] > 0.5) high++
    expect(high).toBeLessThan(w * h * 0.6)
  })
})
