'use client'

import { useEffect, useState } from 'react'

/** Viewports below this use the Snapseed-style editor chrome, not squeezed desktop panels. */
export const MOBILE_LAYOUT_MAX_PX = 767

export function isMobileLayoutWidth(width: number): boolean {
  return width <= MOBILE_LAYOUT_MAX_PX
}

/**
 * True for phone-width viewports. Starts false so SSR/hydration match Playwright's
 * desktop project, then updates after mount (and on rotate / resize).
 */
export function useMobileLayout(): boolean {
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_LAYOUT_MAX_PX}px)`)
    const sync = () => setMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  return mobile
}
