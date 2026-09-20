import { compositor } from './engine/compositor'
import type { DocumentState } from './types'

/**
 * Print the current composite via a hidden iframe so Electron and the web
 * app both hit the system print dialog without a popup window.
 */
export function printComposite(doc: DocumentState): boolean {
  if (typeof document === 'undefined') return false
  const canvas = compositor.renderOutput(doc)
  const url = canvas.toDataURL('image/png')
  const iframe = document.createElement('iframe')
  iframe.setAttribute('data-testid', 'print-frame')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const frame = iframe.contentWindow
  const idoc = iframe.contentDocument
  if (!frame || !idoc) {
    iframe.remove()
    return false
  }
  idoc.open()
  idoc.write(`<!doctype html><html><head><title>${escapeHtml(doc.fileName || 'Print')}</title>
<style>
  html, body { margin: 0; background: #fff; }
  img { display: block; max-width: 100%; height: auto; }
  @page { margin: 10mm; }
</style></head><body><img src="${url}" alt="" /></body></html>`)
  idoc.close()
  const img = idoc.querySelector('img')
  const cleanup = () => {
    window.setTimeout(() => iframe.remove(), 1000)
  }
  const go = () => {
    try {
      frame.focus()
      frame.print()
    } finally {
      cleanup()
    }
  }
  if (img && !img.complete) img.onload = go
  else go()
  return true
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch)
}
