'use client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { EDITOR_PANELS, type EditorPanelId } from '../panels/registry'

export { EDITOR_PANELS, type EditorPanelId }

export function RightPanel() {
  const [tab, setTab] = useState<EditorPanelId>('ai')
  const Active = EDITOR_PANELS.find((p) => p.id === tab)!.Panel

  return (
    <div className="h-full min-h-0 w-full flex flex-col">
      <div className="flex shrink-0 border-b border-border">
        {EDITOR_PANELS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            onClick={() => setTab(id)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2 text-[11px] font-medium tracking-[0.01em] border-b-2 transition-colors',
              tab === id ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <Active />
      </div>
    </div>
  )
}
