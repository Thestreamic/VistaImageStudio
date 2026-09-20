'use client'
import { useEffect, useRef, useState } from 'react'
import { FolderOpen, Download, LayoutTemplate, Columns2, Sun, Moon, Save, Shield, BookMarked, Images, Wrench, FolderKanban } from 'lucide-react'
import { useEditorStore } from '@/features/editor/store/editor-store'
import { NewDesignDialog } from '../dialogs/NewDesignDialog'
import { AppMenu, type AppMenuHandlers } from './AppMenu'
import { listRecents } from '@/lib/platform/recents'
import { outputSize } from '@/features/editor/types'
import { cn } from '@/lib/utils'

export function TopBar({
  onOpenClick,
  onExportClick,
  onSaveClick,
  onSaveAsClick,
  onOpenProjectClick,
  onOpenRecent,
  onPrivacyClick,
  onRecipesClick,
  onBatchClick,
  menu,
}: {
  onOpenClick: () => void
  onExportClick: () => void
  onSaveClick: () => void
  onSaveAsClick: () => void
  onOpenProjectClick: () => void
  onOpenRecent: (path: string) => void
  onPrivacyClick: () => void
  onRecipesClick: () => void
  onBatchClick: () => void
  menu: AppMenuHandlers
}) {
  const doc = useEditorStore((s) => s.doc)
  const dirty = useEditorStore((s) => s.dirty)
  const compareMode = useEditorStore((s) => s.compareMode)
  const toggleCompareMode = useEditorStore((s) => s.toggleCompareMode)
  const setHoldPreview = useEditorStore((s) => s.setHoldPreview)
  const theme = useEditorStore((s) => s.theme)
  const setTheme = useEditorStore((s) => s.setTheme)
  const [showNewDialog, setShowNewDialog] = useState(false)
  const [showRecents, setShowRecents] = useState(false)
  const [showTools, setShowTools] = useState(false)
  const toolsRoot = useRef<HTMLDivElement>(null)
  const recents = showRecents ? listRecents() : []
  const size = doc ? outputSize(doc) : null

  useEffect(() => {
    if (!showTools) return
    const onDoc = (e: MouseEvent) => {
      if (!toolsRoot.current?.contains(e.target as Node)) setShowTools(false)
    }
    const timer = window.setTimeout(() => document.addEventListener('mousedown', onDoc), 0)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('mousedown', onDoc)
    }
  }, [showTools])

  const runTool = (fn: () => void) => {
    setShowTools(false)
    fn()
  }

  const toolItem = (
    label: string,
    action: () => void,
    opts?: { icon?: typeof LayoutTemplate; shortcut?: string; disabled?: boolean; testId?: string },
  ) => {
    const Icon = opts?.icon
    return (
      <button
        type="button"
        disabled={opts?.disabled}
        data-testid={opts?.testId}
        onClick={() => runTool(action)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium rounded-sm hover:bg-secondary disabled:opacity-35 disabled:pointer-events-none"
      >
        {Icon ? <Icon size={13} className="text-muted-foreground shrink-0" /> : null}
        <span className="flex-1 text-left">{label}</span>
        {opts?.shortcut && <span className="text-[10px] text-muted-foreground num">{opts.shortcut}</span>}
      </button>
    )
  }

  return (
    <div className="h-11 shrink-0 flex items-center gap-1 px-2 bg-card border-b border-border">
      <AppMenu handlers={menu} />
      <div ref={toolsRoot} className="relative">
        <button
          type="button"
          data-testid="tools-menu"
          onClick={() => {
            setShowRecents(false)
            setShowTools((v) => !v)
          }}
          title="Tools"
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium rounded-md hover:bg-secondary',
            showTools ? 'bg-secondary text-foreground' : 'text-foreground/80 hover:text-foreground',
          )}
        >
          <Wrench size={14} /> Tools
        </button>
        {showTools && (
          <div
            data-testid="tools-menu-dropdown"
            className="absolute left-0 top-full mt-1 z-20 w-56 rounded-md border border-border bg-popover shadow-lg p-1"
          >
            {toolItem('Templates', () => setShowNewDialog(true), { icon: LayoutTemplate, testId: 'tools-templates' })}
            {toolItem('Project', onOpenProjectClick, { icon: FolderKanban, shortcut: 'Ctrl+Shift+O', testId: 'tools-project' })}
            {toolItem('Save As', onSaveAsClick, { icon: Save, shortcut: 'Ctrl+Shift+S', disabled: !doc, testId: 'tools-save-as' })}
            {toolItem('Recipes', onRecipesClick, { icon: BookMarked, disabled: !doc, testId: 'tools-recipes' })}
            {toolItem('Batch', onBatchClick, { icon: Images, testId: 'tools-batch' })}
          </div>
        )}
      </div>
      <button type="button" onClick={onOpenClick} title="Open image (Ctrl+O)" className="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium rounded-md hover:bg-secondary text-foreground/80 hover:text-foreground">
        <FolderOpen size={14} /> Open
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowTools(false)
            setShowRecents((v) => !v)
          }}
          title="Recent projects"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium rounded-md hover:bg-secondary text-foreground/80 hover:text-foreground"
        >
          Recent
        </button>
        {showRecents && (
          <div className="absolute left-0 top-full mt-1 z-20 w-64 rounded-md border border-border bg-popover shadow-lg p-1">
            {recents.length === 0 && <p className="px-2 py-1.5 text-[12px] text-muted-foreground">No recent projects</p>}
            {recents.map((r) => (
              <button
                key={r.path}
                type="button"
                onClick={() => { onOpenRecent(r.path); setShowRecents(false) }}
                className="w-full text-left px-2 py-1.5 text-[13px] font-medium rounded hover:bg-secondary truncate"
                title={r.path}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <button type="button" onClick={onSaveClick} disabled={!doc} title="Save project (Ctrl+S)" className="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium rounded-md hover:bg-secondary text-foreground/80 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none">
        <Save size={14} /> Save{dirty ? ' •' : ''}
      </button>
      <button
        type="button"
        onClick={toggleCompareMode}
        onPointerDown={() => { if (doc) setHoldPreview(true) }}
        onPointerUp={() => setHoldPreview(false)}
        onPointerLeave={() => setHoldPreview(false)}
        disabled={!doc}
        title="Compare before / after — hold to preview original"
        className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium rounded-md disabled:opacity-30 disabled:pointer-events-none ${compareMode ? 'bg-accent text-accent-foreground' : 'hover:bg-secondary text-foreground/80 hover:text-foreground'}`}
      >
        <Columns2 size={14} /> Compare
      </button>
      <button
        type="button"
        onClick={onExportClick}
        disabled={!doc}
        title="Export (Ctrl+E)"
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-[13px] font-medium rounded-md hover:bg-secondary text-foreground/80 hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
      >
        <Download size={14} /> Export
      </button>
      <div className="flex-1" />
      {doc && (
        <span className="text-[11px] text-muted-foreground num pr-2">{size?.width} x {size?.height}{dirty ? ' • unsaved' : ''}</span>
      )}
      <button type="button" onClick={onPrivacyClick} title="Privacy Centre" aria-label="Privacy Centre" className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground">
        <Shield size={14} />
      </button>
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        title={theme === 'dark' ? 'Switch to light UI' : 'Switch to dark UI'}
        aria-label={theme === 'dark' ? 'Switch to light UI' : 'Switch to dark UI'}
        className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
      >
        {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
      </button>
      {showNewDialog && <NewDesignDialog onClose={() => setShowNewDialog(false)} />}
    </div>
  )
}
