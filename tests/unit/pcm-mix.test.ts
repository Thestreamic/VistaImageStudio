import { describe, expect, it } from 'vitest'
import { fitFrameSize, mixSlideshowMusic, musicGainAt, resampleInterleaved } from '@/features/music/pcm-mix'

describe('browser slideshow music mix', () => {
  it('loops a short bed and fades the start and end', () => {
    const tone = new Float32Array(4)
    tone.fill(1)
    const mixed = mixSlideshowMusic({
      channels: [tone],
      sampleRate: 4,
      videoDurationSec: 2,
      fadeInSec: 0.5,
      fadeOutSec: 0.5,
    })
    expect(mixed.length).toBe(8)
    expect(mixed[0]).toBe(0)
    expect(mixed[2]).toBeCloseTo(1)
    expect(mixed[4]).toBeCloseTo(1)
    expect(mixed[7]).toBeCloseTo(0.5)
    expect(musicGainAt(0, 2, 0.5, 0.5)).toBe(0)
  })

  it('trims a bed that is longer than the video', () => {
    const tone = new Float32Array([0.5, 0.5, 0.5, 0.5, 0.2])
    const mixed = mixSlideshowMusic({
      channels: [tone],
      sampleRate: 1,
      videoDurationSec: 2,
      fadeInSec: 0,
      fadeOutSec: 0,
    })
    expect(Array.from(mixed)).toEqual([0.5, 0.5])
  })

  it('keeps slideshow frames even and inside the web size cap', () => {
    expect(fitFrameSize(1080, 1350)).toEqual({ width: 1080, height: 1350 })
    expect(fitFrameSize(4000, 3000).width).toBeLessThanOrEqual(1920)
    expect(fitFrameSize(4000, 3000).height % 2).toBe(0)
  })

  it('resamples interleaved audio to the encoder rate', () => {
    const up = resampleInterleaved(new Float32Array([0, 1]), 1, 2, 4)
    expect(up.length).toBe(4)
    expect(up[0]).toBeCloseTo(0)
    expect(up[3]).toBeCloseTo(1)
  })
})
