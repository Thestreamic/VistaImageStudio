'use client'

import { useEffect, useRef, useState } from 'react'

const STEPS: { at: number; text: string }[] = [
  { at: 0, text: 'Starting Vista Image Studio…' },
  { at: 25, text: 'Loading editor…' },
  { at: 70, text: 'Opening workspace…' },
]

export function shouldSkipLaunchSplash(): boolean {
  if (typeof navigator === 'undefined') return false
  return navigator.webdriver === true
}

function stepText(pct: number, complete: boolean): string {
  if (complete && pct >= 100) return 'Ready'
  let text = STEPS[0].text
  for (const step of STEPS) if (pct >= step.at) text = step.text
  return text
}

/**
 * Short splash. Completes as soon as the editor signals ready — no fake
 * Avid-style phases and no 6.5s ease that parked the bar at 84%.
 */
export function LaunchSplash({
  complete,
  onDone,
}: {
  complete: boolean
  onDone: () => void
}) {
  const [pct, setPct] = useState(0)
  const [detail, setDetail] = useState(STEPS[0].text)
  const shownRef = useRef(0)
  const finishedRef = useRef(false)

  useEffect(() => {
    let frame = 0
    const started = Date.now()
    const tick = () => {
      if (complete) {
        shownRef.current = Math.min(100, shownRef.current + 8)
      } else {
        const t = (Date.now() - started) / 900
        const target = 88 * (1 - Math.exp(-Math.max(0, t)))
        shownRef.current += (target - shownRef.current) * 0.4
      }
      const p = Math.max(0, Math.min(complete ? 100 : 92, Math.round(shownRef.current)))
      setPct(p)
      setDetail(stepText(p, complete))
      if (complete && p >= 100 && !finishedRef.current) {
        finishedRef.current = true
        window.setTimeout(onDone, 80)
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [complete, onDone])

  return (
    <div
      data-testid="launch-splash"
      className="fixed inset-0 z-[80] flex flex-col items-center justify-center px-14"
      style={{
        background:
          'radial-gradient(ellipse at 50% 0%, #2a1848 0%, transparent 55%), linear-gradient(180deg, #14151c 0%, #0e0f14 100%)',
      }}
      role="status"
      aria-live="polite"
      aria-label={`${detail}, ${pct} percent`}
    >
      <div className="w-[72px] h-[72px] rounded-[18px] brand-gradient-bg grid place-items-center shadow-lg shadow-indigo-500/30 mb-[18px]">
        <span className="text-[34px] font-bold text-white leading-none">L</span>
      </div>
      <h1 className="text-[22px] font-semibold tracking-wide">Vista Image Studio</h1>
      <p className="mt-1.5 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
        Local photo editor · v0.1.0
      </p>
      <p className="mt-10 w-full max-w-[520px] text-[13px] text-[#c8c2d6]">{detail}</p>
      <div className="mt-2.5 w-full max-w-[520px] h-2 rounded-full bg-[#23242e] overflow-hidden">
        <div className="h-full brand-gradient-bg" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 w-full max-w-[520px] text-right text-[11px] text-muted-foreground num">{pct}%</p>
      <p className="absolute bottom-5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
        Privacy-first · nothing leaves this device
      </p>
    </div>
  )
}
