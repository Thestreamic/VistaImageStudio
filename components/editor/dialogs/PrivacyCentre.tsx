'use client'
import { useEffect, useState } from 'react'
import { Shield } from 'lucide-react'
import { getBridge, type PrivacyInfo } from '@/lib/platform/bridge'

const STREAK_KEY = 'vista-streak'

function streakText() {
  try {
    const raw = localStorage.getItem(STREAK_KEY)
    const data = raw ? (JSON.parse(raw) as { count: number; last: string }) : { count: 0, last: '' }
    return data.count > 0 ? `${data.count} local session${data.count === 1 ? '' : 's'}` : 'No cloud account — sessions stay on this device'
  } catch {
    return 'No cloud account — sessions stay on this device'
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-[460px] max-h-[85vh] overflow-y-auto rounded-xl bg-popover border border-border shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="privacy-title"
      >
        <div className="flex items-center gap-2 mb-3">
          <Shield size={16} className="text-primary" />
          <h2 id="privacy-title" className="text-sm font-semibold">Privacy Centre</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Vista Image Studio is local-first. Photos stay on this device. There is no account, no telemetry,
          and no photo upload API in the app.
        </p>
        <dl className="mt-4 space-y-2 text-xs">
          <Row label="Analytics" value={info?.analytics === 'off' ? 'Off' : 'Off'} />
          <Row label="Network (app)" value={info?.connectSrc ?? "'self' blob: data:"} />
          <Row label="Host" value={info ? `${info.host} / ${info.platform}` : '…'} />
          <Row label="User data" value={info?.userDataPath ?? '…'} />
          <Row label="Autosave" value={info?.autosavePath ?? '…'} />
          <Row label="ONNX models" value={info?.modelsFolder ?? 'empty — heuristics only'} />
          <Row label="Sessions" value={streakText()} />
        </dl>
        <p className="text-[10px] text-muted-foreground mt-3">
          Canvas export rebuilds pixels, so camera EXIF is not copied. Command chat stores text only — never pixels or file paths.
        </p>
        <button type="button" onClick={onClose} className="mt-4 w-full py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80">
          Close
        </button>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="w-28 shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all text-foreground">{value}</dd>
    </div>
  )
}
