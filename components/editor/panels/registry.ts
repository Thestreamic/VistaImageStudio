import { Sliders, Layers, Sparkles, Move3d, Type, Wand2, type LucideIcon } from 'lucide-react'
import type { ComponentType } from 'react'
import { AdjustmentsPanel } from './AdjustmentsPanel'
import { LayersPanel } from './LayersPanel'
import { AiPanel } from './AiPanel'
import { TransformPanel } from './TransformPanel'
import { TextPanel } from './TextPanel'
import { FiltersPanel } from './FiltersPanel'

export type EditorPanelId = 'ai' | 'filters' | 'adjust' | 'layers' | 'text' | 'transform'

export const EDITOR_PANELS: {
  id: EditorPanelId
  label: string
  icon: LucideIcon
  Panel: ComponentType
}[] = [
  { id: 'ai', label: 'AI', icon: Sparkles, Panel: AiPanel },
  { id: 'filters', label: 'Filters', icon: Wand2, Panel: FiltersPanel },
  { id: 'adjust', label: 'Adjust', icon: Sliders, Panel: AdjustmentsPanel },
  { id: 'layers', label: 'Layers', icon: Layers, Panel: LayersPanel },
  { id: 'text', label: 'Text', icon: Type, Panel: TextPanel },
  { id: 'transform', label: 'Transform', icon: Move3d, Panel: TransformPanel },
]
