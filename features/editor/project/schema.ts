import type {
  Adjustments,
  BlendMode,
  CollageFit,
  CropRect,
  LastExport,
  LayerKind,
  TextLayerData,
  WatermarkData,
} from '../types'

export const PROJECT_SCHEMA_VERSION = 1
export const PROJECT_EXTENSION = '.lumen'
export const PROJECT_MIME = 'application/x-lumen-project+json'
export const AUTOSAVE_MAX_BYTES = 12 * 1024 * 1024

export interface ProjectAsset {
  id: string
  mime: 'image/png' | 'image/jpeg'
  /** PNG/JPEG data URL only — never http(s), never javascript:. */
  dataUrl: string
}

export interface ProjectLayer {
  id: string
  name: string
  visible: boolean
  locked: boolean
  opacity: number
  blendMode: BlendMode
  kind: LayerKind
  x: number
  y: number
  adjustments: Adjustments
  assetId: string
  textData?: TextLayerData
  collageCell?: { width: number; height: number }
  collageFilled?: boolean
  collageFit?: CollageFit
  collageMat?: boolean
  collageSlot?: { shape: 'rect' | 'rounded' | 'circle' | 'polaroid'; rotation?: number }
  watermark?: WatermarkData
}

export interface ProjectBrandKit {
  colors: string[]
  font: string
}

export interface LumenProject {
  kind: 'lumen-project'
  schemaVersion: number
  id: string
  createdAt: string
  modifiedAt: string
  fileName: string
  canvas: { width: number; height: number }
  activeLayerId: string | null
  crop: CropRect | null
  lookId: string | null
  lookIntensity: number
  lastExport: LastExport | null
  brandKit: ProjectBrandKit
  layers: ProjectLayer[]
  assets: Record<string, ProjectAsset>
}

export interface ProjectLoadWarning {
  code: 'future-version' | 'migrated' | 'read-only'
  message: string
}
