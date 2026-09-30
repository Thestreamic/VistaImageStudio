'use client'
import { useState } from 'react'
import { ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useEditorStore } from '@/features/editor/store/editor-store'
import { EDITOR_PANELS, type EditorPanelId } from '../panels/registry'

export { EDITOR_PANELS, type EditorPanelId }

export function RightPanel() {
  const [tab, setTab] = useState<EditorPanelId>('ai')
  const hasDoc = useEditorStore((s) => !!s.doc)
  const Active = EDITOR_PANELS.find((p) => p.id === tab)!.Panel

  return (
    <div className="h-full min-h-0 w-full flex flex-col">
      <div className="flex shrink-0 gap-0.5 px-1 pt-1 border-b border-border">
        {EDITOR_PANELS.map(({ id, label, icon: Icon }) => {
          const on = tab === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              aria-label={label}
              onClick={() => setTab(id)}
              className={cn(
                'relative flex-auto min-w-0 flex flex-col items-center gap-1 px-1 pt-2 pb-2 rounded-t-md text-[10.5px] font-medium tracking-[-0.01em] transition-colors',
                on
                  ? 'text-foreground bg-secondary/60'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/35',
              )}
            >
              <Icon size={15} strokeWidth={on ? 2.1 : 1.75} className={on ? 'text-primary' : undefined} />
              <span className="max-w-full truncate">{label}</span>
              <span
                aria-hidden
                className={cn(
                  'absolute inset-x-2 -bottom-px h-0.5 rounded-full transition-colors',
                  on ? 'bg-primary' : 'bg-transparent',
                )}
              />
            </button>
          )
        })}
      </div>
      {!hasDoc && (
        <div
          data-testid="inspector-no-photo"
          className="shrink-0 mx-3 mt-3 flex items-start gap-2 rounded-md border border-border bg-secondary/40 px-2.5 py-2 text-[12px] leading-snug text-muted-foreground"
        >
          <ImageIcon size={14} className="mt-px shrink-0" />
          <span>Open a photo to use these tools.</span>
        </div>
      )}
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-thin">
        <Active />
      </div>
    </div>
  )
}
