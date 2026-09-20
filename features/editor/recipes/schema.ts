import { CROP_PRESETS } from '../crop-presets'
import { FILTER_PRESETS } from '../filter-presets'
import { CAMERA_PROFILES } from '../camera-profiles'
import { EXPORT_PRESETS } from '../export-presets'
import type { WatermarkCorner } from '../types'

export const RECIPE_SCHEMA_VERSION = 1

export interface Recipe {
  kind: 'lumen-recipe'
  schemaVersion: number
  id: string
  name: string
  cropPresetId?: string
  lookId?: string
  lookIntensity?: number
  watermark?: { text?: string; corner: WatermarkCorner; opacity: number }
  exportPresetId?: string
}

const STORAGE_KEY = 'vista-recipes'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function validateRecipe(raw: unknown): Recipe | null {
  if (!isRecord(raw)) return null
  if (raw.kind !== 'lumen-recipe') return null
  if (typeof raw.id !== 'string' || typeof raw.name !== 'string') return null
  if (raw.cropPresetId && !CROP_PRESETS.some((p) => p.id === raw.cropPresetId) && raw.cropPresetId !== 'free') return null
  if (raw.lookId) {
    const known = FILTER_PRESETS.some((p) => p.id === raw.lookId) || CAMERA_PROFILES.some((p) => p.id === raw.lookId)
    if (!known) return null
  }
  if (raw.exportPresetId && !EXPORT_PRESETS.some((p) => p.id === raw.exportPresetId)) return null
  return raw as unknown as Recipe
}

export function listRecipes(): Recipe[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as unknown
    if (!Array.isArray(raw)) return []
    return raw.map(validateRecipe).filter((r): r is Recipe => !!r)
  } catch {
    return []
  }
}

export function saveRecipe(recipe: Recipe) {
  const next = listRecipes().filter((r) => r.id !== recipe.id)
  next.unshift(recipe)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 40)))
}

export function deleteRecipe(id: string) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(listRecipes().filter((r) => r.id !== id)))
}

export function recipeFromCurrent(input: {
  name: string
  cropPresetId?: string
  lookId?: string | null
  lookIntensity?: number
  watermark?: Recipe['watermark']
  exportPresetId?: string
}): Recipe {
  return {
    kind: 'lumen-recipe',
    schemaVersion: RECIPE_SCHEMA_VERSION,
    id: `recipe_${Date.now()}`,
    name: input.name.trim() || 'Untitled recipe',
    cropPresetId: input.cropPresetId,
    lookId: input.lookId ?? undefined,
    lookIntensity: input.lookIntensity,
    watermark: input.watermark,
    exportPresetId: input.exportPresetId,
  }
}
