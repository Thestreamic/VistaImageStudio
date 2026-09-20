export type CollageDeleteLayer = {
  collageCell?: unknown
  collageFilled?: boolean
  collageMat?: boolean
}

export type CollageFrameDeleteAction = 'clear' | 'remove' | 'ignore'

/** Filled frame → clear photo; empty frame → remove the slot; never the page mat. */
export function collageFrameDeleteAction(layer: CollageDeleteLayer | null | undefined): CollageFrameDeleteAction {
  if (!layer?.collageCell || layer.collageMat) return 'ignore'
  return layer.collageFilled ? 'clear' : 'remove'
}
