import { describe, expect, it } from 'vitest'
import { clampZoom, computeFitViewport, displayPreviewScale, clientToDocument } from '@/features/editor/viewport'

describe('viewport fit', () => {
  it('centers with pan 0 so CSS flex-center is not double-applied', () => {
    const fit = computeFitViewport(800, 600, 4032, 3024)
    expect(fit).not.toBeNull()
    expect(fit!.panX).toBe(0)
    expect(fit!.panY).toBe(0)
    expect(fit!.zoom).toBeLessThan(1)
    expect(4032 * fit!.zoom).toBeLessThanOrEqual(800)
    expect(3024 * fit!.zoom).toBeLessThanOrEqual(600)
    // Fill the stage, not a 40px grey frame on every edge.
    expect(Math.min(800 - 4032 * fit!.zoom, 600 - 3024 * fit!.zoom)).toBeLessThanOrEqual(8)
  })

  it('ignores a collapsed stage', () => {
    expect(computeFitViewport(0, 600, 1000, 1000)).toBeNull()
  })

  it('caps iPhone preview scale under 1600px', () => {
    expect(displayPreviewScale(4032, 3024)).toBeCloseTo(1600 / 4032)
    expect(displayPreviewScale(800, 600)).toBe(1)
  })

  it('clamps zoom', () => {
    expect(clampZoom(0)).toBe(0.05)
    expect(clampZoom(99)).toBe(32)
  })

  it('maps the stage center to the document center', () => {
    const pt = clientToDocument(500, 500, { left: 0, top: 0, width: 1000, height: 1000 }, 1000, 1000, {
      zoom: 1,
      panX: 0,
      panY: 0,
    })
    expect(pt.x).toBeCloseTo(500)
    expect(pt.y).toBeCloseTo(500)
  })
})
