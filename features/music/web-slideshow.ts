import { slideshowDuration } from './ffmpeg-args'
import { fitFrameSize, mixSlideshowMusic, resampleInterleaved } from './pcm-mix'

type SlideshowFrame = CanvasImageSource & { width: number; height: number }

const AUDIO_PACKET = 1024

function drawFit(ctx: CanvasRenderingContext2D, source: CanvasImageSource, width: number, height: number, sourceWidth: number, sourceHeight: number) {
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, width, height)
  const scale = Math.min(width / sourceWidth, height / sourceHeight)
  const dw = sourceWidth * scale
  const dh = sourceHeight * scale
  ctx.drawImage(source, (width - dw) / 2, (height - dh) / 2, dw, dh)
}

async function decodeMusic(url: string): Promise<{ channels: Float32Array[]; sampleRate: number }> {
  const res = await fetch(url)
  if (!res.ok) throw new Error('Music file missing')
  const bytes = await res.arrayBuffer()
  const ctx = new AudioContext()
  try {
    const decoded = await ctx.decodeAudioData(bytes.slice(0))
    const count = Math.min(2, decoded.numberOfChannels)
    const channels: Float32Array[] = []
    for (let c = 0; c < count; c++) channels.push(new Float32Array(decoded.getChannelData(c)))
    return { channels, sampleRate: decoded.sampleRate }
  } finally {
    await ctx.close()
  }
}

async function encodeAudio(
  muxer: { addAudioChunk: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => void },
  pcm: Float32Array,
  channels: number,
  sampleRate: number,
): Promise<void> {
  const config: AudioEncoderConfig = {
    codec: 'mp4a.40.2',
    numberOfChannels: channels,
    sampleRate,
    bitrate: 128_000,
  }
  const supported = await AudioEncoder.isConfigSupported(config)
  if (!supported.supported) throw new Error('This browser cannot encode AAC audio')
  let failed: Error | null = null
  const encoder = new AudioEncoder({
    output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
    error: (err) => {
      failed = new Error(err.message)
    },
  })
  encoder.configure(config)
  const frames = Math.floor(pcm.length / channels)
  for (let offset = 0; offset < frames; offset += AUDIO_PACKET) {
    const count = Math.min(AUDIO_PACKET, frames - offset)
    const data = new Float32Array(pcm.subarray(offset * channels, (offset + count) * channels))
    const audio = new AudioData({
      format: 'f32',
      sampleRate,
      numberOfFrames: count,
      numberOfChannels: channels,
      timestamp: Math.round((offset / sampleRate) * 1_000_000),
      data,
    })
    encoder.encode(audio)
    audio.close()
    if (failed) throw failed
  }
  await encoder.flush()
  if (failed) throw failed
  encoder.close()
}

export async function exportWebSlideshow(input: {
  frames: SlideshowFrame[]
  holdSec: number
  musicUrl?: string | null
}): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    throw new Error('This browser cannot export MP4. Use the Windows app.')
  }
  if (!input.frames.length) throw new Error('Add a photo first.')
  const size = fitFrameSize(
    Math.max(...input.frames.map((frame) => frame.width)),
    Math.max(...input.frames.map((frame) => frame.height)),
  )
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not prepare the video frame')

  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer')
  const duration = slideshowDuration(input.frames.length, input.holdSec)
  let pcm: Float32Array | null = null
  let sampleRate = 48_000
  let channels = 2
  if (input.musicUrl) {
    if (typeof AudioEncoder === 'undefined') throw new Error('This browser cannot add music to an MP4')
    const decoded = await decodeMusic(input.musicUrl)
    channels = decoded.channels.length
    sampleRate = decoded.sampleRate
    pcm = mixSlideshowMusic({
      channels: decoded.channels,
      sampleRate,
      videoDurationSec: duration,
    })
    const audioConfig: AudioEncoderConfig = {
      codec: 'mp4a.40.2',
      numberOfChannels: channels,
      sampleRate,
      bitrate: 128_000,
    }
    const native = await AudioEncoder.isConfigSupported(audioConfig)
    if (!native.supported && sampleRate !== 48_000) {
      pcm = resampleInterleaved(pcm, channels, sampleRate, 48_000)
      sampleRate = 48_000
    }
  }

  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: size.width, height: size.height },
    audio: pcm ? { codec: 'aac', numberOfChannels: channels, sampleRate } : undefined,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  })

  const videoConfig: VideoEncoderConfig = {
    codec: 'avc1.420032',
    width: size.width,
    height: size.height,
    bitrate: Math.min(8_000_000, Math.max(1_500_000, size.width * size.height * 3)),
    avc: { format: 'avc' },
  }
  const videoOk = await VideoEncoder.isConfigSupported(videoConfig)
  if (!videoOk.supported) throw new Error('This browser cannot encode an MP4')

  let videoError: Error | null = null
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (err) => {
      videoError = new Error(err.message)
    },
  })
  videoEncoder.configure(videoConfig)
  const holdUs = Math.round(Math.max(0.2, input.holdSec) * 1_000_000)
  for (let i = 0; i < input.frames.length; i++) {
    const frameSource = input.frames[i]
    drawFit(ctx, frameSource, size.width, size.height, frameSource.width, frameSource.height)
    const frame = new VideoFrame(canvas, { timestamp: i * holdUs, duration: holdUs })
    videoEncoder.encode(frame, { keyFrame: true })
    frame.close()
    if (videoError) throw videoError
  }
  await videoEncoder.flush()
  videoEncoder.close()
  if (videoError) throw videoError

  if (pcm) await encodeAudio(muxer, pcm, channels, sampleRate)
  muxer.finalize()
  return new Blob([target.buffer], { type: 'video/mp4' })
}
