'use client'
import { useEffect } from 'react'
import { useEditorStore } from '@/features/editor/store/editor-store'

const STORAGE_KEY = 'vista-theme'

/**
 * Keeps the saved theme preference and the DOM in sync. The class goes on
 * <html> rather than the editor shell so the page background, native
 * scrollbars and form controls (via `color-scheme`) switch too.
 */
export function ThemeProvider() {
  const theme = useEditorStore((s) => s.theme)
  const setTheme = useEditorStore((s) => s.setTheme)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'light' || saved === 'dark') setTheme(saved)
  }, [setTheme])

  useEffect(() => {
    document.documentElement.classList.toggle('theme-light', theme === 'light')
    document.documentElement.style.colorScheme = theme === 'light' ? 'light' : 'dark'
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta instanceof HTMLMetaElement) {
      meta.content = theme === 'light' ? '#efe6d8' : '#2a2d33'
    }
  }, [theme])

  return null
}
