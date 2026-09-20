import { describe, expect, it } from 'vitest'
import {
  VISTA_CELL_MIME,
  VISTA_MEDIA_MIME,
  collageCellAtPoint,
  collageCellsInFillOrder,
  collageRearrangeKind,
  isCellDrag,
  isMediaDrag,
  isVistaInternalDrag,
  nextUnfilledCollageCell,
  setCellDragData,
  setMediaDragData,
} from '@/features/editor/media-drag'

function fakeTransfer(types: string[], data: Record<string, string> = {}): DataTransfer {
  return {
    types,
    getData: (type: string) => data[type] ?? '',
    setData: (type: string, value: string) => {
      data[type] = value
      if (!types.includes(type)) types.push(type)
    },
    effectAllowed: 'none',
  } as unknown as DataTransfer
}

describe('media drag', () => {
  it('marks a Vista media transfer so window file-import does not steal it', () => {
    const dt = fakeTransfer([])
    setMediaDragData(dt, 'imp_1')
    expect(isMediaDrag(dt)).toBe(true)
    expect(dt.getData(VISTA_MEDIA_MIME)).toBe('imp_1')
  })

  it('does not treat a normal file drop as media', () => {
    expect(isMediaDrag(fakeTransfer(['Files']))).toBe(false)
  })

  it('hits a rotated collage cell using inverse-rotated local space', () => {
    const layers = [
      {
        id: 'tilt',
        visible: true,
        x: 100,
        y: 100,
        source: { width: 100, height: 80 },
        collageCell: {},
        collageFilled: true,
        collageSlot: { shape: 'rect', rotation: 0 },
      },
    ]
    expect(collageCellAtPoint(layers, 150, 140)?.id).toBe('tilt')
    expect(collageCellAtPoint(layers, 40, 140)).toBeNull()
  })

  it('marks a collage-cell transfer separately from media and files', () => {
    const dt = fakeTransfer([])
    setCellDragData(dt, 'layer_a')
    expect(isCellDrag(dt)).toBe(true)
    expect(isMediaDrag(dt)).toBe(false)
    expect(isVistaInternalDrag(dt)).toBe(true)
    expect(dt.getData(VISTA_CELL_MIME)).toBe('layer_a')
    expect(isVistaInternalDrag(fakeTransfer(['Files']))).toBe(false)
  })

  it('swaps filled boxes and moves into an empty box, any direction', () => {
    const top = { id: 'top', collageCell: {}, collageFilled: true }
    const bottom = { id: 'bottom', collageCell: {}, collageFilled: true }
    const empty = { id: 'empty', collageCell: {}, collageFilled: false }
    expect(collageRearrangeKind(top, bottom)).toBe('swap')
    expect(collageRearrangeKind(bottom, top)).toBe('swap')
    expect(collageRearrangeKind(top, empty)).toBe('move')
    expect(collageRearrangeKind(empty, top)).toBe('invalid')
    expect(collageRearrangeKind(top, top)).toBe('noop')
  })

  it('fills the top-most empty frame first, then left-to-right', () => {
    const layers = [
      { id: 'page', visible: true, x: 0, y: 0, source: { width: 10, height: 10 } },
      { id: 'bottom-left', visible: true, x: 10, y: 400, source: { width: 80, height: 80 }, collageCell: {}, collageFilled: false },
      { id: 'hero', visible: true, x: 80, y: 200, source: { width: 200, height: 80 }, collageCell: {}, collageFilled: false },
      { id: 'bottom-right', visible: true, x: 200, y: 400, source: { width: 80, height: 80 }, collageCell: {}, collageFilled: false },
    ]
    expect(collageCellsInFillOrder(layers).map((l) => l.id)).toEqual(['hero', 'bottom-left', 'bottom-right'])
    expect(nextUnfilledCollageCell(layers)?.id).toBe('hero')
    expect(nextUnfilledCollageCell(layers.map((l) => (l.id === 'hero' ? { ...l, collageFilled: true } : l)))?.id).toBe(
      'bottom-left',
    )
  })
})
