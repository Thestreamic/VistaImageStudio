'use client'
import { MousePointer2, Crop, Hand, Undo2, Redo2, ZoomIn, ZoomOut, Maximize2, SquareDashed, Wand } from 'lucide-react'
import { useEditorStore } from '@/features/editor/store/editor-store'
import type { ToolId } from '@/features/editor/types'
import { cn } from '@/lib/utils'

const TOOLS: { id: ToolId; icon: typeof MousePointer2; label: string }[] = [
  { id: 'move', icon: MousePointer2, label: 'Move (V)' },
  { id: 'crop', icon: Crop, label: 'Crop (C)' },
  { id: 'select-rect', icon: SquareDashed, label: 'Select (M)' },
  { id: 'select-wand', icon: Wand, label: 'Magic Wand (W)' },
  { id: 'hand', icon: Hand, label: 'Hand / Pan (H)' },
]

export function Toolbar({ variant = 'dock' }: { variant?: 'dock' | 'overlay' }) {
  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)
  const undo = useEditorStore((s) => s.undo)
  const redo = useEditorStore((s) => s.redo)
  const canUndo = useEditorStore((s) => s.past.length > 0)
  const canRedo = useEditorStore((s) => s.future.length > 0)
  const zoomBy = useEditorStore((s) => s.zoomBy)
  const fitToScreen = useEditorStore((s) => s.fitToScreen)
  const doc = useEditorStore((s) => s.doc)
  const overlay = variant === 'overlay'
  const hit = overlay ? 'w-11 h-11' : 'w-9 h-9'

  return (
    <div
      data-testid={overlay ? 'mobile-tool-rail' : 'desktop-toolbar'}
      className={
        overlay
          ? 'absolute left-2 top-2 z-20 flex flex-col items-center gap-0.5 p-1 rounded-xl bg-card/90 backdrop-blur-sm border border-border shadow-md'
          : 'w-12 shrink-0 flex flex-col items-center gap-1 py-2 bg-sidebar border-r border-sidebar-border'
      }
    >
      {TOOLS.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          title={label}
          aria-label={label}
          type="button"
          onClick={() => setTool(id)}
          className={cn(
            hit,
            'flex items-center justify-center rounded-md transition-colors',
            tool === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
          )}
        >
          <Icon size={16} strokeWidth={1.75} />
        </button>
      ))}

      <div className="h-px w-6 bg-border my-2" />

      {!overlay && (
        <>
          <button
            type="button"
            title="Zoom in"
            aria-label="Zoom in"
            disabled={!doc}
            onClick={() => zoomBy(1.2)}
            className={`${hit} flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30 disabled:pointer-events-none`}
          >
            <ZoomIn size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            title="Zoom out"
            aria-label="Zoom out"
            disabled={!doc}
            onClick={() => zoomBy(1 / 1.2)}
            className={`${hit} flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30 disabled:pointer-events-none`}
          >
            <ZoomOut size={16} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            title="Fit to window"
            aria-label="Fit to window"
            disabled={!doc}
            onClick={() => {
              const stage = document.querySelector('[data-testid="editor-stage"]') as HTMLElement | null
              if (stage) fitToScreen(stage.clientWidth, stage.clientHeight)
            }}
            className={`${hit} flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30 disabled:pointer-events-none`}
          >
            <Maximize2 size={16} strokeWidth={1.75} />
          </button>
          <div className="h-px w-6 bg-border my-2" />
        </>
      )}

      <button
        type="button"
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
        disabled={!canUndo}
        onClick={undo}
        className={`${hit} flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30 disabled:pointer-events-none`}
      >
        <Undo2 size={16} strokeWidth={1.75} />
      </button>
      <button
        type="button"
        title="Redo (Ctrl+Shift+Z)"
        aria-label="Redo"
        disabled={!canRedo}
        onClick={redo}
        className={`${hit} flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-30 disabled:pointer-events-none`}
      >
        <Redo2 size={16} strokeWidth={1.75} />
      </button>
    </div>
  )
}
