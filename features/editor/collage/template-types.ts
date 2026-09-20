export type CollageSlotShape = 'rect' | 'rounded' | 'circle' | 'polaroid'
export type CollageAspectRatio = 'square' | 'portrait' | 'landscape'
export type CollageBackgroundPattern = 'none' | 'speckle' | 'linen'
export type CollageDecorKind = 'text' | 'sticker' | 'shape' | 'border'
export type CollageShapeKind = 'heart' | 'dot' | 'sprig' | 'tape' | 'flower'

export interface PhotoSlot {
  id: string
  x: number
  y: number
  width: number
  height: number
  rotation?: number
  shape: CollageSlotShape
  zIndex: number
}

export interface DecorElement {
  type: CollageDecorKind
  x: number
  y: number
  width?: number
  height?: number
  content?: string
  fontFamily?: string
  fontSize?: number
  fontWeight?: 400 | 500 | 600 | 700 | 800
  color?: string
  /** Procedural sticker/shape id (heart, dot, sprig, tape, flower). */
  shape?: CollageShapeKind
  zIndex: number
}

export interface CollageTemplate {
  id: string
  name: string
  category: string[]
  aspectRatio: CollageAspectRatio
  canvasWidth: number
  canvasHeight: number
  backgroundColor: string
  backgroundPattern?: CollageBackgroundPattern
  slots: PhotoSlot[]
  decorations: DecorElement[]
}
