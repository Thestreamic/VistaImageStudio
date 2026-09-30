'use client'
import { useEffect, useRef, useState } from 'react'
import { FolderOpen, Download, LayoutTemplate, Columns2, Sun, Moon, Save, Shield, BookMarked, Images, Wrench, FolderKanban, ChevronDown, History } from 'lucide-react'
import { useEditorStore } from '@/features/editor/store/editor-store'
import { NewDesignDialog } from '../dialogs/NewDesignDialog'
import { AppMenu, type AppMenuHandlers } from './AppMenu'
import { listRecents } from '@/lib/platform/recents'
import { outputSize } from '@/features/editor/types'
import { cn } from '@/lib/utils'

/** Press longer than this on Compare = peek at the original (same as the canvas hold-compare). */
const COMPARE_HOLD_MS = 280

const GHOST =
  'flex items-center gap-1.5 h-8 px-2.5 text-[13px] font-medium rounded-md transition-colors disabled:opacity-30 disabled:pointer-events-none'
const GHOST_IDLE = 'text-foreground/80 hover:text-foreground hover:bg-secondary'

function Divider() {
  return <span aria-hidden className="mx-1 h-5 w-px bg-border" />
}

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
  const compareHoldTimer = useRef<number | null>(null)
  const compareHeld = useRef(false)
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

  const endCompareHold = () => {
    if (compareHoldTimer.current != null) {
      window.clearTimeout(compareHoldTimer.current)
      compareHoldTimer.current = null
    }
    setHoldPreview(false)
  }

  useEffect(() => () => {
    if (compareHoldTimer.current != null) window.clearTimeout(compareHoldTimer.current)
  }, [])

  const runTool = (fn: () => void) => {
    setShowTools(false)
    fn()
  }

  const toolItem = (
    label: string,
    action: () => void,
    opts?: { icon?: typeof LayoutTemplate; shortcut?: string; disabled?: boolean; testId?: string; hint?: string },
  ) => {
    const Icon = opts?.icon
    return (
      <button
        type="button"
        disabled={opts?.disabled}
        data-testid={opts?.testId}
        title={opts?.hint}
        onClick={() => runTool(action)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[13px] font-medium rounded-sm hover:bg-secondary transition-colors disabled:opacity-35 disabled:pointer-events-none"
      >
        {Icon ? <Icon size={14} className="text-muted-foreground shrink-0" /> : null}
        <span className="flex-1 text-left">{label}</span>
        {opts?.shortcut && <span className="text-[10px] text-muted-foreground num">{opts.shortcut}</span>}
      </button>
    )
  }

  const menuHeading = (text: string) => (
    <p className="px-2.5 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{text}</p>
  )

  return (
    <div className="h-11 shrink-0 flex items-center gap-0.5 px-2 bg-card border-b border-border">
      <AppMenu handlers={menu} />
      <Divider />
      <div ref={toolsRoot} className="relative">
        <button
          type="button"
          data-testid="tools-menu"
          onClick={() => {
            setShowRecents(false)
            setShowTools((v) => !v)
          }}
          title="Templates, collages, recipes and batch"
          aria-expanded={showTools}
          className={cn(GHOST, showTools ? 'bg-secondary text-foreground' : GHOST_IDLE)}
        >
          <Wrench size={14} /> Tools
          <ChevronDown size={12} className="text-muted-foreground" />
        </button>
        {showTools && (
          <div
            data-testid="tools-menu-dropdown"
            className="absolute left-0 top-full mt-1 z-20 w-60 rounded-md border border-border bg-popover elev-pop p-1"
          >
            {menuHeading('Create')}
            {toolItem('Templates', () => setShowNewDialog(true), {
              icon: LayoutTemplate,
              testId: 'tools-templates',
              hint: 'Social sizes, quick-start posts and collages',
            })}
            {menuHeading('Automate')}
            {toolItem('Recipes', onRecipesClick, { icon: BookMarked, disabled: !doc, testId: 'tools-recipes', hint: 'Save or apply crop + look + logo' })}
            {toolItem('Batch', onBatchClick, { icon: Images, testId: 'tools-batch', hint: 'Apply a recipe to a folder of photos' })}
            {menuHeading('Project')}
            {toolItem('Open project…', onOpenProjectClick, { icon: FolderKanban, shortcut: 'Ctrl+Shift+O', testId: 'tools-project' })}
            {toolItem('Save As…', onSaveAsClick, { icon: Save, shortcut: 'Ctrl+Shift+S', disabled: !doc, testId: 'tools-save-as' })}
          </div>
        )}
      </div>
      <button type="button" onClick={onOpenClick} title="Open image (Ctrl+O)" className={cn(GHOST, GHOST_IDLE)}>
        <FolderOpen size={14} /> Open
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowTools(false)
            setShowRecents((v) => !v)
          }}
          title="Recent projects (.lumen)"
          aria-expanded={showRecents}
          className={cn(GHOST, showRecents ? 'bg-secondary text-foreground' : GHOST_IDLE)}
        >
          <History size={14} /> Recent
        </button>
        {showRecents && (
          <div className="absolute left-0 top-full mt-1 z-20 w-64 rounded-md border border-border bg-popover elev-pop p-1">
            {menuHeading('Recent projects')}
            {recents.length === 0 && <p className="px-2.5 py-1.5 text-[12px] text-muted-foreground">No recent projects yet</p>}
            {recents.map((r) => (
              <button
                key={r.path}
                type="button"
                onClick={() => { onOpenRecent(r.path); setShowRecents(false) }}
                className="w-full text-left px-2.5 py-1.5 text-[13px] font-medium rounded-sm hover:bg-secondary truncate"
                title={r.path}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onSaveClick}
        disabled={!doc}
        title={dirty ? 'Save project (Ctrl+S) — unsaved changes' : 'Save project (Ctrl+S)'}
        className={cn(GHOST, GHOST_IDLE)}
      >
        <Save size={14} /> Save
        {dirty && <span aria-hidden className="ml-0.5 w-1.5 h-1.5 rounded-full bg-primary" />}
      </button>
      <Divider />
      <button
        type="button"
        onClick={() => {
          // Releasing a hold-to-peek must not also open the split view.
          const held = compareHeld.current
          compareHeld.current = false
          if (!held) toggleCompareMode()
        }}
        onPointerDown={() => {
          compareHeld.current = false
          if (!doc) return
          compareHoldTimer.current = window.setTimeout(() => {
            compareHoldTimer.current = null
            compareHeld.current = true
            setHoldPreview(true)
          }, COMPARE_HOLD_MS)
        }}
        onPointerUp={endCompareHold}
        onPointerLeave={endCompareHold}
        onPointerCancel={endCompareHold}
        disabled={!doc}
        aria-pressed={compareMode}
        title="Compare before / after — click for split view, hold to peek at the original"
        className={cn(GHOST, compareMode ? 'bg-accent text-accent-foreground' : GHOST_IDLE)}
      >
        <Columns2 size={14} /> Compare
      </button>
      <div className="flex-1" />
      {doc && size && (
        <span className="flex items-center gap-2 pr-2 text-[11px] text-muted-foreground">
          <span className="num">{size.width} × {size.height}</span>
          {dirty && (
            <span className="px-1.5 py-px rounded-sm bg-secondary text-[10.5px] font-medium text-foreground/75">Unsaved</span>
          )}
        </span>
      )}
      <button
        type="button"
        onClick={onPrivacyClick}
        title="Privacy Centre — your photos stay on this device"
        aria-label="Privacy Centre"
        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
      >
        <Shield size={15} />
      </button>
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        title={theme === 'dark' ? 'Switch to light UI' : 'Switch to dark UI'}
        aria-label={theme === 'dark' ? 'Switch to light UI' : 'Switch to dark UI'}
        className="w-8 h-8 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
      >
        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
      </button>
      <button
        type="button"
        onClick={onExportClick}
        disabled={!doc}
        data-testid="topbar-export"
        title="Export for social — sizes, creator pack, formats (Ctrl+E)"
        className="ml-1.5 flex items-center gap-1.5 h-8 px-3.5 text-[13px] font-semibold rounded-md bg-primary text-primary-foreground shadow-sm transition-[filter,transform] hover:brightness-105 active:translate-y-px disabled:opacity-35 disabled:pointer-events-none"
      >
        <Download size={14} strokeWidth={2.25} /> Export
      </button>
      {showNewDialog && <NewDesignDialog onClose={() => setShowNewDialog(false)} />}
    </div>
  )
}
