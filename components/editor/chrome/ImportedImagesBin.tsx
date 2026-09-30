'use client'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FolderUp, Images, Search, X, PanelLeftClose, ImagePlus } from 'lucide-react'
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
  onCollapse,
  className,
}: {
  onOpenImport: (item: RecentImport) => void
  onPlaceImport: (item: RecentImport) => void
  onImportFolder: (files: File[]) => void
  progress: BinImportProgress | null
  onCancelImport?: () => void
  /** Desktop: hide the bin to give the canvas more room. */
  onCollapse?: () => void
  className?: string
}) {
  const items = useEditorStore((s) => s.recentImports)
  const activeId = useEditorStore((s) => s.activeImportId)
  const setActiveImportId = useEditorStore((s) => s.setActiveImportId)
  const removeRecentImports = useEditorStore((s) => s.removeRecentImports)
  const collageOpen = useEditorStore((s) => isCollageDocument(s.doc?.layers ?? []))
  const [query, setQuery] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; id: string } | null>(null)
  const filesRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const q = query.trim().toLowerCase()
  const visible = q ? items.filter((item) => item.name.toLowerCase().includes(q)) : items
  const pct = progress && progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  const deleteIds = (ids: string[]) => {
    if (!ids.length) return
    removeRecentImports(ids)
    setMenu(null)
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement | null)?.isContentEditable) return
      const active = useEditorStore.getState().activeImportId
      if (!active) return
      const root = rootRef.current
      const target = e.target as Node | null
      const focusInside = !!(root && target && root.contains(target))
      const activeEl = document.activeElement
      const activeInside = !!(root && activeEl && root.contains(activeEl))
      if (!focusInside && !activeInside) return
      e.preventDefault()
      e.stopPropagation()
      deleteIds([active])
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [removeRecentImports])

  return (
    <div
      ref={rootRef}
      data-testid="imported-images-bin"
      className={cn(
        'w-60 shrink-0 flex flex-col min-h-0 bg-sidebar border-r border-sidebar-border',
        className,
      )}
      onKeyDown={(e) => {
        if (e.key !== 'Delete' && e.key !== 'Backspace') return
        const tag = (e.target as HTMLElement | null)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        if (!activeId) return
        e.preventDefault()
        e.stopPropagation()
        deleteIds([activeId])
      }}
    >
      <div className="shrink-0 px-2.5 pt-2.5 pb-2 space-y-2">
        <div className="flex items-center gap-1">
          <span className="panel-label">Media</span>
          {items.length > 0 && (
            <span data-testid="media-bin-count" className="text-[11px] text-muted-foreground tabular-nums">
              {items.length}
            </span>
          )}
          <button
            type="button"
            title="Import photos"
            aria-label="Import photos"
            onClick={() => filesRef.current?.click()}
            className="ml-auto w-7 h-7 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <Images size={14} />
          </button>
          <button
            type="button"
            title="Import folder"
            aria-label="Import folder"
            onClick={() => folderRef.current?.click()}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
          >
            <FolderUp size={14} />
          </button>
          {onCollapse && (
            <button
              type="button"
              data-testid="media-bin-collapse"
              title="Hide Media (more room for the photo)"
              aria-label="Hide Media"
              onClick={onCollapse}
              className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            >
              <PanelLeftClose size={14} />
            </button>
          )}
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
        <div className="flex items-center gap-1.5 h-8 px-2 rounded-md bg-input border border-border focus-within:border-ring/60 transition-colors">
          <Search size={12} className="text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to search…"
            aria-label="Search imported photos"
            className="flex-1 min-w-0 bg-transparent text-[12px] outline-none placeholder:text-muted-foreground"
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
            <p className="text-[11px] text-muted-foreground truncate">
              Importing {progress.done} / {progress.total} · {progress.name}
            </p>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-thin px-2.5 pb-2.5 pt-1 [scrollbar-gutter:stable]">
        {items.length === 0 && (
          <div data-testid="media-bin-empty" className="mt-1 flex flex-col items-center gap-2.5 rounded-lg border border-dashed border-border px-3 py-6 text-center">
            <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-muted-foreground">
              <ImagePlus size={18} strokeWidth={1.75} />
            </div>
            <p className="text-[12.5px] font-medium text-foreground/90">No photos yet</p>
            <p className="text-[11.5px] text-muted-foreground leading-snug">Import photos or a folder, or drop files anywhere.</p>
            <button
              type="button"
              onClick={() => filesRef.current?.click()}
              className="mt-0.5 h-8 px-3 rounded-md border border-border bg-secondary text-[12px] font-medium hover:bg-accent transition-colors"
            >
              Import photos
            </button>
          </div>
        )}
        {items.length > 0 && visible.length === 0 && (
          <p className="text-[12px] text-muted-foreground px-0.5 py-2 leading-relaxed">No photos match this search.</p>
        )}
        <div className="grid grid-cols-2 gap-2">
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
                    ? `${item.name} — double-click to fill the next empty frame · right-click or Delete to remove`
                    : `${item.name} — drag onto a template · right-click or Delete to remove`
                }
                aria-label={item.name}
                aria-current={selected ? 'true' : undefined}
                onDragStart={(e) => {
                  setDraggingId(item.id)
                  setMediaDragData(e.dataTransfer, item.id)
                  const thumb = e.currentTarget.querySelector('img')
                  if (thumb) e.dataTransfer.setDragImage(thumb, 24, 24)
                }}
                onDragEnd={() => setDraggingId(null)}
                onClick={() => {
                  setActiveImportId(item.id)
                  if (!collageOpen) onOpenImport(item)
                }}
                onDoubleClick={() => {
                  setActiveImportId(item.id)
                  onPlaceImport(item)
                }}
                onContextMenu={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  setActiveImportId(item.id)
                  setMenu({ x: e.clientX, y: e.clientY, id: item.id })
                }}
                className={cn(
                  'relative aspect-square rounded-md overflow-hidden bg-secondary/80 group text-left cursor-grab active:cursor-grabbing transition-[box-shadow,opacity,transform]',
                  selected
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-sidebar'
                    : 'ring-1 ring-border hover:ring-foreground/30',
                  draggingId === item.id && 'opacity-45 scale-[0.97]',
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.thumbnailDataUrl}
                  alt=""
                  className="h-full w-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                  draggable={false}
                />
                <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/80 to-black/35 px-1.5 pt-2 pb-1 text-[10.5px] leading-tight text-white/95">
                  {item.name}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      {items.length > 0 && (
        <p className="shrink-0 px-2.5 py-2 text-[11px] text-muted-foreground leading-snug border-t border-border">
          {collageOpen
            ? 'Double-click fills the next empty frame, or drag onto a box. Right-click to remove.'
            : 'Click to edit · drag onto a template · right-click to remove.'}
        </p>
      )}
      {menu && (
        <MediaBinContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          onDelete={() => deleteIds([menu.id])}
        />
      )}
    </div>
  )
}

function MediaBinContextMenu({
  x,
  y,
  onClose,
  onDelete,
}: {
  x: number
  y: number
  onClose: () => void
  onDelete: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pad = 8
    el.style.left = `${Math.max(pad, Math.min(x, window.innerWidth - rect.width - pad))}px`
    el.style.top = `${Math.max(pad, Math.min(y, window.innerHeight - rect.height - pad))}px`
  }, [x, y])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current?.contains(event.target as Node)) return
      onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      role="menu"
      data-testid="media-bin-context-menu"
      className="fixed z-[60] min-w-[9rem] rounded-md border border-border bg-popover p-1 elev-pop"
      style={{ left: x, top: y }}
      onContextMenu={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      <button
        type="button"
        role="menuitem"
        data-testid="media-bin-menu-delete"
        className="w-full text-left px-2.5 py-1.5 text-[13px] rounded-sm hover:bg-secondary text-destructive"
        onClick={onDelete}
      >
        Delete from Media
      </button>
    </div>
  )
}
