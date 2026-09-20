'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  onAbout?: () => void
}

type MenuId = 'file' | 'edit' | 'help' | null

/**
 * Visible File/Edit/Help menus. Windows frameless windows hide the native menu bar,
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
      className="w-full text-left px-3 py-1.5 text-[13px] font-medium rounded-sm hover:bg-secondary disabled:opacity-35 disabled:pointer-events-none"
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
        compact ? 'h-8 px-2 text-[13px]' : 'h-8 px-2.5 text-[13px]',
        'rounded-md font-semibold tracking-[-0.01em]',
        open === id ? 'bg-secondary text-foreground' : 'text-foreground hover:bg-secondary/80',
      )}
    >
      {label}
    </button>
  )

  const menuBox = (testId: string, children: ReactNode, width: string) => (
    <div
      data-testid={testId}
      className={cn(
        'absolute left-0 top-full mt-0.5 z-[80] rounded-md border border-border bg-popover shadow-lg p-1',
        width,
      )}
    >
      {children}
    </div>
  )

  return (
    <div ref={root} className="relative flex items-center gap-0.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
      <div className="relative">
        {tab('file', 'File', 'app-menu-file')}
        {open === 'file' && menuBox(
          'app-menu-file-dropdown',
          <>
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
          </>,
          'w-52',
        )}
      </div>
      <div className="relative">
        {tab('edit', 'Edit', 'app-menu-edit')}
        {open === 'edit' && menuBox(
          'app-menu-edit-dropdown',
          <>
            {item('Undo', handlers.onUndo, { testId: 'menu-undo' })}
            {item('Redo', handlers.onRedo, { testId: 'menu-redo' })}
          </>,
          'w-40',
        )}
      </div>
      <div className="relative">
        {tab('help', 'Help', 'app-menu-help')}
        {open === 'help' && menuBox(
          'app-menu-help-dropdown',
          item('About Vista Image Studio', () => handlers.onAbout?.(), { testId: 'menu-about' }),
          'w-56',
        )}
      </div>
    </div>
  )
}
