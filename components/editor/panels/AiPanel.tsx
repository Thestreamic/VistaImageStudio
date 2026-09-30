'use client'
import { useState, type ReactNode } from 'react'
import { Sparkles, Scissors, Wind, ArrowUpToLine, UserRound, Eraser, Moon, CloudFog, Aperture, Palette, WandSparkles, Focus, Leaf, RectangleVertical, ShieldCheck, Loader2, type LucideIcon } from 'lucide-react'
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
  const off = !hasLayer || busy

  // One button style for every AI action; the running one shows a spinner.
  const tool = (
    label: string,
    icon: LucideIcon,
    onClick: () => void,
    opts?: { title?: string; testId?: string; job?: string; disabled?: boolean; text?: string },
  ) => {
    const running = aiJob?.label === (opts?.job ?? label)
    const Icon = running ? Loader2 : icon
    return (
      <button
        type="button"
        disabled={opts?.disabled ?? off}
        data-testid={opts?.testId}
        data-busy={running || undefined}
        onClick={onClick}
        className="ui-btn"
        title={opts?.title}
      >
        <Icon size={14} className={running ? 'animate-spin' : undefined} /> {opts?.text ?? label}
      </button>
    )
  }

  return (
    <div className="p-3 space-y-5">
      <p className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
        <ShieldCheck size={13} className="text-success shrink-0" />
        One-click AI · runs on this device
      </p>

      <Group title="Enhance">
        <div className="one-click-tools grid gap-1.5">
          <button
            type="button"
            disabled={off}
            data-testid="auto-optimize-ai"
            onClick={runOptimizeImage}
            className="w-full flex items-center gap-2 px-3 py-2.5 text-[13px] rounded-md brand-gradient-bg text-white font-semibold shadow-sm transition-[filter,transform] hover:brightness-110 active:translate-y-px disabled:opacity-40 disabled:pointer-events-none min-h-10 max-md:min-h-11"
            title="Improve light, colour and detail in one click"
          >
            <WandSparkles size={14} /> Optimize Image
          </button>
          {tool('Natural Color', Leaf, runNaturalColor, { title: 'True-to-life colour, like a modern phone camera' })}
          {tool('Auto Color Correct', Sparkles, () => void runAutoColor(), {
            job: 'Auto Color',
            title: 'Fix white balance and levels automatically',
          })}
        </div>
      </Group>

      <Group title="Subject">
        <div className="one-click-tools grid gap-1.5">
          {tool('Remove Background', Scissors, () => void runRemoveBackground(), {
            testId: 'remove-background',
            title: 'Keep your subject, remove the background',
          })}
          {tool('Magic Eraser', Eraser, () => void runMagicEraser(), {
            testId: 'magic-eraser',
            title: 'Remove unwanted objects. Click the object (or drag a box), then click Magic Eraser again.',
          })}
        </div>
        <div className="mt-1.5 rounded-md border border-border bg-secondary/35 p-2 space-y-2.5">
          {tool('Portrait Bokeh', Focus, () => void runPortraitBokeh(), {
            testId: 'portrait-bokeh',
            title: 'Blur the background behind your subject. Select the subject first if it is not a person.',
          })}
          <div className="px-0.5">
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
            <p className="mt-1 text-[11px] text-muted-foreground">Pick the blur, then click Portrait Bokeh. Centre is the recommended look.</p>
          </div>
        </div>
      </Group>

      <Group title="Fix">
        <div className="one-click-tools grid grid-cols-2 gap-1.5">
          {tool('Low Light', Moon, () => void runLowLight(), { title: 'Brighten a dark photo' })}
          {tool('Dehaze', CloudFog, () => void runDehaze(), { title: 'Cut haze and fog' })}
          {tool('Clarity', Aperture, () => void runClarity(), { title: 'Boost local contrast and texture' })}
          {tool('Vibrance', Palette, () => void runVibrance(), {
            title: 'Boost muted colours, gentle on skin. Fine-tune with Adjust → Vibrance.',
          })}
        </div>

        <SubTool title="Denoise">
          <Slider label="Strength" value={denoiseStrength} min={0} max={100} onChange={setDenoiseStrength} />
          {tool(
            'Denoise',
            Wind,
            () => void runAiOp('Denoise', (img, onP) => aiClient.denoise(img, denoiseStrength, { onProgress: onP })),
            { text: 'Apply Denoise', title: 'Smooth grain and noise from low-light shots' },
          )}
        </SubTool>

        <SubTool title="Face Enhance">
          <Slider label="Smoothing" value={faceSmoothing} min={0} max={100} onChange={setFaceSmoothing} />
          <Slider label="Clarity" value={faceClarity} min={0} max={100} onChange={setFaceClarity} />
          {tool(
            'Face Enhance',
            UserRound,
            () =>
              void runAiOp('Face Enhance', (img, onP) =>
                aiClient.faceEnhance(img, faceSmoothing, faceClarity, { onProgress: onP }),
              ),
            { text: 'Apply Face Enhance', title: 'Smooth skin and sharpen facial detail' },
          )}
        </SubTool>
      </Group>

      <Group title="Size">
        <div className="one-click-tools grid grid-cols-2 gap-1.5">
          {tool('Upscale 2×', ArrowUpToLine, () => void runUpscale2x(), { title: 'Double the width and height of the photo' })}
          {tool('Instagram 4:5', RectangleVertical, runInstagram45, {
            testId: 'instagram-4-5',
            disabled: off || !doc,
            title: 'Crop to Instagram portrait (4:5). Fine-tune in Transform → Crop.',
          })}
        </div>
      </Group>
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="section-title">{title}</h3>
      {children}
    </section>
  )
}

function SubTool({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3 space-y-2">
      <p className="text-[12px] font-medium text-foreground/90">{title}</p>
      {children}
    </div>
  )
}
