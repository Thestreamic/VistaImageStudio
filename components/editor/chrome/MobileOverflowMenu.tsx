'use client'

import { useEffect } from 'react'
import {
  BookMarked,
  Columns2,
  Download,
  Film,
  FolderKanban,
  FolderOpen,
  Images,
  Info,
  LayoutTemplate,
  Moon,
  Printer,
  Redo2,
  Save,
  Shield,
  Sun,
  Undo2,
  X,
} from 'lucide-react'
import { useEditorStore } from '@/features/editor/store/editor-store'
import { listRecents } from '@/lib/platform/recents'
import { isElectron } from '@/lib/platform/bridge'
import type { AppMenuHandlers } from './AppMenu'
import { cn } from '@/lib/utils'

function Row({
  label,
  onClick,
  icon: Icon,
  disabled,
  testId,
}: {
  label: string
  onClick: () => void
  icon: typeof FolderOpen
  disabled?: boolean
  testId?: string
}) {
  return (
    <button
      type="button"
      data-testid={testId}
      disabled={disabled}
      onClick={onClick}
      className="w-full min-h-12 flex items-center gap-3 px-4 text-[15px] rounded-lg hover:bg-secondary disabled:opacity-35 disabled:pointer-events-none"
    >
      <Icon size={18} className="text-muted-foreground shrink-0" />
      <span className="text-left">{label}</span>
    </button>
  )
}

export function MobileOverflowMenu({
  open,
  onClose,
  menu,
  onOpenClick,
  onExportClick,
  onMakeVideoClick,
  onSaveClick,
  onSaveAsClick,
  onOpenProjectClick,
  onOpenRecent,
  onPrivacyClick,
  onAboutClick,
  onRecipesClick,
  onBatchClick,
  onTemplatesClick,
  onMediaClick,
}: {
  open: boolean
  onClose: () => void
  menu: AppMenuHandlers
  onOpenClick: () => void
  onExportClick: () => void
  onMakeVideoClick?: () => void
  onSaveClick: () => void
  onSaveAsClick: () => void
  onOpenProjectClick: () => void
  onOpenRecent: (path: string) => void
  onPrivacyClick: () => void
  onAboutClick: () => void
  onRecipesClick: () => void
  onBatchClick: () => void
  onTemplatesClick: () => void
  onMediaClick: () => void
}) {
  const doc = useEditorStore((s) => s.doc)
  const dirty = useEditorStore((s) => s.dirty)
  const compareMode = useEditorStore((s) => s.compareMode)
  const toggleCompareMode = useEditorStore((s) => s.toggleCompareMode)
  const theme = useEditorStore((s) => s.theme)
  const setTheme = useEditorStore((s) => s.setTheme)
  const recents = open ? listRecents() : []
  const electron = isElectron()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const go = (fn: () => void) => {
    onClose()
    fn()
  }

  return (
    <div className="md:hidden">
      <button type="button" aria-label="Close menu" className="fixed inset-0 z-[55] bg-black/45" onClick={onClose} />
      <nav
        data-testid="mobile-overflow-menu"
        className="fixed inset-y-0 left-0 z-[56] w-[min(22rem,100%)] flex flex-col bg-sidebar border-r border-border shadow-2xl pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]"
      >
        <div className="shrink-0 flex items-center gap-2 px-3 h-14 border-b border-border">
          <p className="flex-1 text-sm font-semibold px-1">Vista Image Studio</p>
          <button
            type="button"
            aria-label="Close menu"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-md hover:bg-secondary"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-2 py-3 space-y-4">
          <section>
            <p className="panel-label px-4 mb-1">File</p>
            <Row label="New project" icon={LayoutTemplate} onClick={() => go(menu.onNewProject)} testId="mobile-menu-new" />
            <Row label="Open photo" icon={FolderOpen} onClick={() => go(onOpenClick)} testId="mobile-menu-open" />
            <Row label="Open project" icon={FolderKanban} onClick={() => go(onOpenProjectClick)} />
            <Row label={`Save${dirty ? ' •' : ''}`} icon={Save} disabled={!doc} onClick={() => go(onSaveClick)} />
            <Row label="Save as" icon={Save} disabled={!doc} onClick={() => go(onSaveAsClick)} />
            <Row label="Export" icon={Download} disabled={!doc} onClick={() => go(onExportClick)} />
            <Row
              label="Make video"
              icon={Film}
              disabled={!doc || !onMakeVideoClick}
              onClick={() => go(() => onMakeVideoClick?.())}
            />
            <Row label="Print" icon={Printer} disabled={!doc || !menu.onPrint} onClick={() => go(() => menu.onPrint?.())} />
            <Row label="Close project" icon={X} disabled={!doc} onClick={() => go(menu.onCloseProject)} />
            {electron && menu.onExit && <Row label="Exit" icon={X} onClick={() => go(menu.onExit!)} />}
          </section>
          <section>
            <p className="panel-label px-4 mb-1">Edit</p>
            <Row label="Undo" icon={Undo2} onClick={() => go(menu.onUndo)} />
            <Row label="Redo" icon={Redo2} onClick={() => go(menu.onRedo)} />
            <Row
              label={compareMode ? 'Compare on' : 'Compare before / after'}
              icon={Columns2}
              disabled={!doc}
              onClick={() => go(toggleCompareMode)}
            />
          </section>
          <section>
            <p className="panel-label px-4 mb-1">Library</p>
            <Row label="Imported photos" icon={Images} onClick={() => go(onMediaClick)} testId="mobile-menu-media" />
            <Row label="Templates" icon={LayoutTemplate} onClick={() => go(onTemplatesClick)} />
            <Row label="Recipes" icon={BookMarked} disabled={!doc} onClick={() => go(onRecipesClick)} />
            <Row label="Batch" icon={Images} onClick={() => go(onBatchClick)} />
            {recents.length > 0 && (
              <div className="mt-2">
                <p className="panel-label px-4 mb-1">Recent</p>
                {recents.map((r) => (
                  <button
                    key={r.path}
                    type="button"
                    onClick={() => go(() => onOpenRecent(r.path))}
                    className="w-full min-h-12 text-left px-4 text-[14px] rounded-lg hover:bg-secondary truncate"
                    title={r.path}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            )}
          </section>
          <section>
            <p className="panel-label px-4 mb-1">App</p>
            <Row label="About" icon={Info} onClick={() => go(onAboutClick)} testId="mobile-menu-about" />
            <Row label="Privacy Centre" icon={Shield} onClick={() => go(onPrivacyClick)} />
            <Row
              label={theme === 'dark' ? 'Switch to light UI' : 'Switch to dark UI'}
              icon={theme === 'dark' ? Sun : Moon}
              onClick={() => go(() => setTheme(theme === 'dark' ? 'light' : 'dark'))}
            />
          </section>
        </div>
      </nav>
    </div>
  )
}

export function MobileMenuToggle({
  open,
  onClick,
  className,
}: {
  open: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      type="button"
      data-testid="mobile-overflow-toggle"
      aria-label="Open menu"
      aria-expanded={open}
      onClick={onClick}
      className={cn(
        'w-11 h-11 flex items-center justify-center rounded-md hover:bg-secondary text-foreground',
        className,
      )}
    >
      <span className="flex flex-col gap-1.5" aria-hidden>
        <span className="block w-4 h-px bg-current" />
        <span className="block w-4 h-px bg-current" />
        <span className="block w-4 h-px bg-current" />
      </span>
    </button>
  )
}
