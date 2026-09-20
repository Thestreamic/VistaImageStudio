'use client'
import { useRef, useState } from 'react'
import { FolderUp, Images, Search, X } from 'lucide-react'
import { useEditorStore, type RecentImport } from '@/features/editor/store/editor-store'
import { isCollageDocument } from '@/features/editor/collage/look-targets'
import { setMediaDragData } from '@/features/editor/media-drag'
import { cn } from '@/lib/utils'

export type BinImportProgress = {
  done: number
  total: number
  name: string
}

export function ImportedImagesBin({
  onOpenImport,
  onPlaceImport,
  onImportFolder,
  progress,
  onCancelImport,
}: {
  onOpenImport: (item: RecentImport) => void
  onPlaceImport: (item: RecentImport) => void
  onImportFolder: (files: File[]) => void
  progress: BinImportProgress | null
  onCancelImport?: () => void
}) {
  const items = useEditorStore((s) => s.recentImports)
  const activeId = useEditorStore((s) => s.activeImportId)
  const setActiveImportId = useEditorStore((s) => s.setActiveImportId)
  const collageOpen = useEditorStore((s) => isCollageDocument(s.doc?.layers ?? []))
  const [query, setQuery] = useState('')
  const filesRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const q = query.trim().toLowerCase()
  const visible = q ? items.filter((item) => item.name.toLowerCase().includes(q)) : items
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div
      data-testid="imported-images-bin"
      className="w-64 shrink-0 flex flex-col min-h-0 bg-[#12131a] border-r border-border"
    >
      <div className="shrink-0 px-2 pt-2 pb-1.5 space-y-1.5">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-semibold tracking-wide uppercase text-muted-foreground">Media</span>
          {items.length > 0 && (
            <span data-testid="media-bin-count" className="text-[10px] text-muted-foreground tabular-nums">
              {items.length}
            </span>
          )}
          <button
            type="button"
            title="Import photos"
            aria-label="Import photos"
            onClick={() => filesRef.current?.click()}
            className="ml-auto w-7 h-7 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <Images size={14} />
          </button>
          <button
            type="button"
            title="Import folder"
            aria-label="Import folder"
            onClick={() => folderRef.current?.click()}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <FolderUp size={14} />
          </button>
          <input
            ref={filesRef}
            type="file"
            multiple
            data-testid="photos-import-input"
            className="sr-only"
            tabIndex={-1}
            accept="image/*,.heic,.heif,.hif"
            onChange={(e) => {
              const files = Array.from(e.currentTarget.files ?? [])
              e.currentTarget.value = ''
              if (files.length) onImportFolder(files)
            }}
          />
          <input
            ref={folderRef}
            type="file"
            multiple
            data-testid="folder-import-input"
            className="sr-only"
            tabIndex={-1}
            onClick={(e) => {
              e.currentTarget.setAttribute('webkitdirectory', '')
              e.currentTarget.setAttribute('directory', '')
            }}
            onChange={(e) => {
              const files = Array.from(e.currentTarget.files ?? [])
              e.currentTarget.value = ''
              if (files.length) onImportFolder(files)
            }}
          />
        </div>
        <div className="flex items-center gap-1.5 h-7 px-2 rounded-md bg-input border border-border">
          <Search size={12} className="text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            aria-label="Search imported photos"
            className="flex-1 min-w-0 bg-transparent text-[11px] outline-none placeholder:text-muted-foreground/70"
          />
        </div>
        {progress && (
          <div data-testid="bin-import-progress" className="space-y-1">
            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                <div className="h-full brand-gradient-bg transition-[width] duration-150" style={{ width: `${pct}%` }} />
              </div>
              {onCancelImport && (
                <button
                  type="button"
                  data-testid="bin-import-cancel"
                  aria-label="Cancel import"
                  title="Cancel import"
                  onClick={onCancelImport}
                  className="w-5 h-5 shrink-0 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-secondary"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground truncate">
              Importing {progress.done} / {progress.total} · {progress.name}
            </p>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin p-2">
        {visible.length === 0 && (
          <p className="text-[11px] text-muted-foreground/70 px-0.5 py-2 leading-relaxed">
            Drop a folder or photos
          </p>
        )}
        <div className="grid grid-cols-2 gap-1.5">
          {visible.map((item) => {
            const selected = item.id === activeId
            return (
              <button
                key={item.id}
                type="button"
                draggable
                data-testid="media-bin-tile"
                data-import-id={item.id}
                title={
                  collageOpen
                    ? `${item.name} — double-click to fill the next empty frame`
                    : `${item.name} — drag onto a template`
                }
                aria-label={item.name}
                aria-current={selected ? 'true' : undefined}
                onDragStart={(e) => {
                  setMediaDragData(e.dataTransfer, item.id)
                  const thumb = e.currentTarget.querySelector('img')
                  if (thumb) e.dataTransfer.setDragImage(thumb, 24, 24)
                }}
                onClick={() => {
                  setActiveImportId(item.id)
                  if (!collageOpen) onOpenImport(item)
                }}
                onDoubleClick={() => {
                  setActiveImportId(item.id)
                  onPlaceImport(item)
                }}
                className={cn(
                  'relative aspect-square rounded-sm overflow-hidden bg-secondary/80 group text-left cursor-grab active:cursor-grabbing',
                  selected ? 'brand-gradient-border' : 'border border-transparent hover:border-white/25',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbnailDataUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-90 group-hover:opacity-100"
                  draggable={false}
                />
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-1 py-0.5 text-[9px] leading-tight text-white/90">
                  {item.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      {items.length > 0 && (
        <p className="shrink-0 px-2 py-1.5 text-[10px] text-muted-foreground/80 leading-relaxed border-t border-border">
          {collageOpen
            ? 'Double-click fills the next empty frame. Drag onto a box. Photos stay in Media when you switch templates.'
            : 'Import photos or a folder — thumbnails stay in Media. Drag onto a template. File → Open still replaces the canvas.'}
        </p>
      )}
    </div>
  )
}
