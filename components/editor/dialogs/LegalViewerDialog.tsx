'use client'

import { EULA_TEXT, EULA_TITLE } from '@/lib/legal/eula'
import { NOTICES_TEXT, NOTICES_TITLE } from '@/lib/legal/notices'
import { PRIVACY_TEXT, PRIVACY_TITLE } from '@/lib/legal/privacy'
import { LegalText } from '@/components/legal/LegalText'

export type LegalDocId = 'eula' | 'privacy' | 'notices'

const DOCS: Record<LegalDocId, { title: string; text: string }> = {
  eula: { title: EULA_TITLE, text: EULA_TEXT },
  privacy: { title: PRIVACY_TITLE, text: PRIVACY_TEXT },
  notices: { title: NOTICES_TITLE, text: NOTICES_TEXT },
}

export function LegalViewerDialog({
  doc,
  onClose,
}: {
  doc: LegalDocId
  onClose: () => void
}) {
  const item = DOCS[doc]
  return (
    <div
      className="fixed inset-0 z-[85] flex items-center justify-center bg-black/55 p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-3xl max-h-[min(44rem,100%)] flex-col rounded-xl border border-border bg-popover shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="legal-viewer-title"
        data-testid={`legal-viewer-${doc}`}
      >
        <header className="shrink-0 flex items-center gap-3 px-5 py-4 border-b border-border">
          <h2 id="legal-viewer-title" className="flex-1 text-sm font-semibold">
            {item.title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-3 text-sm rounded-md bg-secondary hover:bg-secondary/80"
          >
            Close
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
          <LegalText text={item.text} />
        </div>
      </div>
    </div>
  )
}
