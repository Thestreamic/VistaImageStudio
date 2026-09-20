import layoutsJson from './templates/layouts.json'
import occasionsJson from './templates/occasions.json'
import type { CollageTemplate } from './template-types'

export type { CollageTemplate, PhotoSlot, DecorElement } from './template-types'

export const ALL_TEMPLATES: CollageTemplate[] = [
  ...(layoutsJson as CollageTemplate[]),
  ...(occasionsJson as CollageTemplate[]),
]

export const CATEGORIES = [
  { id: 'layouts', label: 'Layouts' },
  { id: 'family', label: 'Family' },
  { id: 'birthday', label: 'Birthday' },
  { id: 'anniversary', label: 'Anniversary' },
  { id: 'wedding', label: 'Wedding' },
  { id: 'raksha-bandhan', label: 'Raksha Bandhan' },
  { id: 'best-wishes', label: 'Best Wishes' },
] as const

export type CollageCategoryId = (typeof CATEGORIES)[number]['id']

export function getTemplatesByCategory(category: string): CollageTemplate[] {
  return ALL_TEMPLATES.filter((template) => template.category.includes(category))
}

export function getTemplateById(id: string): CollageTemplate | undefined {
  return ALL_TEMPLATES.find((template) => template.id === id)
}

/** Legacy layout shape used by existing tests and the old 6-grid picker. */
export interface LayoutCollageTemplate {
  id: string
  label: string
  photoCount: number
  cells: { x: number; y: number; w: number; h: number }[]
}

export const COLLAGE_TEMPLATES: LayoutCollageTemplate[] = getTemplatesByCategory('layouts').map((template) => ({
  id: template.id,
  label: template.name,
  photoCount: template.slots.length,
  cells: template.slots.map((slot) => ({ x: slot.x, y: slot.y, w: slot.width, h: slot.height })),
}))
