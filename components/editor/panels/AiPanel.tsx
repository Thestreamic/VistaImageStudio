'use client'
import { useState } from 'react'
import { Sparkles, Scissors, Wind, ArrowUpToLine, UserRound, Eraser, Moon, CloudFog, Aperture, Palette, WandSparkles, Focus, Leaf, RectangleVertical } from 'lucide-react'
import { useEditorStore, selectPhotoLayer } from '@/features/editor/store/editor-store'
import { aiClient } from '@/features/ai/ai-client'
import { Slider } from './Slider'
import { discFocusLabel, LOCKED_DISC_FOCUS } from '@/features/ai/algorithms/bokeh'
import {
  runAiOp,
  runAutoColor,
  runClarity,
  runDehaze,
  runInstagram45,
  runLowLight,
  runMagicEraser,
  runNaturalColor,
  runOptimizeImage,
  runPortraitBokeh,
  runRemoveBackground,
  runUpscale2x,
  runVibrance,
  setPortraitDiscFocus,
} from '@/features/editor/one-click-actions'

export function AiPanel() {
  const doc = useEditorStore((s) => s.doc)
  const hasLayer = useEditorStore((s) => !!selectPhotoLayer(s))
  const aiJob = useEditorStore((s) => s.aiJob)
  const [discFocus, setDiscFocus] = useState(LOCKED_DISC_FOCUS)
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
            onClick={runOptimizeImage}
            className="w-full flex items-center gap-2 px-2.5 py-2.5 text-[13px] rounded-md brand-gradient-bg text-white font-semibold disabled:opacity-40 disabled:pointer-events-none min-h-9 max-md:min-h-11"
            title="One-click grade: brightness, color, vibrance, clarity, sharpness"
          >
            <WandSparkles size={13} /> Optimize Image
          </button>
          <button
            type="button"
            disabled={!hasLayer || busy}
            onClick={runNaturalColor}
            className={btnBase}
            title="True-to-life mobile grade — sun stays white-gold"
          >
            <Leaf size={13} /> Natural Color
          </button>
          <button
            disabled={!hasLayer || busy}
            onClick={() => void runAutoColor()}
            className={btnBase}
          >
            <Sparkles size={13} /> Auto Color Correct
          </button>
          <Slider
            label="Background"
            value={discFocus}
            min={0}
            max={100}
            onChange={(value) => {
              setDiscFocus(value)
              setPortraitDiscFocus(value)
            }}
            formatValue={discFocusLabel}
          />
          <button
            disabled={!hasLayer || busy}
            data-testid="portrait-bokeh"
            onClick={() => void runPortraitBokeh()}
            className={btnBase}
            title="Centre is the locked look (f/2). Move left for a bit more background focus, right for a bit more blur, then apply."
          >
            <Focus size={13} /> Portrait Bokeh
          </button>
          <button
            disabled={!hasLayer || busy}
            onClick={() => void runRemoveBackground()}
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
            onClick={runInstagram45}
            className={btnBase}
            title="Largest centered 4:5 crop for Instagram portrait"
          >
            <RectangleVertical size={13} /> Instagram 4:5
          </button>
          <button
            disabled={!hasLayer || busy}
            onClick={() => void runLowLight()}
            className={btnBase}
          >
            <Moon size={13} /> Low Light
          </button>
          <button
            disabled={!hasLayer || busy}
            onClick={() => void runDehaze()}
            className={btnBase}
          >
            <CloudFog size={13} /> Dehaze
          </button>
          <button
            disabled={!hasLayer || busy}
            onClick={() => void runClarity()}
            className={btnBase}
          >
            <Aperture size={13} /> Clarity
          </button>
          <button
            disabled={!hasLayer || busy}
            onClick={() => void runVibrance()}
            className={btnBase}
          >
            <Palette size={13} /> Vibrance
          </button>
          <button
            disabled={!hasLayer || busy}
            onClick={() => void runUpscale2x()}
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
          onClick={() => void runAiOp('Denoise', (img, onP) => aiClient.denoise(img, denoiseStrength, { onProgress: onP }))}
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
          onClick={() =>
            void runAiOp('Face Enhance', (img, onP) =>
              aiClient.faceEnhance(img, faceSmoothing, faceClarity, { onProgress: onP }),
            )
          }
          className={btnBase}
        >
          <UserRound size={13} /> Apply Face Enhance
        </button>
      </div>
    </div>
  )
}

function MagicEraserButton({ disabled, className }: { disabled: boolean; className: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      data-testid="magic-eraser"
      title="Select an object, then fill the hole with surrounding pixels"
      onClick={() => void runMagicEraser()}
      className={className}
    >
      <Eraser size={13} /> Magic Eraser
    </button>
  )
}
