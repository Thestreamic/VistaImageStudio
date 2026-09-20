'use client'
import { useEffect, useState } from 'react'
import { Minus, Square, X } from 'lucide-react'
import { isElectron } from '@/lib/platform/bridge'
import { useEditorStore } from '@/features/editor/store/editor-store'

export function TitleBar({
  onMinimize,
  onMaximize,
  onClose,
}: {
  onMinimize: () => void
  onMaximize: () => void
  onClose: () => void
}) {
  const [showChrome, setShowChrome] = useState(false)
  const dirty = useEditorStore((s) => s.dirty)
  const doc = useEditorStore((s) => s.doc)

  useEffect(() => {
    const windows = !/Mac/i.test(navigator.platform || navigator.userAgent || '')
    // Only real Electron (window.lumen). Cursor's browser UA also contains
    // "Electron" and would draw a fake title bar over the web app.
    setShowChrome(isElectron() && windows)
  }, [])
  if (!showChrome) return null

  const btn = 'w-11 h-full flex items-center justify-center text-muted-foreground'
  const noDrag = { WebkitAppRegion: 'no-drag' } as React.CSSProperties

  return (
    <div
      data-testid="title-bar"
      className="h-8 shrink-0 flex items-center bg-card border-b border-border select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div className="flex items-center gap-1.5 px-3 min-w-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/app-icon.png" alt="" width={14} height={14} className="rounded-[3px] shrink-0" />
        <span className="text-[12px] font-semibold tracking-[-0.01em] text-foreground/80 truncate">
          Vista{doc ? ` — ${doc.fileName}${dirty ? ' •' : ''}` : ''}
        </span>
      </div>
      <div className="flex-1 h-full" />
      <div className="flex h-full" style={noDrag}>
        <button type="button" onClick={onMinimize} title="Minimize" aria-label="Minimize" className={`${btn} hover:bg-secondary`} style={noDrag}>
          <Minus size={13} />
        </button>
        <button type="button" onClick={onMaximize} title="Maximize" aria-label="Maximize" className={`${btn} hover:bg-secondary`} style={noDrag}>
          <Square size={11} />
        </button>
        <button
          type="button"
          data-testid="titlebar-close"
          onClick={onClose}
          title="Close"
          aria-label="Close"
          className={`${btn} hover:bg-destructive hover:text-destructive-foreground`}
          style={noDrag}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
