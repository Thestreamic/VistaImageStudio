'use client'

export function ConfirmDialog({
  title,
  body,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  extraLabel,
  danger = false,
  onConfirm,
  onCancel,
  onExtra,
}: {
  title: string
  body: string
  confirmLabel?: string
  cancelLabel?: string
  extraLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
  onExtra?: () => void
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50">
      <div
        role="alertdialog"
        aria-labelledby="confirm-title"
        className="w-[380px] rounded-xl bg-popover border border-border shadow-2xl p-4"
      >
        <h2 id="confirm-title" className="text-sm font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{body}</p>
        <div className="mt-4 flex justify-end gap-2 flex-wrap">
          {extraLabel && onExtra && (
            <button type="button" onClick={onExtra} className="px-3 py-1.5 text-xs rounded-md text-destructive hover:bg-secondary mr-auto">
              {extraLabel}
            </button>
          )}
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80">
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3 py-1.5 text-xs rounded-md ${danger ? 'bg-destructive text-destructive-foreground' : 'brand-gradient-bg text-white'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
