'use client'

import { useEffect } from 'react'

/** Apply the editor's saved light/dark class on standalone legal routes. */
export function ThemeHydrate() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem('vista-theme')
      const light = saved === 'light'
      document.documentElement.classList.toggle('theme-light', light)
      document.documentElement.style.colorScheme = light ? 'light' : 'dark'
    } catch {
      /* ignore */
    }
  }, [])
  return null
}
