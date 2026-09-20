/**
 * AI worker: hosts every pixel-heavy AI operation off the main thread so the
 * UI stays responsive during processing. One request = one response, keyed
 * by `id`; large buffers are transferred (not copied) both ways.
 */
/// <reference lib="webworker" />

import { setPublicBasePath } from '@/lib/public-url'
import { inpaintObject } from '../algorithms/inpaint'
import { applyAlphaMatte, segmentWithModel } from '../algorithms/background-removal'
import { upscaleWithModel, type UpscaleFactor } from '../algorithms/upscale'
import { smartSelectFloodFill } from '../algorithms/smart-select'
import {
  DEFAULT_PORTRAIT_BLUR,
  paramsFromStrength,
  runPortraitBlur,
} from '../algorithms/portrait-blur'
import {
  gatedAutoColor,
  gatedClarity,
  gatedDehaze,
  gatedDenoise,
  gatedFaceEnhance,
  gatedLowLight,
  gatedUpscale,
  gatedVibrance,
  type GatedResult,
} from '../algorithms/gated'

export type AiRequest =
  | { id: string; op: 'auto-color'; data: ArrayBuffer; width: number; height: number }
  | { id: string; op: 'denoise'; data: ArrayBuffer; width: number; height: number; strength: number }
  | { id: string; op: 'face-enhance'; data: ArrayBuffer; width: number; height: number; smoothing: number; clarity: number }
  | { id: string; op: 'bg-remove'; data: ArrayBuffer; width: number; height: number; useModel: boolean }
  | { id: string; op: 'upscale'; data: ArrayBuffer; width: number; height: number; factor: UpscaleFactor; useModel: boolean }
  | { id: string; op: 'smart-select'; data: ArrayBuffer; width: number; height: number; seedX: number; seedY: number }
  | { id: string; op: 'object-removal'; data: ArrayBuffer; width: number; height: number; mask: ArrayBuffer }
  | { id: string; op: 'low-light'; data: ArrayBuffer; width: number; height: number }
  | { id: string; op: 'dehaze'; data: ArrayBuffer; width: number; height: number }
  | { id: string; op: 'clarity'; data: ArrayBuffer; width: number; height: number }
  | { id: string; op: 'vibrance'; data: ArrayBuffer; width: number; height: number }
  | { id: string; op: 'bg-blur'; data: ArrayBuffer; width: number; height: number; strength?: number; mask?: ArrayBuffer }
  | {
      id: string
      op: 'portrait-blur'
      data: ArrayBuffer
      width: number
      height: number
      useModel: boolean
      maxBlurRadius?: number
    }

export type AiResponse =
  | { id: string; ok: true; result: ArrayBuffer; width: number; height: number; meta?: Record<string, unknown> }
  | { id: string; ok: false; error: string }
  | { id: string; progress: number; detail?: string }

const ctx = self as unknown as DedicatedWorkerGlobalScope

function reportProgress(id: string, progress: number, detail?: string) {
  ctx.postMessage({ id, progress, detail } satisfies AiResponse)
}

function respondGated(id: string, out: GatedResult) {
  respond(id, out.data.buffer as ArrayBuffer, out.width, out.height, {
    skipped: out.skipped,
    ...out.meta,
  })
}

ctx.onmessage = async (e: MessageEvent<AiRequest & { publicBasePath?: string }>) => {
  const req = e.data
  if (typeof req.publicBasePath === 'string') setPublicBasePath(req.publicBasePath)
  try {
    switch (req.op) {
      case 'auto-color': {
        const data = new Uint8ClampedArray(req.data)
        respondGated(req.id, gatedAutoColor(data, req.width, req.height))
        break
      }
      case 'denoise': {
        reportProgress(req.id, -1, 'Filtering noise…')
        const data = new Uint8ClampedArray(req.data)
        respondGated(req.id, gatedDenoise(data, req.width, req.height, req.strength))
        break
      }
      case 'face-enhance': {
        reportProgress(req.id, -1, 'Detecting skin regions…')
        const data = new Uint8ClampedArray(req.data)
        respondGated(req.id, gatedFaceEnhance(data, req.width, req.height, req.smoothing, req.clarity))
        break
      }
      case 'bg-remove': {
        reportProgress(req.id, -1, 'Loading portrait model…')
        const data = new Uint8ClampedArray(req.data)
        reportProgress(req.id, 0.2, 'Segmenting subject…')
        const matte = await segmentWithModel(data, req.width, req.height)
        const out = applyAlphaMatte(data, matte)
        let cleared = 0
        for (let i = 0; i < matte.length; i++) if (matte[i] < 8) cleared++
        respond(req.id, out.buffer as ArrayBuffer, req.width, req.height, {
          matte: true,
          clearedFraction: cleared / matte.length,
        })
        break
      }
      case 'upscale': {
        reportProgress(req.id, -1, `Upscaling ${req.factor}×…`)
        if (req.useModel) {
          const data = new Uint8ClampedArray(req.data)
          const out = await upscaleWithModel(data, req.width, req.height, req.factor)
          respond(req.id, out.data.buffer as ArrayBuffer, out.width, out.height)
        } else {
          const data = new Uint8ClampedArray(req.data)
          respondGated(req.id, gatedUpscale(data, req.width, req.height, req.factor))
        }
        break
      }
      case 'smart-select': {
        const data = new Uint8ClampedArray(req.data)
        const mask = smartSelectFloodFill(data, req.width, req.height, req.seedX, req.seedY)
        respond(req.id, mask.buffer as ArrayBuffer, req.width, req.height)
        break
      }
      case 'object-removal': {
        reportProgress(req.id, 0.05, 'Loading Magic Eraser…')
        const data = new Uint8ClampedArray(req.data)
        const mask = new Uint8ClampedArray(req.mask)
        const out = await inpaintObject(data, req.width, req.height, mask, (p, detail) =>
          reportProgress(req.id, p, detail),
        )
        respond(req.id, out.data.buffer as ArrayBuffer, req.width, req.height, { backend: out.backend })
        break
      }
      case 'low-light': {
        reportProgress(req.id, -1, 'Opening shadows…')
        const data = new Uint8ClampedArray(req.data)
        respondGated(req.id, gatedLowLight(data, req.width, req.height))
        break
      }
      case 'dehaze': {
        reportProgress(req.id, -1, 'Clearing haze…')
        const data = new Uint8ClampedArray(req.data)
        respondGated(req.id, gatedDehaze(data, req.width, req.height))
        break
      }
      case 'clarity': {
        reportProgress(req.id, -1, 'Lifting local contrast…')
        const data = new Uint8ClampedArray(req.data)
        respondGated(req.id, gatedClarity(data, req.width, req.height))
        break
      }
      case 'vibrance': {
        reportProgress(req.id, -1, 'Popping muted colour…')
        const data = new Uint8ClampedArray(req.data)
        respondGated(req.id, gatedVibrance(data, req.width, req.height))
        break
      }
      case 'bg-blur': {
        reportProgress(req.id, -1, 'Loading portrait model…')
        const data = new Uint8ClampedArray(req.data)
        reportProgress(req.id, 0.45, 'Rendering disc bokeh…')
        const out = await runPortraitBlur(
          data,
          req.width,
          req.height,
          true,
          paramsFromStrength(req.strength ?? 0.78),
        )
        respond(req.id, out.data.buffer as ArrayBuffer, req.width, req.height, { source: out.source })
        break
      }
      case 'portrait-blur': {
        reportProgress(req.id, -1, 'Loading portrait model…')
        const data = new Uint8ClampedArray(req.data)
        const params = {
          ...DEFAULT_PORTRAIT_BLUR,
          ...(typeof req.maxBlurRadius === 'number' ? { maxBlurRadius: req.maxBlurRadius } : {}),
        }
        reportProgress(req.id, 0.45, 'Rendering disc bokeh…')
        const out = await runPortraitBlur(data, req.width, req.height, req.useModel, params)
        respond(req.id, out.data.buffer as ArrayBuffer, req.width, req.height, { source: out.source, bokeh: true })
        break
      }
    }
  } catch (err) {
    ctx.postMessage({ id: req.id, ok: false, error: err instanceof Error ? err.message : String(err) } satisfies AiResponse)
  }
}

function respond(id: string, buffer: ArrayBuffer, width: number, height: number, meta?: Record<string, unknown>) {
  ctx.postMessage(
    { id, ok: true, result: buffer, width, height, meta } satisfies AiResponse,
    { transfer: [buffer] },
  )
}
