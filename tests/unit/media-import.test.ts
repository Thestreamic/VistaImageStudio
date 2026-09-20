import { describe, expect, it } from 'vitest'
import { importOpensDocument } from '@/features/editor/media-import'

describe('importOpensDocument', () => {
  it('opens the canvas when nothing is on the board', () => {
    expect(importOpensDocument(null, 'drop')).toBe(true)
    expect(importOpensDocument(null, 'folder')).toBe(true)
    expect(importOpensDocument(undefined, 'open')).toBe(true)
  })

  it('keeps an existing collage or photo and only fills Media', () => {
    const collage = { layers: [{ collageCell: {} }] }
    const photo = { layers: [{}] }
    expect(importOpensDocument(collage, 'folder')).toBe(false)
    expect(importOpensDocument(collage, 'drop')).toBe(false)
    expect(importOpensDocument(photo, 'folder')).toBe(false)
  })

  it('File → Open still replaces the canvas', () => {
    expect(importOpensDocument({ layers: [{ collageCell: {} }] }, 'open')).toBe(true)
  })
})
