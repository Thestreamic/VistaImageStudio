'use client'
import { useMemo, useState } from 'react'
import { CROP_PRESETS } from '@/features/editor/crop-presets'
import { FILTER_PRESETS } from '@/features/editor/filter-presets'
import { CAMERA_PROFILES } from '@/features/editor/camera-profiles'
import { EXPORT_PRESETS } from '@/features/editor/export-presets'
import { deleteRecipe, listRecipes, recipeFromCurrent, saveRecipe, type Recipe } from '@/features/editor/recipes/schema'
import { useEditorStore, selectWatermarkLayer } from '@/features/editor/store/editor-store'
import { cropRectForPreset } from '@/features/editor/crop-presets'
import type { WatermarkCorner } from '@/features/editor/types'

export function RecipesDialog({ onClose }: { onClose: () => void }) {
  const doc = useEditorStore((s) => s.doc)
  const applyLook = useEditorStore((s) => s.applyLook)
  const setLiveCrop = useEditorStore((s) => s.setLiveCrop)
  const addWatermarkLayer = useEditorStore((s) => s.addWatermarkLayer)
  const watermark = useEditorStore(selectWatermarkLayer)
  const notify = useEditorStore((s) => s.notify)
  const [name, setName] = useState('My recipe')
  const [recipes, setRecipes] = useState(listRecipes)

  const looks = useMemo(
    () => [...FILTER_PRESETS.filter((p) => p.id !== 'original'), ...CAMERA_PROFILES],
    [],
  )

  const capture = () => {
    if (!doc) return
    const recipe = recipeFromCurrent({
      name,
      cropPresetId: guessCropPreset(doc),
      lookId: doc.lookId,
      lookIntensity: doc.lookIntensity,
      watermark: watermark?.watermark
        ? {
            text: watermark.watermark.text,
            corner: watermark.watermark.corner as WatermarkCorner,
            opacity: watermark.watermark.opacity,
          }
        : undefined,
      exportPresetId: doc.lastExport?.presetIds[0],
    })
    saveRecipe(recipe)
    setRecipes(listRecipes())
    notify('success', `Saved recipe “${recipe.name}”`)
  }

  const apply = (recipe: Recipe) => {
    if (!doc) return
    if (recipe.lookId) applyLook(recipe.lookId, recipe.lookIntensity ?? 100, true)
    if (recipe.cropPresetId) setLiveCrop(cropRectForPreset(doc.width, doc.height, recipe.cropPresetId))
    if (recipe.watermark) {
      addWatermarkLayer({
        kind: 'text',
        text: recipe.watermark.text || '@studio',
        corner: recipe.watermark.corner,
        opacity: recipe.watermark.opacity,
      })
    }
    notify('success', `Applied “${recipe.name}”`)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-[420px] max-h-[85vh] overflow-y-auto rounded-xl bg-popover border border-border shadow-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold">Recipes</h2>
        <p className="text-[10px] text-muted-foreground mt-1">Save crop + look + logo as a local recipe. Nothing is uploaded.</p>
        <div className="mt-3 flex gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 bg-input rounded px-2 py-1 text-xs border border-border" />
          <button type="button" disabled={!doc} onClick={capture} className="px-2 py-1 text-xs rounded-md brand-gradient-bg text-white disabled:opacity-40">Save current</button>
        </div>
        <ul className="mt-3 space-y-1.5">
          {recipes.length === 0 && <li className="text-xs text-muted-foreground">No recipes yet.</li>}
          {recipes.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-md bg-secondary/60 px-2 py-1.5">
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{r.name}</div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {[r.cropPresetId, r.lookId, r.watermark ? 'logo' : null, r.exportPresetId].filter(Boolean).join(' · ')}
                </div>
              </div>
              <button type="button" onClick={() => apply(r)} disabled={!doc} className="text-[10px] px-2 py-0.5 rounded bg-secondary">Apply</button>
              <button type="button" onClick={() => { deleteRecipe(r.id); setRecipes(listRecipes()) }} className="text-[10px] text-muted-foreground">Delete</button>
            </li>
          ))}
        </ul>
        <p className="text-[10px] text-muted-foreground mt-3">Looks: {looks.map((l) => l.label).slice(0, 6).join(', ')}… · Exports: {EXPORT_PRESETS.length} sizes · Crops: {CROP_PRESETS.map((c) => c.id).join(', ')}</p>
        <button type="button" onClick={onClose} className="mt-3 w-full py-1.5 text-xs rounded-md bg-secondary">Close</button>
      </div>
    </div>
  )
}

function guessCropPreset(doc: { width: number; height: number; crop: { width: number; height: number } | null }) {
  const w = doc.crop?.width ?? doc.width
  const h = doc.crop?.height ?? doc.height
  const ratio = w / h
  let best = CROP_PRESETS[0]
  let err = Infinity
  for (const p of CROP_PRESETS) {
    if (p.ratio == null) continue
    const e = Math.abs(p.ratio - ratio)
    if (e < err) { err = e; best = p }
  }
  return err < 0.04 ? best.id : undefined
}
