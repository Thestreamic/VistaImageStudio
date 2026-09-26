'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { X } from 'lucide-react'

/** Compact leaves most of the photo visible; expanded still caps near ~40dvh. */
const COMPACT_MAX = 'min(22dvh, 11.5rem)'
const EXPANDED_MAX = 'min(40dvh, 22rem)'

type SheetSnap = 'compact' | 'expanded'

/**
 * Overlay sheet that sits above the canvas and above the mobile tab bar.
 * Drag the handle: up expands, down collapses, further down dismisses.
 * Dragging any range slider peeks the sheet so the photo stays readable.
 */
export function MobileBottomSheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const drag = useRef<{ y: number; mode: 'handle' } | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const [snap, setSnap] = useState<SheetSnap>('compact')
  const [peeking, setPeeking] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    setSnap('compact')
    setPeeking(false)
  }, [title])

  const endPeek = useCallback(() => {
    setPeeking(false)
    delete document.documentElement.dataset.mobileSheetPeek
  }, [])

  const beginPeek = useCallback(() => {
    setPeeking(true)
    document.documentElement.dataset.mobileSheetPeek = '1'
  }, [])

  useEffect(() => {
    const sheetEl = sheet.current
    if (!sheetEl) return

    const isSliderTarget = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false
      return !!target.closest('input[type="range"], .slider')
    }

    const onDownCapture = (e: PointerEvent) => {
      if (!isSliderTarget(e.target)) return
      beginPeek()
    }
    const onUp = () => endPeek()

    sheetEl.addEventListener('pointerdown', onDownCapture, true)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      sheetEl.removeEventListener('pointerdown', onDownCapture, true)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      endPeek()
    }
  }, [beginPeek, endPeek])

  const onHandleDown = (e: ReactPointerEvent) => {
    drag.current = { y: e.clientY, mode: 'handle' }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onHandleMove = (e: ReactPointerEvent) => {
    if (!drag.current || !sheet.current) return
    const dy = e.clientY - drag.current.y
    // Follow the finger a little; clamp so it cannot fly off-screen upward.
    const apply = Math.max(-48, Math.min(120, dy))
    sheet.current.style.transform = `translateY(${apply}px)`
  }
  const onHandleUp = (e: ReactPointerEvent) => {
    if (!drag.current || !sheet.current) return
    const dy = e.clientY - drag.current.y
    drag.current = null
    sheet.current.style.transform = ''
    if (dy > 72) {
      if (snap === 'expanded') setSnap('compact')
      else onClose()
      return
    }
    if (dy < -40) setSnap('expanded')
  }

  const maxHeight = snap === 'compact' ? COMPACT_MAX : EXPANDED_MAX

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Dismiss panel"
        className="fixed inset-0 z-[45] bg-black/40"
        onClick={onClose}
      />
      <div
        ref={sheet}
        data-testid="mobile-sheet"
        data-snap={snap}
        data-peeking={peeking ? 'true' : 'false'}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-x-0 z-[46] flex flex-col rounded-t-2xl border border-border bg-sidebar shadow-2xl transition-[max-height,opacity] duration-200 ease-out"
        style={{
          bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))',
          maxHeight,
          opacity: peeking ? 0.32 : 1,
        }}
      >
        <div
          data-testid="mobile-sheet-handle"
          className="shrink-0 flex flex-col items-center gap-1 px-3 pt-2 pb-1 touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <div className="w-10 h-1 rounded-full bg-foreground/25" />
          <span className="sr-only">
            {snap === 'compact' ? 'Drag up to expand panel' : 'Drag down to collapse panel'}
          </span>
        </div>
        <div className="shrink-0 flex items-center gap-2 px-3 pb-2 border-b border-border">
          <h2 className="flex-1 text-sm font-semibold">{title}</h2>
          <button
            type="button"
            data-testid="mobile-sheet-expand"
            aria-label={snap === 'compact' ? 'Expand panel' : 'Collapse panel'}
            onClick={() => setSnap((s) => (s === 'compact' ? 'expanded' : 'compact'))}
            className="h-9 px-2 text-[11px] font-medium rounded-md hover:bg-secondary text-muted-foreground"
          >
            {snap === 'compact' ? 'Expand' : 'Compact'}
          </button>
          <button
            type="button"
            aria-label="Close panel"
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-md hover:bg-secondary"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin overscroll-contain">{children}</div>
      </div>
    </div>
  )
}
