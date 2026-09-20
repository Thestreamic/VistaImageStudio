import { describe, expect, it } from 'vitest'
import { selectPhotoLayer } from '@/features/editor/store/editor-store'

function state(activeLayerId: string, layers: Array<Record<string, unknown>>) {
  return { doc: { activeLayerId, layers } } as never
}

describe('selectPhotoLayer', () => {
  it('uses the selected filled collage photo, not an empty neighbour', () => {
    const layers = [
      { id: 'empty', collageCell: {}, collageFilled: false, visible: true },
      { id: 'hero', collageCell: {}, collageFilled: true, visible: true },
      { id: 'side', collageCell: {}, collageFilled: true, visible: true },
    ]
    expect(selectPhotoLayer(state('side', layers))?.id).toBe('side')
    expect(selectPhotoLayer(state('hero', layers))?.id).toBe('hero')
  })

  it('skips an empty selected placeholder so Adjust still targets a filled frame', () => {
    const layers = [
      { id: 'empty', collageCell: {}, collageFilled: false, visible: true },
      { id: 'hero', collageCell: {}, collageFilled: true, visible: true },
    ]
    expect(selectPhotoLayer(state('empty', layers))?.id).toBe('hero')
  })
})
