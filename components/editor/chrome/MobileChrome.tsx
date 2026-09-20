'use client'

import { Download, Moon, Sun } from 'lucide-react'
import { useEditorStore } from '@/features/editor/store/editor-store'
import { EDITOR_PANELS, type EditorPanelId } from '../panels/registry'
import { cn } from '@/lib/utils'
import { MobileMenuToggle } from './MobileOverflowMenu'

export type MobileSheetId = EditorPanelId | 'media'

export function MobileTopBar({
  menuOpen,
  onMenu,
  onExportClick,
}: {
  menuOpen: boolean
  onMenu: () => void
  onExportClick: () => void
}) {
  const doc = useEditorStore((s) => s.doc)
  const dirty = useEditorStore((s) => s.dirty)
  const theme = useEditorStore((s) => s.theme)
  const setTheme = useEditorStore((s) => s.setTheme)

  return (
    <header
      data-testid="mobile-top-bar"
      className="shrink-0 flex items-center gap-1 px-1 bg-card border-b border-border md:hidden"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <MobileMenuToggle open={menuOpen} onClick={onMenu} />
      <div className="flex-1 min-w-0 py-2">
        <p className="text-[13px] font-medium truncate">
          {doc ? doc.fileName : 'Vista Image Studio'}
          {dirty ? ' •' : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={onExportClick}
        disabled={!doc}
        title="Export"
        aria-label="Export"
        className="w-11 h-11 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:pointer-events-none"
      >
        <Download size={18} />
      </button>
      <button
        type="button"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        title={theme === 'dark' ? 'Switch to light UI' : 'Switch to dark UI'}
        aria-label={theme === 'dark' ? 'Switch to light UI' : 'Switch to dark UI'}
        className="w-11 h-11 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
      >
        {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
      </button>
    </header>
  )
}

export function MobileBottomNav({
  active,
  onSelect,
}: {
  active: MobileSheetId | null
  onSelect: (id: EditorPanelId) => void
}) {
  return (
    <nav
      data-testid="mobile-bottom-nav"
      className="shrink-0 grid grid-cols-6 bg-card border-t border-border md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {EDITOR_PANELS.map(({ id, label, icon: Icon }) => {
        const on = active === id
        return (
          <button
            key={id}
            type="button"
            data-testid={`mobile-tab-${id}`}
            aria-label={label}
            aria-pressed={on}
            onClick={() => onSelect(id)}
            className={cn(
              'min-h-14 flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium px-0.5',
              on ? 'text-primary' : 'text-muted-foreground',
            )}
          >
            <Icon size={18} strokeWidth={on ? 2.2 : 1.75} />
            {label}
          </button>
        )
      })}
    </nav>
  )
}
