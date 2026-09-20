'use client'
import { useEffect } from 'react'
import { CheckCircle2, XCircle, Info } from 'lucide-react'
import { useEditorStore } from '@/features/editor/store/editor-store'

const ICONS = { success: CheckCircle2, error: XCircle, info: Info }

export function StatusToast() {
  const status = useEditorStore((s) => s.status)
  const dismiss = useEditorStore((s) => s.dismissStatus)

  useEffect(() => {
    if (!status) return
    const t = setTimeout(dismiss, status.kind === 'error' ? 5000 : 2800)
    return () => clearTimeout(t)
  }, [status, dismiss])

  if (!status) return null
  const Icon = ICONS[status.kind]
  const color = status.kind === 'error' ? 'text-destructive' : status.kind === 'success' ? 'text-success' : 'text-foreground'

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-2 rounded-lg bg-popover border border-border shadow-lg text-xs">
      <Icon size={14} className={color} />
      <span>{status.text}</span>
    </div>
  )
}
