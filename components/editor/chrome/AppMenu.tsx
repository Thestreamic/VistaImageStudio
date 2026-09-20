'use client'

import { useEffect, useRef, useState } from 'react'
import { useEditorStore } from '@/features/editor/store/editor-store'
import { isElectron } from '@/lib/platform/bridge'
import { cn } from '@/lib/utils'

export type AppMenuHandlers = {
  onNewProject: () => void
  onOpenImage: () => void
  onOpenProject: () => void
  onSave: () => void
  onSaveAs: () => void
  onCloseProject: () => void
  onExit?: () => void
  onUndo: () => void
  onRedo: () => void
  onPrint?: () => void
}

type MenuId = 'file' | 'edit' | null

/**
 * Visible File/Edit menus. Windows frameless windows hide the native menu bar,
 * so this is the production File menu the user can actually see.
 */
export function AppMenu({
  handlers,
  compact = false,
}: {
  handlers: AppMenuHandlers
  compact?: boolean
}) {
  const [open, setOpen] = useState<MenuId>(null)
  const root = useRef<HTMLDivElement>(null)
  const doc = useEditorStore((s) => s.doc)
  const electron = isElectron()

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(null)
    }
    const timer = window.setTimeout(() => {
      document.addEventListener('mousedown', onDoc)
      document.addEventListener('keydown', onKey)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = (fn: () => void) => {
    setOpen(null)
    fn()
  }

  const item = (label: string, action: () => void, opts?: { disabled?: boolean; testId?: string }) => (
    <button
      type="button"
      disabled={opts?.disabled}
      data-testid={opts?.testId}
      onClick={() => run(action)}
      className="w-full text-left px-3 py-1.5 text-[12px] rounded-sm hover:bg-secondary disabled:opacity-35 disabled:pointer-events-none"
    >
      {label}
    </button>
  )

  const tab = (id: MenuId, label: string, testId: string) => (
    <button
      type="button"
      data-testid={testId}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        setOpen((cur) => (cur === id ? null : id))
      }}
      className={cn(
        compact ? 'h-8 px-2 text-[11px]' : 'h-8 px-2.5 text-xs',
        'rounded-md font-medium',
        open === id ? 'bg-secondary text-foreground' : 'text-foreground/90 hover:bg-secondary/80',
      )}
    >
      {label}
    </button>
  )

  return (
    <div ref={root} className="relative flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      {tab('file', 'File', 'app-menu-file')}
      {tab('edit', 'Edit', 'app-menu-edit')}
      {open === 'file' && (
        <div
          data-testid="app-menu-file-dropdown"
          className="absolute left-0 top-full mt-0.5 z-[80] w-52 rounded-md border border-border bg-popover shadow-lg p-1"
        >
          {item('New Project', handlers.onNewProject, { testId: 'menu-new-project' })}
          {item('Open Image…', handlers.onOpenImage, { testId: 'menu-open-image' })}
          {item('Open Project…', handlers.onOpenProject, { testId: 'menu-open-project' })}
          <div className="h-px bg-border my-1" />
          {item('Save', handlers.onSave, { disabled: !doc, testId: 'menu-save' })}
          {item('Save As…', handlers.onSaveAs, { disabled: !doc, testId: 'menu-save-as' })}
          {item('Close Project', handlers.onCloseProject, { disabled: !doc, testId: 'menu-close-project' })}
          <div className="h-px bg-border my-1" />
          {item('Print…', () => handlers.onPrint?.(), { disabled: !doc || !handlers.onPrint, testId: 'menu-print' })}
          {electron && handlers.onExit && (
            <>
              <div className="h-px bg-border my-1" />
              {item('Exit', handlers.onExit, { testId: 'menu-exit' })}
            </>
          )}
        </div>
      )}
      {open === 'edit' && (
        <div className="absolute left-10 top-full mt-0.5 z-[80] w-40 rounded-md border border-border bg-popover shadow-lg p-1">
          {item('Undo', handlers.onUndo, { testId: 'menu-undo' })}
          {item('Redo', handlers.onRedo, { testId: 'menu-redo' })}
        </div>
      )}
    </div>
  )
}
