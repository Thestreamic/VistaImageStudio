export interface FitViewport {
  zoom: number
  panX: number
  panY: number
}

/**
 * Fit the document into the stage. Pan stays 0 because the stage already
 * CSS-centers the canvas — extra pan was offsetting iPhone photos off-frame.
 */
export function computeFitViewport(
  stageW: number,
  stageH: number,
  docW: number,
  docH: number,
): FitViewport | null {
  if (stageW < 32 || stageH < 32 || docW < 1 || docH < 1) return null
  // Hairline only — a 40px pad on both axes boxed 4:3 snaps inside grey on all four sides.
  const pad = 8
  const zoom = Math.min((stageW - pad) / docW, (stageH - pad) / docH, 8)
  return { zoom: Math.max(0.05, zoom), panX: 0, panY: 0 }
}

export function clampZoom(zoom: number): number {
  return Math.min(32, Math.max(0.05, zoom))
}

/** Map a pointer on the centered, panned stage to document pixels. */
export function clientToDocument(
  clientX: number,
  clientY: number,
  stage: { left: number; top: number; width: number; height: number },
  docW: number,
  docH: number,
  viewport: { zoom: number; panX: number; panY: number },
): { x: number; y: number } {
  const centerX = stage.left + stage.width / 2 + viewport.panX
  const centerY = stage.top + stage.height / 2 + viewport.panY
  const left = centerX - (docW * viewport.zoom) / 2
  const top = centerY - (docH * viewport.zoom) / 2
  return {
    x: (clientX - left) / viewport.zoom,
    y: (clientY - top) / viewport.zoom,
  }
}

/** Long-edge cap so a 12MP iPhone snap is previewed near 1600px, not full sensor. */
export function displayPreviewScale(docW: number, docH: number, maxEdge = 1600): number {
  const edge = Math.max(docW, docH)
  if (edge <= maxEdge) return 1
  return maxEdge / edge
}
