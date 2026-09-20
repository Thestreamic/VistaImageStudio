'use client'

import { X } from 'lucide-react'

export interface ImportProgress {
  name: string
  progress: number
  detail: string
}

export function ImportProgressOverlay({
  job,
  onCancel,
}: {
  job: ImportProgress
  onCancel: () => void
}) {
  const pct = Math.max(0, Math.min(100, Math.round(job.progress * 100)))
  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center bg-black/45 backdrop-blur-[2px]"
      data-testid="import-progress"
      role="status"
      aria-live="polite"
      aria-label={`Importing ${job.name}, ${pct} percent`}
      onClick={onCancel}
    >
      <div
        className="relative w-[320px] rounded-xl bg-popover border border-border shadow-2xl px-5 py-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          data-testid="import-cancel"
          aria-label="Cancel import"
          title="Cancel import"
          onClick={onCancel}
          className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
        >
          <X size={16} />
        </button>
        <p className="text-xs font-semibold pr-8">Importing photo</p>
        <p className="text-[11px] text-muted-foreground mt-1 truncate" title={job.name}>
          {job.name}
        </p>
        <div className="mt-3 h-2 rounded-full bg-secondary overflow-hidden">
          <div
            className="h-full brand-gradient-bg transition-[width] duration-150 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
          <span>{job.detail}</span>
          <span className="num">{pct}%</span>
        </div>
        <button
          type="button"
          data-testid="import-cancel-tab"
          onClick={onCancel}
          className="mt-3 w-full py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
