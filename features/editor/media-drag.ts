import { pointInCollageSlot } from './collage/geometry'

export const VISTA_MEDIA_MIME = 'application/x-vista-media'
export const VISTA_CELL_MIME = 'application/x-vista-collage-cell'

export function isMediaDrag(transfer: DataTransfer | null | undefined): boolean {
  if (!transfer) return false
  return Array.from(transfer.types ?? []).includes(VISTA_MEDIA_MIME)
}

export function isCellDrag(transfer: DataTransfer | null | undefined): boolean {
  if (!transfer) return false
  return Array.from(transfer.types ?? []).includes(VISTA_CELL_MIME)
}

export function isVistaInternalDrag(transfer: DataTransfer | null | undefined): boolean {
  return isMediaDrag(transfer) || isCellDrag(transfer)
}

export function mediaIdFromTransfer(transfer: DataTransfer | null | undefined): string | null {
  if (!transfer) return null
  const id = transfer.getData(VISTA_MEDIA_MIME)
  return id || null
}

export function cellIdFromTransfer(transfer: DataTransfer | null | undefined): string | null {
  if (!transfer) return null
  const id = transfer.getData(VISTA_CELL_MIME)
  return id || null
}

export function setMediaDragData(transfer: DataTransfer, id: string) {
  transfer.setData(VISTA_MEDIA_MIME, id)
  transfer.effectAllowed = 'copy'
}

export function setCellDragData(transfer: DataTransfer, layerId: string) {
  transfer.setData(VISTA_CELL_MIME, layerId)
  transfer.effectAllowed = 'move'
}

export type CollageRearrangeKind = 'invalid' | 'noop' | 'move' | 'swap'

export function collageRearrangeKind(
  from: { id: string; collageCell?: unknown; collageFilled?: boolean } | null | undefined,
  to: { id: string; collageCell?: unknown; collageFilled?: boolean } | null | undefined,
): CollageRearrangeKind {
  if (!from?.collageCell || !to?.collageCell) return 'invalid'
  if (from.id === to.id) return 'noop'
  if (!from.collageFilled) return 'invalid'
  return to.collageFilled ? 'swap' : 'move'
}

export type HitLayer = {
  id: string
  visible: boolean
  x: number
  y: number
  source: { width: number; height: number }
  collageCell?: { width?: number; height?: number }
  collageFilled?: boolean
  collageSlot?: { shape?: string; rotation?: number }
}

/** Topmost visible collage cell under a document-space point. */
export function collageCellAtPoint<T extends HitLayer>(layers: T[], x: number, y: number): T | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i]
    if (!layer.collageCell || !layer.visible) continue
    if (pointInCollageSlot(layer, x, y)) return layer
  }
  return null
}

/** Photo slots in reading order: top-to-bottom, then left-to-right. */
export function collageCellsInFillOrder<T extends HitLayer>(layers: T[]): T[] {
  return layers
    .filter((layer) => layer.collageCell)
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
}

export function nextUnfilledCollageCell<T extends HitLayer>(layers: T[]): T | null {
  return collageCellsInFillOrder(layers).find((layer) => !layer.collageFilled) ?? null
}
