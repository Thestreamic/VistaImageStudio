'use client'
import { Loader2 } from 'lucide-react'
import { useEditorStore } from '@/features/editor/store/editor-store'

export function AiProgressOverlay() {
  const job = useEditorStore((s) => s.aiJob)
  if (!job) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
      <div className="flex flex-col items-center gap-3 px-6 py-5 rounded-xl bg-popover border border-border shadow-2xl min-w-[220px]">
        <Loader2 size={22} className="animate-spin text-primary" />
        <div className="text-center">
          <p className="text-xs font-medium">{job.label}</p>
          {job.detail && <p className="text-[10px] text-muted-foreground mt-0.5">{job.detail}</p>}
        </div>
        {job.progress >= 0 && (
          <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${job.progress * 100}%` }} />
          </div>
        )}
      </div>
    </div>
  )
}
