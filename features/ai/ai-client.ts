'use client'

/**
 * Main-thread client for the AI worker. Lazily spins up a single worker,
 * multiplexes requests by id, and exposes a promise-based API with an
 * optional progress callback — this is what the store and UI call into.
 */
import { publicBasePath } from '@/lib/public-url'
import type { AiRequest, AiResponse } from './workers/ai.worker'
import type { UpscaleFactor } from './algorithms/upscale'

/** Extract cleanly narrows the discriminated union on `ok`, unlike `AiResponse & { ok: true }`
 *  which doesn't simplify across a union and left every consumer seeing the full union. */
type AiSuccess = Extract<AiResponse, { ok: true }>

/** Plain `Omit<AiRequest, 'id'>` collapses the discriminated union to only its
 *  common fields (Omit is built on `keyof T`, which for a union is the
 *  *intersection* of member keys) — this distributes Omit over each member
 *  instead, so variant-specific fields like `strength` or `seedX` survive. */
type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never
type AiRequestPayload = WithoutId<AiRequest>

let worker: Worker | null = null
const pending = new Map<string, { resolve: (r: AiSuccess) => void; reject: (e: Error) => void; onProgress?: (p: number, detail?: string) => void }>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./workers/ai.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<AiResponse>) => {
      const msg = e.data
      const job = pending.get(msg.id)
      if (!job) return
      if ('progress' in msg) {
        job.onProgress?.(msg.progress, msg.detail)
        return
      }
      pending.delete(msg.id)
      if (msg.ok) job.resolve(msg)
      else job.reject(new Error(msg.error))
    }
    worker.onerror = (e) => {
      for (const [id, job] of pending) {
        job.reject(new Error(e.message))
        pending.delete(id)
      }
    }
  }
  return worker
}

let counter = 0
function nextId() { return `ai_${Date.now().toString(36)}_${(counter++).toString(36)}` }

interface RunOptions {
  onProgress?: (progress: number, detail?: string) => void
}

function run(req: AiRequestPayload, transfer: ArrayBuffer[], opts?: RunOptions): Promise<AiSuccess> {
  const id = nextId()
  const full = { ...req, id, publicBasePath: publicBasePath() } as AiRequest
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject, onProgress: opts?.onProgress })
    getWorker().postMessage(full, transfer)
  })
}

export interface PixelBuffer { data: Uint8ClampedArray; width: number; height: number }

/** Copy before transfer so the live canvas ImageData is not detached. */
function copyBuffer(src: Uint8ClampedArray): ArrayBuffer {
  return new Uint8ClampedArray(src).buffer as ArrayBuffer
}

export const aiClient = {
  autoColor: (img: PixelBuffer, opts?: RunOptions) => {
    const data = copyBuffer(img.data)
    return run({ op: 'auto-color', data, width: img.width, height: img.height }, [data], opts)
  },

  denoise: (img: PixelBuffer, strength: number, opts?: RunOptions) => {
    const data = copyBuffer(img.data)
    return run({ op: 'denoise', data, width: img.width, height: img.height, strength }, [data], opts)
  },

  faceEnhance: (img: PixelBuffer, smoothing: number, clarity: number, opts?: RunOptions) => {
    const data = copyBuffer(img.data)
    return run({ op: 'face-enhance', data, width: img.width, height: img.height, smoothing, clarity }, [data], opts)
  },

  removeBackground: (img: PixelBuffer, useModel: boolean, opts?: RunOptions) => {
    const data = copyBuffer(img.data)
    return run({ op: 'bg-remove', data, width: img.width, height: img.height, useModel }, [data], opts)
  },

  upscale: (img: PixelBuffer, factor: UpscaleFactor, useModel: boolean, opts?: RunOptions) => {
    const data = copyBuffer(img.data)
    return run({ op: 'upscale', data, width: img.width, height: img.height, factor, useModel }, [data], opts)
  },

  smartSelect: (img: PixelBuffer, seedX: number, seedY: number, opts?: RunOptions) => {
    const data = copyBuffer(img.data)
    return run({ op: 'smart-select', data, width: img.width, height: img.height, seedX, seedY }, [data], opts)
  },

  objectRemoval: (img: PixelBuffer, mask: Uint8ClampedArray, opts?: RunOptions) => {
    const data = copyBuffer(img.data)
    const maskBuf = copyBuffer(mask)
    return run(
      { op: 'object-removal', data, width: img.width, height: img.height, mask: maskBuf },
      [data, maskBuf],
      opts,
    )
  },

  lowLight: (img: PixelBuffer, opts?: RunOptions) => {
    const data = copyBuffer(img.data)
    return run({ op: 'low-light', data, width: img.width, height: img.height }, [data], opts)
  },

  dehaze: (img: PixelBuffer, opts?: RunOptions) => {
    const data = copyBuffer(img.data)
    return run({ op: 'dehaze', data, width: img.width, height: img.height }, [data], opts)
  },

  clarity: (img: PixelBuffer, opts?: RunOptions) => {
    const data = copyBuffer(img.data)
    return run({ op: 'clarity', data, width: img.width, height: img.height }, [data], opts)
  },

  vibrance: (img: PixelBuffer, opts?: RunOptions) => {
    const data = copyBuffer(img.data)
    return run({ op: 'vibrance', data, width: img.width, height: img.height }, [data], opts)
  },

  backgroundBlur: (img: PixelBuffer, opts?: RunOptions & { strength?: number; mask?: Uint8ClampedArray }) => {
    const data = copyBuffer(img.data)
    return run(
      {
        op: 'portrait-blur',
        data,
        width: img.width,
        height: img.height,
        useModel: true,
        maxBlurRadius: Math.round(10 + Math.max(0, Math.min(1, opts?.strength ?? 0.78)) * 26),
      },
      [data],
      opts,
    )
  },

  portraitBlur: (img: PixelBuffer, useModel: boolean, opts?: RunOptions & { maxBlurRadius?: number }) => {
    const data = copyBuffer(img.data)
    return run(
      {
        op: 'portrait-blur',
        data,
        width: img.width,
        height: img.height,
        useModel,
        maxBlurRadius: opts?.maxBlurRadius,
      },
      [data],
      opts,
    )
  },

  terminate: () => { worker?.terminate(); worker = null; pending.clear() },
}
