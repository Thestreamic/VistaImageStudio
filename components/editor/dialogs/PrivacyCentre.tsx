'use client'
import { useEffect, useState } from 'react'
import { Shield, X } from 'lucide-react'
import { getBridge, type PrivacyInfo } from '@/lib/platform/bridge'

const STREAK_KEY = 'vista-streak'

function streakText() {
  try {
    const raw = localStorage.getItem(STREAK_KEY)
    const data = raw ? (JSON.parse(raw) as { count: number; last: string }) : { count: 0, last: '' }
    return data.count > 0 ? `${data.count} session${data.count === 1 ? '' : 's'} on this browser` : 'No account required — sessions are counted on this browser only'
  } catch {
    return 'No account required — sessions are counted on this browser only'
  }
}

export function bumpLocalStreak() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const raw = localStorage.getItem(STREAK_KEY)
    const data = raw ? (JSON.parse(raw) as { count: number; last: string }) : { count: 0, last: '' }
    if (data.last === today) return
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
    const count = data.last === yesterday ? data.count + 1 : 1
    localStorage.setItem(STREAK_KEY, JSON.stringify({ count, last: today }))
  } catch { /* ignore */ }
}

export function PrivacyCentre({ onClose }: { onClose: () => void }) {
  const [info, setInfo] = useState<PrivacyInfo | null>(null)

  useEffect(() => {
    void getBridge().getPrivacyInfo().then(setInfo)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 backdrop-blur-[2px] p-4" onClick={onClose}>
      <div
        className="w-[480px] max-w-full max-h-[85vh] flex flex-col rounded-xl bg-popover border border-border elev-pop overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="privacy-title"
      >
        <div className="shrink-0 flex items-start gap-3 px-5 pt-4 pb-3 border-b border-border">
          <span className="mt-0.5 w-8 h-8 shrink-0 rounded-lg bg-primary/12 text-primary flex items-center justify-center">
            <Shield size={16} />
          </span>
          <div className="flex-1 min-w-0">
            <h2 id="privacy-title" className="text-[15px] font-semibold tracking-[-0.01em]">Privacy Centre</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">How this install handles your photos and data.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close privacy centre"
            title="Close"
            className="-mr-1.5 w-8 h-8 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain scrollbar-thin px-5 py-4 space-y-3">
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            Status for this install. No account is required. The web app needs network access to load.
            Editing runs in this browser or desktop app; we do not operate a photo-storage service for your library.
          </p>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            The public web app counts anonymous visits with Umami (no cookies); it never receives your photos,
            edits or file names. The desktop app has no analytics.
          </p>
          <dl className="rounded-lg border border-border bg-card divide-y divide-border text-[12.5px]">
            <Row
              label="Analytics"
              value={
                !info ? '…' : info.analytics === 'umami' ? 'On — Umami, anonymous visit counts (web only)' : 'Off'
              }
            />
            <Row label="Network (app)" value={info?.connectSrc ?? "'self' blob: data:"} />
            <Row label="Host" value={info ? `${info.host} / ${info.platform}` : '…'} />
            <Row label="User data" value={info?.userDataPath ?? '…'} />
            <Row label="Autosave" value={info?.autosavePath ?? '…'} />
            <Row label="ONNX models" value={info?.modelsFolder ?? 'empty — heuristics only'} />
            <Row label="Sessions" value={streakText()} />
          </dl>
          <p className="text-[11.5px] text-muted-foreground leading-snug">
            Canvas export rebuilds pixels, so camera EXIF is not copied. Command chat stores text only — never pixels or file paths.
          </p>
        </div>
        <div className="shrink-0 flex justify-end px-5 py-3 border-t border-border">
          <button type="button" onClick={onClose} className="ui-tile-btn px-5">
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 px-3 py-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all text-foreground">{value}</dd>
    </div>
  )
}
