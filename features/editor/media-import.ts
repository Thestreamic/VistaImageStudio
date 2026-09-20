/** How a photo arrived. Open always replaces the canvas; drops/folders keep an open collage. */
export type ImportIntent = 'open' | 'drop' | 'folder'

export function importOpensDocument(
  doc: { layers?: { collageCell?: unknown }[] } | null | undefined,
  intent: ImportIntent,
): boolean {
  if (intent === 'open') return true
  if (!doc) return true
  return false
}
