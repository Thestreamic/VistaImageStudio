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
  const optimizeRunning = aiJob?.label === 'Optimize Image'

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
        <Icon size={14} className={running ? 'animate-spin text-primary' : undefined} /> {opts?.text ?? label}
      </button>
    )
  }

  // Subject tools: a full-width row with a short "what it does" hint.
  const subjectTool = (
    label: string,
    icon: LucideIcon,
    onClick: () => void,
    opts: { hint: string; testId: string; title: string },
  ) => {
    const running = aiJob?.label === label
    const Icon = running ? Loader2 : icon
    return (
      <button
        type="button"
        disabled={off}
        data-testid={opts.testId}
        data-busy={running || undefined}
        onClick={onClick}
        className="ui-btn justify-between bg-card"
        title={opts.title}
      >
        <span className="flex items-center gap-2 font-semibold text-foreground whitespace-nowrap">
          <Icon size={14} className={running ? 'animate-spin text-primary' : 'text-primary'} />
          {label}
        </span>
        <span className="text-[11.5px] text-muted-foreground whitespace-nowrap">{opts.hint}</span>
      </button>
    )
  }

  return (
    <div className="p-3 space-y-4">
      {/* On-device status: where the AI runs, in one glance. */}
      <div className="rounded-lg border border-border/80 bg-card p-2.5 space-y-1">
        <div className="flex items-center gap-1.5 text-[12.5px] font-semibold text-foreground">
          <ShieldCheck size={14} className="text-success shrink-0" />
          <span>On-device AI</span>
          <span className="ml-auto text-[11px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">Local</span>
        </div>
        <p className="text-[11.5px] text-muted-foreground leading-snug">
          One-click tools · your photos stay on this device
        </p>
      </div>

      <Group title="Enhance">
        <div className="one-click-tools grid gap-2">
          {/* HERO AI: Optimize Image (token-driven hero button) */}
          <button
            type="button"
            disabled={off}
            data-testid="auto-optimize-ai"
            onClick={runOptimizeImage}
            className={`w-full flex items-center justify-center gap-2 px-3 py-2.5 text-[13.5px] rounded-lg font-semibold shadow-sm transition-all duration-150 min-h-10 max-md:min-h-11 ${
              optimizeRunning
                ? 'bg-secondary border border-primary/60 text-primary animate-pulse'
                : 'btn-hero-ai hover:brightness-105 active:translate-y-px disabled:opacity-50 disabled:pointer-events-none'
            }`}
            title="Improve light, colour and detail in one click"
          >
            {optimizeRunning ? (
              <Loader2 size={15} className="animate-spin text-primary" />
            ) : (
              <WandSparkles size={15} style={{ color: 'var(--hero-foreground)' }} />
            )}
            <span>Optimize Image</span>
          </button>
          {tool('Natural Color', Leaf, runNaturalColor, { title: 'True-to-life colour, like a modern phone camera' })}
          {tool('Auto Color Correct', Sparkles, () => void runAutoColor(), {
            job: 'Auto Color',
            title: 'Fix white balance and levels automatically',
          })}
        </div>
      </Group>

      <Group title="Subject">
        {/* Core subject tools: name on the left, what it does on the right. */}
        <div className="one-click-tools grid gap-1.5">
          {subjectTool('Remove Background', Scissors, () => void runRemoveBackground(), {
            hint: 'Subject only',
            testId: 'remove-background',
            title: 'Keep your subject, remove the background',
          })}
          {subjectTool('Magic Eraser', Eraser, () => void runMagicEraser(), {
            hint: 'Erase objects',
            testId: 'magic-eraser',
            title: 'Remove unwanted objects',
          })}
        </div>

        {/* CORE AI: Portrait Bokeh */}
        <div className="mt-2 rounded-lg border border-border/80 bg-card p-2.5 space-y-2.5">
          <button
            type="button"
            disabled={off}
            data-testid="portrait-bokeh"
            data-busy={aiJob?.label === 'Portrait Bokeh' || undefined}
            onClick={() => void runPortraitBokeh()}
            className="ui-btn flex items-center justify-between py-2 px-2.5 rounded-md border border-border bg-secondary hover:bg-accent/60 text-foreground font-medium text-[12.5px]"
            title="Blur the background, keep your subject sharp. Select the subject first if it is not a person."
          >
            <span className="flex items-center gap-2">
              {aiJob?.label === 'Portrait Bokeh' ? (
                <Loader2 size={14} className="animate-spin text-primary" />
              ) : (
                <Focus size={14} className="text-primary" />
              )}
              <span className="whitespace-nowrap">Portrait Bokeh</span>
            </span>
            <span className="text-[11.5px] text-muted-foreground">Blur background</span>
          </button>
          <div className="px-0.5">
            <Slider
              label="Background blur"
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
          {tool('Low Light', Moon, () => void runLowLight(), { title: 'Brighten dark photos' })}
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
