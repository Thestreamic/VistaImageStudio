'use client'

import {
  EULA_COPYRIGHT_YEAR,
  EULA_LAST_UPDATED,
  EULA_LICENSOR,
  EULA_PATH,
  EULA_PRODUCT,
  NOTICES_PATH,
  PRIVACY_PATH,
} from '@/lib/legal/eula'
import type { LegalDocId } from './LegalViewerDialog'

const APP_VERSION = '0.1.0'

export function AboutDialog({
  onClose,
  onOpenLegal,
}: {
  onClose: () => void
  onOpenLegal: (doc: LegalDocId) => void
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-popover shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="about-title"
        data-testid="about-dialog"
      >
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/app-icon.png" alt="" width={48} height={48} className="rounded-lg ring-1 ring-border" />
          <div>
            <h2 id="about-title" className="text-base font-semibold">
              {EULA_PRODUCT}
            </h2>
            <p className="text-[13px] text-muted-foreground">Version {APP_VERSION}</p>
          </div>
        </div>
        <p className="mt-4 text-[13px] text-muted-foreground leading-relaxed">
          © {EULA_COPYRIGHT_YEAR} {EULA_LICENSOR}. All rights reserved.
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Local-first photo editor. EULA last updated {EULA_LAST_UPDATED}.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2">
          <button
            type="button"
            data-testid="about-eula"
            onClick={() => onOpenLegal('eula')}
            className="min-h-11 px-3 text-sm rounded-md bg-secondary hover:bg-secondary/80 text-left"
          >
            End-User License Agreement
          </button>
          <button
            type="button"
            data-testid="about-privacy"
            onClick={() => onOpenLegal('privacy')}
            className="min-h-11 px-3 text-sm rounded-md bg-secondary hover:bg-secondary/80 text-left"
          >
            Privacy Policy
          </button>
          <button
            type="button"
            data-testid="about-notices"
            onClick={() => onOpenLegal('notices')}
            className="min-h-11 px-3 text-sm rounded-md bg-secondary hover:bg-secondary/80 text-left"
          >
            Third-party notices
          </button>
        </div>
        <p className="mt-3 text-[11px] text-muted-foreground">
          Also published at{' '}
          <a className="text-primary hover:underline" href={EULA_PATH} target="_blank" rel="noreferrer">
            /eula
          </a>
          ,{' '}
          <a className="text-primary hover:underline" href={PRIVACY_PATH} target="_blank" rel="noreferrer">
            /privacy
          </a>
          {' '}and{' '}
          <a className="text-primary hover:underline" href={NOTICES_PATH} target="_blank" rel="noreferrer">
            /notices
          </a>
          .
        </p>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full min-h-11 text-sm rounded-md brand-gradient-bg text-white"
        >
          Close
        </button>
      </div>
    </div>
  )
}
