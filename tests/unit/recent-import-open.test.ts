import { describe, expect, it } from 'vitest'
import { canvasFromRecentImport, canvasToOpenFromImport } from '@/lib/image/canvas'

function workingCanvas(width = 8, height = 8): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

describe('opening a photo already in Media', () => {
  it('uses the cached working canvas when the original file blob is gone', async () => {
    const working = workingCanvas()
    const opened = await canvasFromRecentImport({
      name: 'kept.png',
      blob: new Blob(),
      workingCanvas: working,
    })
    expect(opened).toBe(working)
  })

  it('keeps the Media canvas identity until open clones it for the editor', async () => {
    const working = workingCanvas()
    const fromBin = await canvasFromRecentImport({
      name: 'kept.png',
      blob: new Blob(),
      workingCanvas: working,
    })
    expect(fromBin).toBe(working)
    expect(typeof canvasToOpenFromImport).toBe('function')
  })

  it('fails clearly when neither pixels nor a file remain', async () => {
    await expect(
      canvasFromRecentImport({ name: 'gone.png', blob: new Blob() }),
    ).rejects.toThrow(/no longer available/i)
  })
})
