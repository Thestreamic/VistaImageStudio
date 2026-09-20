'use client'

import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * Overlay sheet that sits above the canvas and above the mobile tab bar.
 * Swipe the handle down (or tap the backdrop / close) to dismiss.
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
  const drag = useRef<{ y: number; start: number } | null>(null)
  const sheet = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const onHandleDown = (e: ReactPointerEvent) => {
    drag.current = { y: e.clientY, start: 0 }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onHandleMove = (e: ReactPointerEvent) => {
    if (!drag.current || !sheet.current) return
    const dy = Math.max(0, e.clientY - drag.current.y)
    sheet.current.style.transform = `translateY(${dy}px)`
  }
  const onHandleUp = (e: ReactPointerEvent) => {
    if (!drag.current || !sheet.current) return
    const dy = e.clientY - drag.current.y
    drag.current = null
    sheet.current.style.transform = ''
    if (dy > 72) onClose()
  }

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
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-x-0 z-[46] flex flex-col rounded-t-2xl border border-border bg-sidebar shadow-2xl"
        style={{
          bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))',
          maxHeight: 'min(72vh, 34rem)',
        }}
      >
        <div
          className="shrink-0 flex items-center gap-2 px-3 pt-2 pb-1 touch-none"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <div className="mx-auto w-10 h-1 rounded-full bg-foreground/20" />
        </div>
        <div className="shrink-0 flex items-center gap-2 px-3 pb-2 border-b border-border">
          <h2 className="flex-1 text-sm font-semibold">{title}</h2>
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
