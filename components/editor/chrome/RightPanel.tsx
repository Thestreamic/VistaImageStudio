'use client'
import { useState } from 'react'
import { Sliders, Layers, Sparkles, Move3d, Type, Wand2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdjustmentsPanel } from '../panels/AdjustmentsPanel'
import { LayersPanel } from '../panels/LayersPanel'
import { AiPanel } from '../panels/AiPanel'
import { TransformPanel } from '../panels/TransformPanel'
import { TextPanel } from '../panels/TextPanel'
import { FiltersPanel } from '../panels/FiltersPanel'

const TABS = [
  { id: 'ai', label: 'AI', icon: Sparkles, Panel: AiPanel },
  { id: 'filters', label: 'Filters', icon: Wand2, Panel: FiltersPanel },
  { id: 'adjust', label: 'Adjust', icon: Sliders, Panel: AdjustmentsPanel },
  { id: 'layers', label: 'Layers', icon: Layers, Panel: LayersPanel },
  { id: 'text', label: 'Text', icon: Type, Panel: TextPanel },
  { id: 'transform', label: 'Transform', icon: Move3d, Panel: TransformPanel },
] as const

export function RightPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]['id']>('ai')
  const Active = TABS.find((t) => t.id === tab)!.Panel

  return (
    <div className="h-full min-h-0 w-full flex flex-col">
      <div className="flex shrink-0 border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-label={label}
            onClick={() => setTab(id)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 py-2 text-[10px] border-b-2 transition-colors',
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
