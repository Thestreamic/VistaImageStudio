export type ToolId =
  | 'move'
  | 'crop'
  | 'select-rect'
  | 'select-wand'
  | 'hand'

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten'
  | 'soft-light'
  | 'difference'
  | 'luminosity'

export type CurveChannel = 'rgb' | 'r' | 'g' | 'b'

/** A curve is a list of control points in 0..255 space, sorted by x. */
export type CurvePoint = { x: number; y: number }
export type Curves = Record<CurveChannel, CurvePoint[]>

export interface Adjustments {
  brightness: number // -100..100
  contrast: number // -100..100
  saturation: number // -100..100
  exposure: number // -2..2 (EV)
  temperature: number // -100..100
  tint: number // -100..100 green/magenta
  highlights: number // -100..100
  shadows: number // -100..100
  whites: number // -100..100
  blacks: number // -100..100
  vibrance: number // -100..100
  sharpness: number // -100..100
  curves: Curves
}

export type FontWeight = 400 | 500 | 600 | 700 | 800
export type TextAlign = 'left' | 'center' | 'right'

export interface TextLayerData {
  content: string
  fontFamily: string
  fontSize: number
  fontWeight: FontWeight
  color: string
  align: TextAlign
  letterSpacing: number
  lineHeight: number
  /** Optional translucent backing plate behind the text (Canva-style "highlight"). */
  backgroundColor: string | null
  /** Optional outline stroke around each glyph. */
  strokeColor: string | null
  strokeWidth: number
  uppercase: boolean
}

export type WatermarkCorner = 'tl' | 'tr' | 'bl' | 'br' | 'center'
export type LayerKind = 'raster' | 'text' | 'watermark'

/** How a photo sits inside a collage frame. `scale` 1 = cover; pan 0..1. */
export interface CollageFit {
  scale: number
  panX: number
  panY: number
}

export interface WatermarkData {
  kind: 'text' | 'logo'
  text: string
  corner: WatermarkCorner
  opacity: number
  scale: number
  rotation: number
  margin: number
}

export interface LastExport {
  presetIds: string[]
  format: 'jpeg' | 'png' | 'webp'
  quality: number
  fileNameTemplate: string
  fitMode: 'fill' | 'fit'
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number // 0..1
  blendMode: BlendMode
  kind?: LayerKind
  /** Pixel source in document space. For text layers this is regenerated
   *  from `textData` any time it changes — the canvas is always the single
   *  source of truth the compositor reads from. */
  source: HTMLCanvasElement
  /** Offset of the source inside the document. */
  x: number
  y: number
  adjustments: Adjustments
  /** Present only for text layers; drives re-rendering of `source`. */
  textData?: TextLayerData
  /** Present only for collage placeholder cells — the exact pixel size the
   *  assigned photo must be cover-cropped to when filled. */
  collageCell?: { width: number; height: number }
  /** True once a real photo has replaced a collage placeholder. */
  collageFilled?: boolean
  /** Uncropped photo used to re-cover-crop when this cell is moved onto a different box. */
  collageOriginal?: HTMLCanvasElement
  /** Pan/zoom of the photo inside this collage frame. */
  collageFit?: CollageFit
  /** Locked full-canvas mat behind collage cells so gutters export as a colourful page. */
  collageMat?: boolean
  /** Shape / tilt for occasion templates (polaroid, circle, scrapbook rotate). */
  collageSlot?: { shape: 'rect' | 'rounded' | 'circle' | 'polaroid'; rotation?: number }
  /** Present for watermark overlay layers (logo PNG/JPEG or generated text). */
  watermark?: WatermarkData
}

export const FONT_FAMILIES = [
  'Inter',
  'IBM Plex Sans',
  'Georgia',
  'Poppins',
  'Montserrat',
  'Playfair Display',
  'Courier New',
] as const

export function defaultTextData(overrides?: Partial<TextLayerData>): TextLayerData {
  return {
    content: 'Add your title',
    fontFamily: 'Inter',
    fontSize: 64,
    fontWeight: 700,
    color: '#ffffff',
    align: 'center',
    letterSpacing: 0,
    lineHeight: 1.15,
    backgroundColor: null,
    strokeColor: null,
    strokeWidth: 0,
    uppercase: false,
    ...overrides,
  }
}

export function defaultWatermark(overrides?: Partial<WatermarkData>): WatermarkData {
  return {
    kind: 'text',
    text: '@studio',
    corner: 'br',
    opacity: 0.85,
    scale: 0.18,
    rotation: 0,
    margin: 24,
    ...overrides,
  }
}

export interface Selection {
  width: number
  height: number
  /** 0..255 coverage per document pixel. */
  mask: Uint8ClampedArray
}

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface DocumentState {
  id: string
  createdAt: string
  modifiedAt: string
  width: number
  height: number
  layers: Layer[]
  activeLayerId: string | null
  selection: Selection | null
  fileName: string
  /** On-disk `.lumen` path when saved from Electron; null in the browser until Save As. */
  projectPath: string | null
  /** Live non-destructive crop. Null means the full canvas is the output. */
  crop: CropRect | null
  lookId: string | null
  lookIntensity: number
  lastExport: LastExport | null
}

export interface Viewport {
  zoom: number
  panX: number
  panY: number
}

export interface BrandKit {
  colors: string[]
  font: string
}

export const DEFAULT_BRAND_KIT: BrandKit = {
  colors: ['#ff5ea6', '#7c5cff', '#4f9dff', '#14161c', '#ffffff'],
  font: 'Inter',
}

export const DEFAULT_CURVES: Curves = {
  rgb: [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ],
  r: [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ],
  g: [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ],
  b: [
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ],
}

export function defaultAdjustments(): Adjustments {
  return {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    exposure: 0,
    temperature: 0,
    tint: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    vibrance: 0,
    sharpness: 0,
    curves: structuredClone(DEFAULT_CURVES),
  }
}

const TONE_KEYS: Array<keyof Omit<Adjustments, 'curves'>> = [
  'brightness',
  'contrast',
  'saturation',
  'exposure',
  'temperature',
  'tint',
  'highlights',
  'shadows',
  'whites',
  'blacks',
  'vibrance',
  'sharpness',
]

export function normalizeAdjustments(input?: Partial<Adjustments> | null): Adjustments {
  const base = defaultAdjustments()
  if (!input) return base
  return {
    ...base,
    ...input,
    curves: input.curves ? structuredClone(input.curves) : structuredClone(DEFAULT_CURVES),
  }
}

export function isIdentityAdjustments(a: Adjustments): boolean {
  for (const key of TONE_KEYS) {
    if (a[key] !== 0) return false
  }
  return (Object.keys(a.curves) as CurveChannel[]).every((ch) => {
    const pts = a.curves[ch]
    return (
      pts.length === 2 &&
      pts[0].x === 0 &&
      pts[0].y === 0 &&
      pts[1].x === 255 &&
      pts[1].y === 255
    )
  })
}

export function outputSize(doc: Pick<DocumentState, 'width' | 'height' | 'crop'>): {
  width: number
  height: number
} {
  if (doc.crop) return { width: Math.round(doc.crop.width), height: Math.round(doc.crop.height) }
  return { width: doc.width, height: doc.height }
}
