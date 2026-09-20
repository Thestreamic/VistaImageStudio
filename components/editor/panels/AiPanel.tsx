'use client'
import { useState } from 'react'
import { Sparkles, Scissors, Wind, ArrowUpToLine, UserRound, Eraser, Moon, CloudFog, Aperture, Palette, WandSparkles, Focus, Leaf, RectangleVertical } from 'lucide-react'
import { useEditorStore, selectPhotoLayer } from '@/features/editor/store/editor-store'
import { aiClient } from '@/features/ai/ai-client'
import { imageDataOf, canvasFromImageData } from '@/lib/image/canvas'
import { PRO_PHONE_LOOK_ID } from '@/features/editor/camera-profiles'
import { cropRectForPreset } from '@/features/editor/crop-presets'
import { aiSkipMessage } from '@/features/ai/algorithms/gated'
import { selectionMaskForLayer } from '@/features/editor/engine/selection'
import { Slider } from './Slider'

/** Runs an AI op against the active layer's pixels and commits the result as a new layer state. */
function useAiRunner() {
  const doc = useEditorStore((s) => s.doc)
  const layer = useEditorStore(selectPhotoLayer)
  const setAiJob = useEditorStore((s) => s.setAiJob)
  const notify = useEditorStore((s) => s.notify)
  const replaceLayerPixels = useEditorStore((s) => s.replaceLayerPixels)
  const resizeDocumentToLayer = useEditorStore((s) => s.resizeDocumentToLayer)

  const runOp = async (
    label: string,
    op: (img: { data: Uint8ClampedArray; width: number; height: number }, onProgress: (p: number, d?: string) => void) => Promise<{ result: ArrayBuffer; width: number; height: number; meta?: Record<string, unknown> }>,
    opts?: { resizesDocument?: boolean },
  ) => {
    if (!layer || !doc) return
    const jobId = `${Date.now()}`
    setAiJob({ id: jobId, label, progress: -1 })
    try {
      const imgData = imageDataOf(layer.source)
      const { result, width, height, meta } = await op(
        { data: imgData.data, width: imgData.width, height: imgData.height },
        (progress, detail) => setAiJob({ id: jobId, label, progress, detail }),
      )
      if (meta?.skipped) {
        notify('info', aiSkipMessage(meta.reason))
        return
      }
      const outData = new ImageData(new Uint8ClampedArray(result), width, height)
      const outCanvas = canvasFromImageData(outData)
      if (opts?.resizesDocument) resizeDocumentToLayer(layer.id, outCanvas)
      else replaceLayerPixels(layer.id, outCanvas, label)
      const cleared = typeof meta?.clearedFraction === 'number' ? meta.clearedFraction : null
      if (cleared !== null && cleared < 0.01) {
        notify('info', `${label} complete — no clear backdrop found. Try Magic Eraser for a busy background`)
      } else {
        notify('success', `${label} complete on ${layer.name}`)
      }
    } catch (err) {
      notify('error', `${label} failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setAiJob(null)
    }
  }

  return { runOp, hasLayer: !!layer }
}

export function AiPanel() {
  const { runOp, hasLayer } = useAiRunner()
  const doc = useEditorStore((s) => s.doc)
  const aiJob = useEditorStore((s) => s.aiJob)
  const applyLook = useEditorStore((s) => s.applyLook)
  const setLiveCrop = useEditorStore((s) => s.setLiveCrop)
  const notify = useEditorStore((s) => s.notify)
  const [denoiseStrength, setDenoiseStrength] = useState(18)
  const [faceSmoothing, setFaceSmoothing] = useState(18)
  const [faceClarity, setFaceClarity] = useState(10)
  const busy = !!aiJob

  const btnBase =
    'w-full flex items-center gap-2 px-2.5 py-2 text-[13px] font-medium rounded-md bg-secondary hover:bg-secondary/80 disabled:opacity-40 disabled:pointer-events-none transition-colors min-h-9 max-md:min-h-11'

  return (
    <div className="p-3 space-y-4">
      <div>
        <span className="panel-label">One-click</span>
        <div className="one-click-tools mt-2 space-y-1.5">
          <button
            type="button"
            disabled={!hasLayer || busy}
            data-testid="auto-optimize-ai"
            onClick={() => {
              applyLook(PRO_PHONE_LOOK_ID, 100, true) && notify('success', 'Optimize Image applied')
            }}
            className="w-full flex items-center gap-2 px-2.5 py-2.5 text-[13px] rounded-md brand-gradient-bg text-white font-semibold disabled:opacity-40 disabled:pointer-events-none min-h-9 max-md:min-h-11"
            title="One-click grade: brightness, color, vibrance, clarity, sharpness"
          >
            <WandSparkles size={13} /> Optimize Image
          </button>
          <button
            type="button"
            disabled={!hasLayer || busy}
            onClick={() => {
              applyLook('natural-mobile', 100, true)
              notify('success', 'Natural Color look applied')
            }}
            className={btnBase}
            title="True-to-life mobile grade — sun stays white-gold"
          >
            <Leaf size={13} /> Natural Color
          </button>
          <button
            disabled={!hasLayer || busy}
            onClick={() => runOp('Auto Color', (img, onP) => aiClient.autoColor(img, { onProgress: onP }))}
            className={btnBase}
          >
            <Sparkles size={13} /> Auto Color Correct
          </button>
          <button
            disabled={!hasLayer || busy}
            data-testid="portrait-bokeh"
            onClick={() => runOp('Portrait Bokeh', (img, onP) => aiClient.portraitBlur(img, true, { onProgress: onP }))}
            className={btnBase}
            title="Depth-based disc bokeh: sharp subject, soft falloff, glowing highlight orbs"
          >
            <Focus size={13} /> Portrait Bokeh
          </button>
          <button
            disabled={!hasLayer || busy}
            onClick={() => runOp('Remove Background', (img, onP) => aiClient.removeBackground(img, true, { onProgress: onP }))}
            data-testid="remove-background"
            className={btnBase}
            title="Cut the subject free on a transparent backdrop"
          >
            <Scissors size={13} /> Remove Background
          </button>
          <MagicEraserButton disabled={!hasLayer || busy} className={btnBase} />
          <button
            type="button"
            disabled={!hasLayer || busy || !doc}
            data-testid="instagram-4-5"
            onClick={() => {
              if (!doc) return
              setLiveCrop(cropRectForPreset(doc.width, doc.height, '4:5'))
              notify('info', 'Instagram 4:5 crop ready — confirm in Transform')
            }}
            className={btnBase}
            title="Largest centered 4:5 crop for Instagram portrait"
          >
            <RectangleVertical size={13} /> Instagram 4:5
          </button>
          <button
            disabled={!hasLayer || busy}
            onClick={() => runOp('Low Light', (img, onP) => aiClient.lowLight(img, { onProgress: onP }))}
            className={btnBase}
          >
            <Moon size={13} /> Low Light
          </button>
          <button
            disabled={!hasLayer || busy}
            onClick={() => runOp('Dehaze', (img, onP) => aiClient.dehaze(img, { onProgress: onP }))}
            className={btnBase}
          >
            <CloudFog size={13} /> Dehaze
          </button>
          <button
            disabled={!hasLayer || busy}
            onClick={() => runOp('Clarity', (img, onP) => aiClient.clarity(img, { onProgress: onP }))}
            className={btnBase}
          >
            <Aperture size={13} /> Clarity
          </button>
          <button
            disabled={!hasLayer || busy}
            onClick={() => runOp('Vibrance', (img, onP) => aiClient.vibrance(img, { onProgress: onP }))}
            className={btnBase}
          >
            <Palette size={13} /> Vibrance
          </button>
          <button
            disabled={!hasLayer || busy}
            onClick={() => runOp('Upscale 2×', (img, onP) => aiClient.upscale(img, 2, false, { onProgress: onP }), { resizesDocument: true })}
            className={btnBase}
          >
            <ArrowUpToLine size={13} /> Upscale 2×
          </button>
        </div>
      </div>

      <div className="h-px bg-border" />

      <div className="space-y-2">
        <span className="panel-label">Denoise</span>
        <Slider label="Strength" value={denoiseStrength} min={0} max={100} onChange={setDenoiseStrength} />
        <button
          disabled={!hasLayer || busy}
          onClick={() => runOp('Denoise', (img, onP) => aiClient.denoise(img, denoiseStrength, { onProgress: onP }))}
          className={btnBase}
        >
          <Wind size={13} /> Apply Denoise
        </button>
      </div>

      <div className="h-px bg-border" />

      <div className="space-y-2">
        <span className="panel-label">Face Enhance</span>
        <Slider label="Smoothing" value={faceSmoothing} min={0} max={100} onChange={setFaceSmoothing} />
        <Slider label="Clarity" value={faceClarity} min={0} max={100} onChange={setFaceClarity} />
        <button
          disabled={!hasLayer || busy}
          onClick={() => runOp('Face Enhance', (img, onP) => aiClient.faceEnhance(img, faceSmoothing, faceClarity, { onProgress: onP }))}
          className={btnBase}
        >
          <UserRound size={13} /> Apply Face Enhance
        </button>
      </div>
    </div>
  )
}

function MagicEraserButton({ disabled, className }: { disabled: boolean; className: string }) {
  const doc = useEditorStore((s) => s.doc)
  const layer = useEditorStore(selectPhotoLayer)
  const setAiJob = useEditorStore((s) => s.setAiJob)
  const notify = useEditorStore((s) => s.notify)
  const replaceLayerPixels = useEditorStore((s) => s.replaceLayerPixels)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const setTool = useEditorStore((s) => s.setTool)

  const run = async () => {
    if (!layer || !doc) return
    if (!doc.selection) {
      setTool('select-rect')
      notify('info', 'Select the object (box or wand), then click Magic Eraser.')
      return
    }
    const mask = selectionMaskForLayer(doc.selection, layer)
    const jobId = `${Date.now()}`
    setAiJob({ id: jobId, label: 'Magic Eraser', progress: -1 })
    try {
      const imgData = imageDataOf(layer.source)
      const { result, width, height, meta } = await aiClient.objectRemoval(
        { data: imgData.data, width: imgData.width, height: imgData.height },
        mask,
        { onProgress: (p, d) => setAiJob({ id: jobId, label: 'Magic Eraser', progress: p, detail: d }) },
      )
      const outCanvas = canvasFromImageData(new ImageData(new Uint8ClampedArray(result), width, height))
      replaceLayerPixels(layer.id, outCanvas, 'Magic Eraser')
      clearSelection()
      notify(
        'success',
        meta?.backend === 'diffusion'
          ? 'Magic Eraser used a fast fill (LaMa model not loaded yet)'
          : 'Magic Eraser complete',
      )
    } catch (err) {
      notify('error', `Magic Eraser failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setAiJob(null)
    }
  }

  return (
    <button
      type="button"
      disabled={disabled}
      data-testid="magic-eraser"
      title="Select an object, then fill the hole with surrounding pixels"
      onClick={run}
      className={className}
    >
      <Eraser size={13} /> Magic Eraser
    </button>
  )
}
