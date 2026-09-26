'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { selectPhotoLayer, useEditorStore } from '@/features/editor/store/editor-store'
import {
  runAutoColor,
  runClarity,
  runDehaze,
  runInstagram45,
  runLowLight,
  runMagicEraser,
  runNaturalColor,
  runOptimizeImage,
  runPortraitBokeh,
  runRemoveBackground,
  runUpscale2x,
  runVibrance,
} from '@/features/editor/one-click-actions'

const ITEM =
  'w-full text-left px-3 py-1.5 text-[13px] hover:bg-secondary disabled:opacity-40 disabled:pointer-events-none'

export function CanvasContextMenu({
  x,
  y,
  onClose,
}: {
  x: number
  y: number
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const doc = useEditorStore((s) => s.doc)
  const busy = useEditorStore((s) => !!s.aiJob)
  const hasLayer = useEditorStore((s) => !!selectPhotoLayer(s))
  const canDelete = (doc?.layers.length ?? 0) > 1
  const locked = !hasLayer || busy

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pad = 8
    const left = Math.max(pad, Math.min(x, window.innerWidth - rect.width - pad))
    const top = Math.max(pad, Math.min(y, window.innerHeight - rect.height - pad))
    el.style.left = `${left}px`
    el.style.top = `${top}px`
  }, [x, y])

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 2) return
      if (ref.current?.contains(event.target as Node)) return
      event.preventDefault()
      event.stopPropagation()
      onClose()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const onScroll = () => onClose()
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [onClose])

  const act = (run: () => void) => {
    run()
    onClose()
  }

  return (
    <div
      ref={ref}
      role="menu"
      data-testid="canvas-context-menu"
      className="fixed z-50 min-w-[12.5rem] max-h-[70vh] overflow-y-auto rounded-md border border-border bg-card py-1 shadow-lg"
      style={{ left: x, top: y }}
      onContextMenu={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onClose()
      }}
    >
      <button
        type="button"
        role="menuitem"
        data-testid="canvas-menu-delete"
        className={ITEM}
        disabled={!canDelete}
        onClick={() => {
          const current = useEditorStore.getState().doc
          const id = current?.activeLayerId
          if (id) useEditorStore.getState().removeLayer(id)
          onClose()
        }}
      >
        Delete
      </button>
      <div className="my-1 h-px bg-border" />
      <button type="button" role="menuitem" className={ITEM} disabled={locked} onClick={() => act(runOptimizeImage)}>
        Optimize Image
      </button>
      <button type="button" role="menuitem" className={ITEM} disabled={locked} onClick={() => act(runNaturalColor)}>
        Natural Color
      </button>
      <button type="button" role="menuitem" className={ITEM} disabled={locked} onClick={() => act(() => void runAutoColor())}>
        Auto Color Correct
      </button>
      <button type="button" role="menuitem" className={ITEM} disabled={locked} onClick={() => act(() => void runPortraitBokeh())}>
        Portrait Bokeh
      </button>
      <button type="button" role="menuitem" className={ITEM} disabled={locked} onClick={() => act(() => void runRemoveBackground())}>
        Remove Background
      </button>
      <button type="button" role="menuitem" className={ITEM} disabled={locked} onClick={() => act(() => void runMagicEraser())}>
        Magic Eraser
      </button>
      <button
        type="button"
        role="menuitem"
        className={ITEM}
        disabled={locked || !doc}
        onClick={() => act(runInstagram45)}
      >
        Instagram 4:5
      </button>
      <button type="button" role="menuitem" className={ITEM} disabled={locked} onClick={() => act(() => void runLowLight())}>
        Low Light
      </button>
      <button type="button" role="menuitem" className={ITEM} disabled={locked} onClick={() => act(() => void runDehaze())}>
        Dehaze
      </button>
      <button type="button" role="menuitem" className={ITEM} disabled={locked} onClick={() => act(() => void runClarity())}>
        Clarity
      </button>
      <button type="button" role="menuitem" className={ITEM} disabled={locked} onClick={() => act(() => void runVibrance())}>
        Vibrance
      </button>
      <button type="button" role="menuitem" className={ITEM} disabled={locked} onClick={() => act(() => void runUpscale2x())}>
        Upscale 2×
      </button>
    </div>
  )
}
