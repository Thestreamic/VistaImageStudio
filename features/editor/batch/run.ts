import { canvasFromBlob, canvasToBlob } from '@/lib/image/canvas'
import { createCanvas, ctx2d } from '@/lib/image/canvas'
import { applyAdjustmentsToPixels } from '@/features/editor/engine/adjustments'
import { cropRectForPreset } from '@/features/editor/crop-presets'
import { adjustmentsFromLook } from '@/features/editor/looks'
import { FILTER_PRESETS } from '@/features/editor/filter-presets'
import { CAMERA_PROFILES } from '@/features/editor/camera-profiles'
import { stampWatermark } from '@/features/editor/export-kit'
import { EXPORT_PRESETS } from '@/features/editor/export-presets'
import { renderExportCanvas } from '@/features/editor/export-kit'
import type { Recipe } from '@/features/editor/recipes/schema'
import { defaultAdjustments } from '@/features/editor/types'

export interface BatchJob {
  files: File[]
  recipe: Recipe
  format: 'jpeg' | 'png' | 'webp'
  quality: number
}

export interface BatchResult {
  name: string
  blob: Blob
  error?: string
}

export async function runBatch(job: BatchJob, onProgress?: (done: number, total: number) => void): Promise<BatchResult[]> {
  const out: BatchResult[] = []
  let i = 0
  for (const file of job.files) {
    i++
    onProgress?.(i - 1, job.files.length)
    try {
      const src = await canvasFromBlob(file, file.name)
      const look =
        FILTER_PRESETS.find((p) => p.id === job.recipe.lookId) ??
        CAMERA_PROFILES.find((p) => p.id === job.recipe.lookId)
      let working = src
      if (look) {
        const adj = adjustmentsFromLook(look.adjustments, job.recipe.lookIntensity ?? 100)
        if (JSON.stringify(adj) !== JSON.stringify(defaultAdjustments())) {
          const c = createCanvas(src.width, src.height)
          const ctx = ctx2d(c)
          ctx.drawImage(src, 0, 0)
          const img = ctx.getImageData(0, 0, c.width, c.height)
          applyAdjustmentsToPixels(img.data, adj, c.width, c.height)
          ctx.putImageData(img, 0, 0)
          working = c
        }
      }
      if (job.recipe.cropPresetId) {
        const crop = cropRectForPreset(working.width, working.height, job.recipe.cropPresetId)
        const c = createCanvas(crop.width, crop.height)
        ctx2d(c).drawImage(working, -crop.x, -crop.y)
        working = c
      }
      if (job.recipe.watermark?.text) {
        working = stampWatermark(working, {
          text: job.recipe.watermark.text,
          corner: job.recipe.watermark.corner,
          opacity: job.recipe.watermark.opacity,
        })
      }
      const preset = EXPORT_PRESETS.find((p) => p.id === (job.recipe.exportPresetId ?? 'original')) ?? EXPORT_PRESETS[0]
      const framed = renderExportCanvas(working, preset, 'fill')
      const mime = job.format === 'png' ? 'image/png' : job.format === 'webp' ? 'image/webp' : 'image/jpeg'
      const blob = await canvasToBlob(framed, mime, job.format === 'png' ? undefined : job.quality / 100)
      const ext = job.format === 'jpeg' ? 'jpg' : job.format
      out.push({ name: `${file.name.replace(/\.[^.]+$/, '')}-${preset.id}.${ext}`, blob })
    } catch (err) {
      out.push({
        name: file.name,
        blob: new Blob(),
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }
  onProgress?.(job.files.length, job.files.length)
  return out
}
