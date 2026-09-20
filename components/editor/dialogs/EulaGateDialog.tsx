'use client'

import { useState } from 'react'
import {
  EULA_CONTACT_MAILTO,
  EULA_LAST_UPDATED,
  EULA_PRODUCT,
  EULA_TEXT,
  EULA_TITLE,
  NOTICES_PATH,
  PRIVACY_PATH,
} from '@/lib/legal/eula'
import { acceptCurrentEula, declineEulaAndExit } from '@/lib/legal/persist-eula'
import { LegalText } from '@/components/legal/LegalText'

export function EulaGateDialog({ onAccepted }: { onAccepted: () => void }) {
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [blocked, setBlocked] = useState(false)

  const accept = async () => {
    if (!agreed || busy) return
    setBusy(true)
    try {
      await acceptCurrentEula()
      onAccepted()
    } finally {
      setBusy(false)
    }
  }

  const decline = async () => {
    if (busy) return
    setBusy(true)
    try {
      const result = await declineEulaAndExit()
      if (result === 'blocked') setBlocked(true)
    } finally {
      setBusy(false)
    }
  }

  if (blocked) {
    return (
      <div
        className="fixed inset-0 z-[90] flex items-center justify-center bg-background px-6"
        data-testid="eula-blocked"
        role="alertdialog"
        aria-labelledby="eula-blocked-title"
      >
        <div className="w-full max-w-md rounded-xl border border-border bg-popover p-6 shadow-2xl">
          <h1 id="eula-blocked-title" className="text-base font-semibold">
            Agreement required
          </h1>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            You must accept the End-User License Agreement to use {EULA_PRODUCT}.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              className="min-h-11 px-4 text-sm rounded-md bg-secondary hover:bg-secondary/80"
              onClick={() => setBlocked(false)}
            >
              Review agreement
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background/95 p-3 sm:p-6"
      data-testid="eula-gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="eula-gate-title"
    >
      <div className="flex w-full max-w-3xl max-h-[min(44rem,100%)] flex-col rounded-xl border border-border bg-popover shadow-2xl">
        <header className="shrink-0 px-5 pt-5 pb-3 border-b border-border">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">The Streamic</p>
          <h1 id="eula-gate-title" className="mt-1 text-lg font-semibold tracking-[-0.02em]">
            {EULA_TITLE}
          </h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {EULA_PRODUCT} · Last updated {EULA_LAST_UPDATED}
          </p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-thin px-5 py-4">
          <LegalText text={EULA_TEXT} testId="eula-text" />
        </div>
        <footer className="shrink-0 px-5 py-4 border-t border-border space-y-3">
          <label className="flex items-start gap-3 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              data-testid="eula-agree"
              className="mt-0.5 size-4 accent-primary"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
            />
            <span>I have read and agree to this End-User License Agreement.</span>
          </label>
          <p className="text-[11px] text-muted-foreground">
            Also see the{' '}
            <a className="text-primary hover:underline" href={PRIVACY_PATH} target="_blank" rel="noreferrer">
              Privacy Policy
            </a>
            {' '}and{' '}
            <a className="text-primary hover:underline" href={NOTICES_PATH} target="_blank" rel="noreferrer">
              third-party notices
            </a>
            . Questions:{' '}
            <a className="text-primary hover:underline" href={EULA_CONTACT_MAILTO}>
              thestreamic@gmail.com
            </a>
            .
          </p>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              data-testid="eula-decline"
              onClick={() => void decline()}
              disabled={busy}
              className="min-h-11 px-4 text-sm rounded-md bg-secondary hover:bg-secondary/80 disabled:opacity-50"
            >
              Decline
            </button>
            <button
              type="button"
              data-testid="eula-accept"
              onClick={() => void accept()}
              disabled={!agreed || busy}
              className="min-h-11 px-5 text-sm font-medium rounded-md brand-gradient-bg text-white disabled:opacity-40 disabled:pointer-events-none"
            >
              Agree
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}

export function EulaLoadingScreen() {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-background text-muted-foreground text-sm"
      data-testid="eula-loading"
    >
      Starting Vista Image Studio…
    </div>
  )
}
