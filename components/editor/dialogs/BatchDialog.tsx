'use client'
import { useState } from 'react'
import { IMAGE_FILE_ACCEPT, canvasFromBlob, isImageFile, thumbnailDataUrl, workingCanvasFromSource } from '@/lib/image/canvas'
import { listRecipes } from '@/features/editor/recipes/schema'
import { runBatch } from '@/features/editor/batch/run'
import { getBridge } from '@/lib/platform/bridge'
import { useEditorStore } from '@/features/editor/store/editor-store'

export function BatchDialog({ onClose }: { onClose: () => void }) {
  const notify = useEditorStore((s) => s.notify)
  const addRecentImport = useEditorStore((s) => s.addRecentImport)
  const recipes = listRecipes()
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? '')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState('')

  const rememberFiles = async (picked: File[]) => {
    setFiles(picked)
    for (const file of picked) {
      if (!isImageFile(file)) continue
      try {
        const canvas = await canvasFromBlob(file, file.name)
        const working = workingCanvasFromSource(canvas)
        addRecentImport({
          name: file.name,
          blob: file,
          thumbnailDataUrl: thumbnailDataUrl(working),
          workingCanvas: working,
        }, { activate: false })
      } catch {
        /* skip files we cannot thumbnail; batch export still uses the File list */
      }
    }
  }

  const run = async () => {
    const recipe = recipes.find((r) => r.id === recipeId)
    if (!recipe || files.length === 0) return
    setBusy(true)
    try {
      const results = await runBatch(
        { files, recipe, format: 'jpeg', quality: 90 },
        (done, total) => setProgress(`${done}/${total}`),
      )
      const ok = results.filter((r) => !r.error)
      const failed = results.filter((r) => r.error)
      if (ok.length) {
        await getBridge().saveImages(ok.map((r) => ({ blob: r.blob, name: r.name })))
      }
      notify(
        failed.length ? 'info' : 'success',
        `Batch: ${ok.length} exported${failed.length ? `, ${failed.length} skipped` : ''}`,
      )
      onClose()
    } catch (err) {
      notify('error', `Batch failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="w-[400px] rounded-xl bg-popover border border-border shadow-2xl p-4" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-sm font-semibold">Batch export</h2>
        <p className="text-[10px] text-muted-foreground mt-1">Apply a local recipe to a folder of photos. Failures are skipped so the rest still export.</p>
        <label className="block mt-3 text-[10px] text-muted-foreground">Recipe</label>
        <select value={recipeId} onChange={(e) => setRecipeId(e.target.value)} className="w-full mt-1 bg-input rounded px-2 py-1.5 text-xs border border-border">
          {recipes.length === 0 && <option value="">Save a recipe first</option>}
          {recipes.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <label className="block mt-3 text-[10px] text-muted-foreground">Photos</label>
        <input
          type="file"
          multiple
          accept={IMAGE_FILE_ACCEPT}
          className="mt-1 w-full text-xs"
          onChange={(e) => void rememberFiles(Array.from(e.currentTarget.files ?? []))}
        />
        <p className="text-[10px] text-muted-foreground mt-1">{files.length} file{files.length === 1 ? '' : 's'}{progress ? ` · ${progress}` : ''}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-xs rounded-md bg-secondary">Cancel</button>
          <button type="button" disabled={busy || !recipeId || files.length === 0} onClick={() => void run()} className="px-3 py-1.5 text-xs rounded-md brand-gradient-bg text-white disabled:opacity-40">
            {busy ? 'Working…' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  )
}
