'use client'
import { useEffect, useRef, type RefObject } from 'react'
import { Undo2, X } from 'lucide-react'
import { useEditorStore } from '@/features/editor/store/editor-store'
import { compositor } from '@/features/editor/engine/compositor'
import { CheckerPattern } from '../canvas/CheckerPattern'
import { displayPreviewScale } from '@/features/editor/viewport'
import type { DocumentState } from '@/features/editor/types'

/**
 * Two-monitor compare view, styled after NLE source/record monitors:
 * BEFORE (left) shows a past snapshot from history, AFTER (right) shows
 * the live document. Each photo is object-fit contained so it fills the pane.
 */
export function CompareView() {
  const doc = useEditorStore((s) => s.doc)
  const past = useEditorStore((s) => s.past)
  const compareStepsBack = useEditorStore((s) => s.compareStepsBack)
  const setCompareStepsBack = useEditorStore((s) => s.setCompareStepsBack)
  const toggleCompareMode = useEditorStore((s) => s.toggleCompareMode)
  const getCompareBeforeDoc = useEditorStore((s) => s.getCompareBeforeDoc)
  const renderVersion = useEditorStore((s) => s.renderVersion)

  const beforeCanvasRef = useRef<HTMLCanvasElement>(null)
  const afterCanvasRef = useRef<HTMLCanvasElement>(null)

  const beforeDoc = getCompareBeforeDoc()
  const maxSteps = Math.min(5, past.length)

  useEffect(() => {
    paintFitted(beforeCanvasRef.current, beforeDoc)
  }, [beforeDoc])

  useEffect(() => {
    paintFitted(afterCanvasRef.current, doc)
  }, [doc, renderVersion])

  if (!doc) return null

  return (
    <div data-testid="compare-view" className="relative flex-1 flex flex-col bg-[var(--canvas)] min-w-0 min-h-0">
      <div className="h-10 shrink-0 flex items-center gap-2 pl-3 pr-11 bg-card border-b border-border">
        <span className="text-xs font-semibold flex items-center gap-1.5 shrink-0">
          <Undo2 size={12} className="text-primary" /> Compare
        </span>
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto">
          <button
            type="button"
            data-testid="compare-original"
            onClick={() => setCompareStepsBack(0)}
            className={`text-[10px] px-2 py-0.5 rounded-full shrink-0 ${compareStepsBack === 0 ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
          >
            Original
          </button>
          {Array.from({ length: maxSteps }, (_, i) => i + 1).map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setCompareStepsBack(n)}
              className={`text-[10px] w-6 h-5 rounded-full shrink-0 ${compareStepsBack === n ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}
              title={`${n} step${n > 1 ? 's' : ''} back`}
            >
              -{n}
            </button>
          ))}
        </div>
        <span className="text-[10px] text-muted-foreground truncate min-w-0 hidden sm:inline">
          {past.length === 0 ? 'No edits yet' : compareStepsBack === 0 ? 'true as-imported original' : `${compareStepsBack} step${compareStepsBack > 1 ? 's' : ''} of history back`}
        </span>
      </div>

      <button
        type="button"
        data-testid="compare-close"
        aria-label="Close compare"
        title="Close compare"
        onClick={toggleCompareMode}
        className="absolute top-1 right-1.5 z-20 w-8 h-8 flex items-center justify-center rounded-md border border-border bg-secondary text-foreground shadow-sm hover:bg-destructive hover:text-destructive-foreground hover:border-destructive"
      >
        <X size={16} strokeWidth={2.25} />
      </button>

      <div className="flex-1 flex min-h-0 min-w-0">
        <Pane label="BEFORE" canvasRef={beforeCanvasRef} testId="compare-before" />
        <div className="w-px bg-border shrink-0" />
        <Pane label="AFTER" canvasRef={afterCanvasRef} testId="compare-after" accent />
      </div>

      <div className="h-12 shrink-0 flex items-center justify-center bg-card border-t border-border">
        <button
          type="button"
          data-testid="compare-close-tab"
          aria-label="Close compare tab"
          title="Close compare tab"
          onClick={toggleCompareMode}
          className="flex items-center gap-1.5 h-9 px-5 text-xs font-medium rounded-md border border-border bg-secondary hover:bg-accent"
        >
          <X size={14} strokeWidth={2.25} /> Close
        </button>
      </div>
    </div>
  )
}

function paintFitted(canvas: HTMLCanvasElement | null, source: DocumentState | null | undefined) {
  if (!canvas || !source) return
  const scale = displayPreviewScale(source.width, source.height)
  const out = compositor.render(source, undefined, { scale })
  if (canvas.width !== out.width || canvas.height !== out.height) {
    canvas.width = out.width
    canvas.height = out.height
  }
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(out, 0, 0, canvas.width, canvas.height)
}

function Pane({
  label,
  canvasRef,
  accent,
  testId,
}: {
  label: string
  canvasRef: RefObject<HTMLCanvasElement | null>
  accent?: boolean
  testId: string
}) {
  return (
    <div data-testid={testId} className="relative flex-1 min-w-0 min-h-0 overflow-hidden">
      <CheckerPattern />
      <span
        className={`absolute top-2 left-2 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded z-10 ${accent ? 'brand-gradient-bg text-white' : 'bg-black/50 text-white/80'}`}
      >
        {label}
      </span>
      <div className="absolute inset-3 flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="block max-w-full max-h-full w-full h-full"
          style={{
            objectFit: 'contain',
            objectPosition: 'center',
            boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          }}
        />
      </div>
    </div>
  )
}
