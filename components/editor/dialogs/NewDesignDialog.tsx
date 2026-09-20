'use client'
import { useState, type DragEvent } from 'react'
import { X, Sparkles, LayoutGrid } from 'lucide-react'
import { SIZE_TEMPLATES, QUICK_START_TEMPLATES, TEXT_TEMPLATES } from '@/features/editor/text-templates'
import { CATEGORIES, getTemplatesByCategory, type CollageTemplate } from '@/features/editor/collage/template-registry'
import { collageFrameColor } from '@/features/editor/collage-frame'
import { useEditorStore } from '@/features/editor/store/editor-store'
import { canvasFromRecentImport } from '@/lib/image/canvas'
import { isMediaDrag, mediaIdFromTransfer } from '@/features/editor/media-drag'
import { cn } from '@/lib/utils'

function TemplatePreview({ template }: { template: CollageTemplate }) {
  const title = template.decorations.find((item) => item.type === 'text')
  return (
    <div
      className="relative w-full overflow-hidden rounded-md"
      style={{
        aspectRatio: `${template.canvasWidth} / ${template.canvasHeight}`,
        background: template.backgroundColor,
      }}
    >
      {template.slots.map((slot, i) => (
        <div
          key={slot.id}
          className="absolute shadow-sm"
          style={{
            left: `${slot.x * 100}%`,
            top: `${slot.y * 100}%`,
            width: `${slot.width * 100}%`,
            height: `${slot.height * 100}%`,
            background: collageFrameColor(i).stroke,
            borderRadius:
              slot.shape === 'circle' ? '50%' : slot.shape === 'rounded' || slot.shape === 'polaroid' ? 5 : 4,
            transform: slot.rotation ? `rotate(${slot.rotation}deg)` : undefined,
            boxShadow: slot.shape === 'polaroid' ? '0 2px 5px rgba(40,28,18,0.22), 0 8px 0 #fffdf8' : undefined,
          }}
        />
      ))}
      {title?.content && (
        <span
          className="absolute pointer-events-none whitespace-nowrap"
          style={{
            left: `${title.x * 100}%`,
            top: `${title.y * 100}%`,
            transform: 'translate(-50%, -50%)',
            fontFamily: title.fontFamily ?? 'Georgia',
            fontSize: 8,
            fontWeight: title.fontWeight ?? 700,
            color: title.color ?? '#333',
          }}
        >
          {title.content}
        </span>
      )}
    </div>
  )
}

export function NewDesignDialog({ onClose }: { onClose: () => void }) {
  const newDocument = useEditorStore((s) => s.newDocument)
  const addTextLayer = useEditorStore((s) => s.addTextLayer)
  const createCollage = useEditorStore((s) => s.createCollage)
  const placeMediaOnCanvas = useEditorStore((s) => s.placeMediaOnCanvas)
  const notify = useEditorStore((s) => s.notify)
  const [collageCategory, setCollageCategory] = useState<(typeof CATEGORIES)[number]['id']>('layouts')
  const collageTemplates = getTemplatesByCategory(collageCategory)

  const groups = Array.from(new Set(SIZE_TEMPLATES.map((t) => t.group)))

  const photoFromDrop = async (transfer: DataTransfer) => {
    const id = mediaIdFromTransfer(transfer)
    if (!id) return null
    const item = useEditorStore.getState().recentImports.find((entry) => entry.id === id)
    if (!item) return null
    return { photo: await canvasFromRecentImport(item), name: item.name }
  }

  const pick = (w: number, h: number) => {
    newDocument(w, h)
    onClose()
  }

  const pickQuickStart = (w: number, h: number, textTemplateId: string) => {
    newDocument(w, h)
    const textTemplate = TEXT_TEMPLATES.find((t) => t.id === textTemplateId)
    if (textTemplate) addTextLayer(textTemplate.data())
    onClose()
  }

  const pickCollage = (templateId: string) => {
    createCollage(templateId)
    onClose()
    notify('info', 'Drag photos from Media onto a box. Click a box to highlight it, then drag the photo or handles to adjust.')
  }

  const onMediaDragOver = (e: DragEvent) => {
    if (!isMediaDrag(e.dataTransfer)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'copy'
  }

  const dropOnSize = async (e: DragEvent, w: number, h: number, textTemplateId?: string) => {
    if (!isMediaDrag(e.dataTransfer)) return
    e.preventDefault()
    e.stopPropagation()
    const media = await photoFromDrop(e.dataTransfer)
    if (!media) return
    newDocument(w, h)
    if (textTemplateId) {
      const textTemplate = TEXT_TEMPLATES.find((t) => t.id === textTemplateId)
      if (textTemplate) addTextLayer(textTemplate.data())
    }
    placeMediaOnCanvas(media.photo, media.name)
    onClose()
  }

  const dropOnCollage = async (e: DragEvent, templateId: string) => {
    if (!isMediaDrag(e.dataTransfer)) return
    e.preventDefault()
    e.stopPropagation()
    const media = await photoFromDrop(e.dataTransfer)
    if (!media) return
    createCollage(templateId)
    placeMediaOnCanvas(media.photo, media.name)
    onClose()
  }

  return (
    <div
      className="fixed top-0 right-0 bottom-0 z-50 flex items-center justify-center bg-black/50 left-[19rem]"
      onClick={onClose}
      data-testid="templates-dialog"
    >
      <div
        className="w-[480px] max-h-[75vh] overflow-y-auto rounded-xl bg-popover border border-border shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Create a design</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">
          Pick a layout or occasion, then drag photos from Media onto each box.
        </p>

        <div className="mb-5">
          <div className="flex items-center gap-1.5 mb-1">
            <LayoutGrid size={11} className="text-muted-foreground" />
            <span className="panel-label">Collage — pick a layout, add your photos</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                data-testid={`collage-category-${category.id}`}
                onClick={() => setCollageCategory(category.id)}
                className={cn(
                  'rounded-full px-2 py-0.5 text-[10px] border transition-colors',
                  collageCategory === category.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-secondary text-muted-foreground border-transparent hover:text-foreground',
                )}
              >
                {category.label}
              </button>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {collageTemplates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickCollage(t.id)}
                onDragOver={onMediaDragOver}
                onDrop={(e) => void dropOnCollage(e, t.id)}
                data-testid={`collage-${t.id}`}
                title={t.name}
                className="flex flex-col items-center gap-1.5 p-2 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
              >
                <TemplatePreview template={t} />
                <span className="text-[9px] text-muted-foreground leading-tight text-center">{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles size={11} className="text-muted-foreground" />
            <span className="panel-label">Quick start — post + title, ready to edit</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {QUICK_START_TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => pickQuickStart(t.width, t.height, t.textTemplateId)}
                onDragOver={onMediaDragOver}
                onDrop={(e) => void dropOnSize(e, t.width, t.height, t.textTemplateId)}
                className="relative overflow-hidden flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-md bg-secondary hover:bg-secondary/80 text-left transition-colors"
              >
                <span className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: t.accent }} />
                <span className="text-xs font-medium">{t.label}</span>
                <span className="text-[10px] text-muted-foreground num">{t.width} × {t.height}</span>
              </button>
            ))}
          </div>
        </div>

        {groups.map((group) => (
          <div key={group} className="mb-4">
            <span className="panel-label">{group}</span>
            <div className="mt-2 grid grid-cols-2 gap-1.5">
              {SIZE_TEMPLATES.filter((t) => t.group === group).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`template-${t.id}`}
                  onClick={() => pick(t.width, t.height)}
                  onDragOver={onMediaDragOver}
                  onDrop={(e) => void dropOnSize(e, t.width, t.height)}
                  className="flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-md bg-secondary hover:bg-secondary/80 text-left transition-colors"
                >
                  <span className="text-xs font-medium">{t.label}</span>
                  <span className="text-[10px] text-muted-foreground num">{t.width} × {t.height}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
