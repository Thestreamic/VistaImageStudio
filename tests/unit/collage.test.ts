import { describe, it, expect } from 'vitest'
import { COLLAGE_TEMPLATES } from '@/features/editor/collage-templates'
import { collageFrameDeleteAction } from '@/features/editor/collage/delete-frame'
import { inverseRotateDelta, pointInCollageSlot, collageSlotOverlayBox } from '@/features/editor/collage/geometry'
import { collageLookTargetIds } from '@/features/editor/collage/look-targets'
import { templateInstancePlan } from '@/features/editor/collage/instantiate'
import {
  ALL_TEMPLATES,
  CATEGORIES,
  getTemplateById,
  getTemplatesByCategory,
} from '@/features/editor/collage/template-registry'
import {
  clampCollageFit,
  collageFitFromDrag,
  coverDrawRect,
  DEFAULT_COLLAGE_FIT,
} from '@/features/editor/engine/collage'
import { COLLAGE_FRAME_COLORS, collageFrameColor } from '@/features/editor/collage-frame'

describe('collage templates', () => {
  it('ships six Facebook-style layouts', () => {
    expect(COLLAGE_TEMPLATES.map((t) => t.id)).toEqual([
      'split-2h',
      'split-2v',
      'grid-3-classic',
      'grid-4',
      'grid-5-featured',
      'grid-6',
    ])
  })

  it('keeps cell count, photoCount, and fractions in range', () => {
    for (const template of COLLAGE_TEMPLATES) {
      expect(template.cells).toHaveLength(template.photoCount)
      for (const cell of template.cells) {
        expect(cell.x).toBeGreaterThanOrEqual(0)
        expect(cell.y).toBeGreaterThanOrEqual(0)
        expect(cell.w).toBeGreaterThan(0)
        expect(cell.h).toBeGreaterThan(0)
        expect(cell.x + cell.w).toBeLessThanOrEqual(1.001)
        expect(cell.y + cell.h).toBeLessThanOrEqual(1.001)
      }
    }
  })
})

describe('collage cover fit', () => {
  it('centres a wide photo at the default fit', () => {
    const r = coverDrawRect(200, 100, 100, 100, DEFAULT_COLLAGE_FIT)
    expect(r.dw).toBe(200)
    expect(r.dh).toBe(100)
    expect(r.dx).toBe(-50)
    expect(r.dy).toBe(0)
  })

  it('pins left when panX is 0 and right when panX is 1', () => {
    expect(coverDrawRect(200, 100, 100, 100, { scale: 1, panX: 0, panY: 0.5 }).dx).toBeCloseTo(0)
    expect(coverDrawRect(200, 100, 100, 100, { scale: 1, panX: 1, panY: 0.5 }).dx).toBeCloseTo(-100)
  })

  it('zooms from the centre when scale grows', () => {
    const r = coverDrawRect(200, 100, 100, 100, { scale: 2, panX: 0.5, panY: 0.5 })
    expect(r.dw).toBe(400)
    expect(r.dh).toBe(200)
    expect(r.dx).toBe(-150)
    expect(r.dy).toBe(-50)
  })

  it('clamps scale to 1..8 and pan to 0..1', () => {
    expect(clampCollageFit({ scale: 0.2, panX: -1, panY: 4 })).toEqual({ scale: 1, panX: 0, panY: 1 })
    expect(clampCollageFit({ scale: 99, panX: 0.5, panY: 0.5 }).scale).toBe(8)
  })

  it('pans left when dragging the photo to the right', () => {
    const next = collageFitFromDrag(DEFAULT_COLLAGE_FIT, 'move', 50, 0, 200, 100, 100, 100)
    expect(next.panX).toBeCloseTo(0)
    expect(next.panY).toBe(0.5)
  })

  it('moves X from the left/right edges and Y from the top/bottom', () => {
    expect(collageFitFromDrag(DEFAULT_COLLAGE_FIT, 'e', 50, 20, 200, 100, 100, 100).panX).toBeCloseTo(0)
    expect(collageFitFromDrag(DEFAULT_COLLAGE_FIT, 'e', 50, 20, 200, 100, 100, 100).panY).toBe(0.5)
    expect(collageFitFromDrag(DEFAULT_COLLAGE_FIT, 'n', 20, 50, 100, 200, 100, 100).panY).toBeCloseTo(0)
    expect(collageFitFromDrag(DEFAULT_COLLAGE_FIT, 'n', 20, 50, 100, 200, 100, 100).panX).toBe(0.5)
  })

  it('scales up from the south-east handle', () => {
    const next = collageFitFromDrag(DEFAULT_COLLAGE_FIT, 'se', 50, 50, 200, 100, 100, 100)
    expect(next.scale).toBe(2)
  })

  it('does not scale below cover', () => {
    const next = collageFitFromDrag(DEFAULT_COLLAGE_FIT, 'se', -80, -80, 200, 100, 100, 100)
    expect(next.scale).toBe(1)
  })
})

describe('collage frame colours', () => {
  it('cycles a Canva-style palette per box', () => {
    expect(collageFrameColor(0).stroke).toBe(COLLAGE_FRAME_COLORS[0].stroke)
    expect(collageFrameColor(6).stroke).toBe(COLLAGE_FRAME_COLORS[0].stroke)
    expect(new Set(COLLAGE_FRAME_COLORS.map((c) => c.stroke)).size).toBe(6)
  })
})

describe('occasion registry', () => {
  it('keeps the original six layout ids and one template per occasion chip', () => {
    expect(COLLAGE_TEMPLATES.map((t) => t.id)).toEqual([
      'split-2h',
      'split-2v',
      'grid-3-classic',
      'grid-4',
      'grid-5-featured',
      'grid-6',
    ])
    expect(CATEGORIES.map((c) => c.id)).toEqual([
      'layouts',
      'family',
      'birthday',
      'anniversary',
      'wedding',
      'raksha-bandhan',
      'best-wishes',
    ])
    expect(getTemplatesByCategory('birthday').map((t) => t.id)).toEqual(['birthday-hero-3'])
    expect(getTemplateById('family-polaroid-6')?.slots).toHaveLength(6)
    expect(ALL_TEMPLATES).toHaveLength(12)
  })

  it('instantiates occasion JSON as slots plus a title layer', () => {
    const birthday = getTemplateById('birthday-hero-3')!
    const plan = templateInstancePlan(birthday)
    expect(plan.width).toBe(1080)
    expect(plan.height).toBe(1080)
    expect(plan.slotCount).toBe(3)
    expect(plan.textCount).toBe(1)
    expect(plan.slots[0].collageSlot.shape).toBe('rounded')
    expect(plan.decorations.some((d) => d.content === 'Happy Birthday')).toBe(true)

    const family = templateInstancePlan(getTemplateById('family-polaroid-6')!)
    expect(family.height).toBe(1350)
    expect(family.slotCount).toBe(6)
    expect(family.slots.every((slot) => slot.collageSlot.shape === 'polaroid')).toBe(true)
  })
})

describe('collage delete frame', () => {
  it('clears a filled photo and removes an empty slot', () => {
    expect(collageFrameDeleteAction({ collageCell: {}, collageFilled: true })).toBe('clear')
    expect(collageFrameDeleteAction({ collageCell: {}, collageFilled: false })).toBe('remove')
    expect(collageFrameDeleteAction({ collageMat: true, collageCell: {} })).toBe('ignore')
    expect(collageFrameDeleteAction({ collageFilled: true })).toBe('ignore')
  })
})

describe('collage slot hit-test', () => {
  it('inverse-rotates the pointer around the slot centre', () => {
    const rotated = inverseRotateDelta(10, 0, 90)
    expect(rotated.dx).toBeCloseTo(0)
    expect(rotated.dy).toBeCloseTo(-10)

    const layer = {
      x: 100,
      y: 100,
      source: { width: 100, height: 80 },
      collageSlot: { shape: 'rect' as const, rotation: 0 },
    }
    expect(pointInCollageSlot(layer, 150, 140)).toBe(true)
    expect(pointInCollageSlot(layer, 40, 140)).toBe(false)

    const tilted = { ...layer, collageSlot: { shape: 'rect' as const, rotation: 45 } }
    expect(pointInCollageSlot(tilted, 150, 140)).toBe(true)

    const circle = { ...layer, collageSlot: { shape: 'circle' as const } }
    expect(pointInCollageSlot(circle, 150, 140)).toBe(true)
    expect(pointInCollageSlot(circle, 100, 100)).toBe(false)
  })

  it('uses the slot rect even if the bitmap is a full-canvas leftover', () => {
    const layer = {
      x: 86,
      y: 216,
      source: { width: 1080, height: 1080 },
      collageCell: { width: 907, height: 497 },
      collageSlot: { shape: 'rounded' as const },
    }
    expect(pointInCollageSlot(layer, 200, 300)).toBe(true)
    expect(pointInCollageSlot(layer, 540, 40)).toBe(false)
    const box = collageSlotOverlayBox(layer, 1)
    expect(box.left).toBe(86)
    expect(box.top).toBe(216)
    expect(box.width).toBe(907)
    expect(box.height).toBe(497)
  })
})

describe('collage look targets', () => {
  it('grades filled frames only so empty placeholders keep their position', () => {
    expect(
      collageLookTargetIds([
        { id: 'page' },
        { id: 'hero', collageCell: {}, collageFilled: false },
        { id: 'a', collageCell: {}, collageFilled: true },
        { id: 'hidden', collageCell: {}, collageFilled: true, visible: false },
      ]),
    ).toEqual(['a'])
  })
})

