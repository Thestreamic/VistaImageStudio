import { aiClient } from '@/features/ai/ai-client'
import { aiSkipMessage } from '@/features/ai/algorithms/gated'
import { LOCKED_DISC_FOCUS } from '@/features/ai/algorithms/bokeh'
import { PRO_PHONE_LOOK_ID } from '@/features/editor/camera-profiles'
import { cropRectForPreset } from '@/features/editor/crop-presets'
import { selectionMaskForLayer } from '@/features/editor/engine/selection'
import { selectPhotoLayer, useEditorStore } from '@/features/editor/store/editor-store'
import { canvasFromImageData, imageDataOf } from '@/lib/image/canvas'

/** Portrait Bokeh reads the AI panel Background slider. Defaults to the locked centre (f/2). */
let portraitDiscFocus = LOCKED_DISC_FOCUS

export function getPortraitDiscFocus(): number {
  return portraitDiscFocus
}

export function setPortraitDiscFocus(value: number): void {
  portraitDiscFocus = value
}

type PixelOp = (
  img: { data: Uint8ClampedArray; width: number; height: number },
  onProgress: (p: number, d?: string) => void,
) => Promise<{ result: ArrayBuffer; width: number; height: number; meta?: Record<string, unknown> }>

/** Same runner the AI panel buttons use: progress job, try/catch, then commit pixels. */
export async function runAiOp(
  label: string,
  op: PixelOp,
  opts?: { resizesDocument?: boolean },
): Promise<void> {
  const state = useEditorStore.getState()
  const doc = state.doc
  const layer = doc ? selectPhotoLayer(state) : null
  if (!layer || !doc) return
  const jobId = `${Date.now()}`
  const setAiJob = state.setAiJob
  setAiJob({ id: jobId, label, progress: -1 })
  try {
    const imgData = imageDataOf(layer.source)
    const { result, width, height, meta } = await op(
      { data: imgData.data, width: imgData.width, height: imgData.height },
      (progress, detail) => setAiJob({ id: jobId, label, progress, detail }),
    )
    const latest = useEditorStore.getState()
    if (meta?.skipped) {
      latest.notify('info', aiSkipMessage(meta.reason))
      return
    }
    const outData = new ImageData(new Uint8ClampedArray(result), width, height)
    const outCanvas = canvasFromImageData(outData)
    if (opts?.resizesDocument) latest.resizeDocumentToLayer(layer.id, outCanvas)
    else latest.replaceLayerPixels(layer.id, outCanvas, label)
    const cleared = typeof meta?.clearedFraction === 'number' ? meta.clearedFraction : null
    if (cleared !== null && cleared < 0.01) {
      latest.notify('info', `${label} complete — no clear backdrop found. Try Magic Eraser for a busy background`)
    } else {
      latest.notify('success', `${label} complete on ${layer.name}`)
    }
  } catch (err) {
    useEditorStore.getState().notify('error', `${label} failed: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    useEditorStore.getState().setAiJob(null)
  }
}

export function runOptimizeImage(): void {
  const { applyLook, notify } = useEditorStore.getState()
  if (applyLook(PRO_PHONE_LOOK_ID, 100, true)) notify('success', 'Optimize Image applied')
}

export function runNaturalColor(): void {
  const { applyLook, notify } = useEditorStore.getState()
  applyLook('natural-mobile', 100, true)
  notify('success', 'Natural Color look applied')
}

export function runAutoColor(): Promise<void> {
  return runAiOp('Auto Color', (img, onP) => aiClient.autoColor(img, { onProgress: onP }))
}

export function runPortraitBokeh(): Promise<void> {
  const state = useEditorStore.getState()
  const photo = state.doc ? selectPhotoLayer(state) : null
  const mask = state.doc?.selection && photo ? selectionMaskForLayer(state.doc.selection, photo) : undefined
  const discFocus = getPortraitDiscFocus()
  return runAiOp('Portrait Bokeh', (img, onP) =>
    aiClient.portraitBlur(img, true, { onProgress: onP, mask, discFocus }),
  )
}

export function runRemoveBackground(): Promise<void> {
  return runAiOp('Remove Background', (img, onP) => aiClient.removeBackground(img, true, { onProgress: onP }))
}

export async function runMagicEraser(): Promise<void> {
  const state = useEditorStore.getState()
  const doc = state.doc
  const layer = doc ? selectPhotoLayer(state) : null
  if (!layer || !doc) return
  if (!doc.selection) {
    state.setTool('select-wand')
    state.notify('info', 'Click the object to select it, then click Magic Eraser again. Or press M and drag a box.')
    return
  }
  const mask = selectionMaskForLayer(doc.selection, layer)
  const jobId = `${Date.now()}`
  state.setAiJob({ id: jobId, label: 'Magic Eraser', progress: -1 })
  try {
    const imgData = imageDataOf(layer.source)
    const { result, width, height, meta } = await aiClient.objectRemoval(
      { data: imgData.data, width: imgData.width, height: imgData.height },
      mask,
      { onProgress: (p, d) => useEditorStore.getState().setAiJob({ id: jobId, label: 'Magic Eraser', progress: p, detail: d }) },
    )
    const latest = useEditorStore.getState()
    const outCanvas = canvasFromImageData(new ImageData(new Uint8ClampedArray(result), width, height))
    latest.replaceLayerPixels(layer.id, outCanvas, 'Magic Eraser')
    latest.clearSelection()
    latest.notify(
      'success',
      meta?.backend === 'diffusion'
        ? 'Magic Eraser used a fast fill (LaMa model not loaded yet)'
        : 'Magic Eraser complete',
    )
  } catch (err) {
    useEditorStore.getState().notify('error', `Magic Eraser failed: ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    useEditorStore.getState().setAiJob(null)
  }
}

export function runInstagram45(): void {
  const { doc, setLiveCrop, notify } = useEditorStore.getState()
  if (!doc) return
  setLiveCrop(cropRectForPreset(doc.width, doc.height, '4:5'))
  notify('info', 'Instagram 4:5 crop ready — confirm in Transform')
}

export function runLowLight(): Promise<void> {
  return runAiOp('Low Light', (img, onP) => aiClient.lowLight(img, { onProgress: onP }))
}

export function runDehaze(): Promise<void> {
  return runAiOp('Dehaze', (img, onP) => aiClient.dehaze(img, { onProgress: onP }))
}

export function runClarity(): Promise<void> {
  return runAiOp('Clarity', (img, onP) => aiClient.clarity(img, { onProgress: onP }))
}

export function runVibrance(): Promise<void> {
  return runAiOp('Vibrance', (img, onP) => aiClient.vibrance(img, { onProgress: onP }))
}

export function runUpscale2x(): Promise<void> {
  return runAiOp('Upscale 2×', (img, onP) => aiClient.upscale(img, 2, false, { onProgress: onP }), {
    resizesDocument: true,
  })
}
