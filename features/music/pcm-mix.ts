import { DEFAULT_FADE_IN, DEFAULT_FADE_OUT, musicShouldLoop } from './ffmpeg-args'

/** Longest side used for a browser slideshow so a phone can finish the encode. */
export const WEB_SLIDESHOW_MAX_EDGE = 1920

export function fitFrameSize(width: number, height: number, maxEdge = WEB_SLIDESHOW_MAX_EDGE): { width: number; height: number } {
  let w = Math.max(1, Math.round(width))
  let h = Math.max(1, Math.round(height))
  const edge = Math.max(w, h)
  if (edge > maxEdge) {
    const scale = maxEdge / edge
    w = Math.max(1, Math.round(w * scale))
    h = Math.max(1, Math.round(h * scale))
  }
  w = Math.max(2, w - (w % 2))
  h = Math.max(2, h - (h % 2))
  return { width: w, height: h }
}

/** Linear fade matching the desktop FFmpeg afade in/out. */
export function musicGainAt(timeSec: number, videoDurationSec: number, fadeInSec = DEFAULT_FADE_IN, fadeOutSec = DEFAULT_FADE_OUT): number {
  const dur = Math.max(0.2, videoDurationSec)
  let gain = 1
  if (fadeInSec > 0 && timeSec < fadeInSec) gain = Math.max(0, timeSec / fadeInSec)
  const fadeOutStart = Math.max(0, dur - fadeOutSec)
  if (fadeOutSec > 0 && timeSec > fadeOutStart) {
    gain = Math.min(gain, Math.max(0, (dur - timeSec) / fadeOutSec))
  }
  return gain
}

/**
 * Interleaved PCM for the whole slideshow.
 * A short bed loops. A long bed is trimmed. Silence fills the tail when there is no loop.
 */
export function mixSlideshowMusic(input: {
  channels: Float32Array[]
  sampleRate: number
  videoDurationSec: number
  fadeInSec?: number
  fadeOutSec?: number
}): Float32Array {
  const channelCount = Math.max(1, Math.min(2, input.channels.length))
  const sampleRate = Math.max(1, input.sampleRate)
  const srcFrames = input.channels[0]?.length ?? 0
  const outFrames = Math.max(1, Math.round(Math.max(0.2, input.videoDurationSec) * sampleRate))
  const out = new Float32Array(outFrames * channelCount)
  const musicDuration = srcFrames / sampleRate
  const loop = musicShouldLoop(input.videoDurationSec, musicDuration)
  for (let i = 0; i < outFrames; i++) {
    const time = i / sampleRate
    const gain = musicGainAt(time, input.videoDurationSec, input.fadeInSec, input.fadeOutSec)
    const srcIndex = loop && srcFrames > 0 ? i % srcFrames : i
    for (let c = 0; c < channelCount; c++) {
      const sample = srcIndex < srcFrames ? (input.channels[c]?.[srcIndex] ?? 0) : 0
      out[i * channelCount + c] = sample * gain
    }
  }
  return out
}

export function resampleInterleaved(input: Float32Array, channels: number, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate || input.length === 0) return input
  const inFrames = Math.floor(input.length / channels)
  const outFrames = Math.max(1, Math.round((inFrames * toRate) / fromRate))
  const out = new Float32Array(outFrames * channels)
  const last = Math.max(0, inFrames - 1)
  for (let i = 0; i < outFrames; i++) {
    const src = (i * fromRate) / toRate
    const i0 = Math.min(last, Math.floor(src))
    const i1 = Math.min(last, i0 + 1)
    const frac = src - i0
    for (let c = 0; c < channels; c++) {
      const a = input[i0 * channels + c] ?? 0
      const b = input[i1 * channels + c] ?? 0
      out[i * channels + c] = a + (b - a) * frac
    }
  }
  return out
}
