import { describe, expect, it } from 'vitest'
import {
  buildSlideshowFfmpegArgs,
  concatListForStills,
  musicShouldLoop,
  slideshowDuration,
} from '@/features/music/ffmpeg-args'

describe('slideshow ffmpeg args', () => {
  it('loops music that is shorter than the video and trims music that is longer', () => {
    expect(musicShouldLoop(20, 18)).toBe(true)
    expect(musicShouldLoop(10, 18)).toBe(false)
    const looped = buildSlideshowFfmpegArgs({
      concatFile: 'list.txt',
      outFile: 'out.mp4',
      videoDuration: 20,
      musicFile: 'bed.wav',
      musicDuration: 18,
      width: 1080,
      height: 1350,
    })
    expect(looped).toContain('-stream_loop')
    expect(looped).toContain('aac')
    const trimmed = buildSlideshowFfmpegArgs({
      concatFile: 'list.txt',
      outFile: 'out.mp4',
      videoDuration: 8,
      musicFile: 'bed.wav',
      musicDuration: 18,
      width: 1080,
      height: 1080,
    })
    expect(trimmed.includes('-stream_loop')).toBe(false)
    expect(trimmed).toContain('-t')
  })

  it('exports silent video when no music file is given', () => {
    const args = buildSlideshowFfmpegArgs({
      concatFile: 'list.txt',
      outFile: 'out.mp4',
      videoDuration: 5,
      width: 800,
      height: 800,
    })
    expect(args).toContain('-an')
    expect(args.includes('aac')).toBe(false)
  })

  it('builds a concat list and duration from still count', () => {
    const list = concatListForStills(['C:/tmp/a.jpg', 'C:/tmp/b.jpg'], 2.5)
    expect(list).toContain("file 'C:/tmp/a.jpg'")
    expect(list).toContain('duration 2.5')
    expect(slideshowDuration(3, 2.5)).toBe(7.5)
  })
})
