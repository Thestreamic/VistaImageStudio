import { PROJECT_SCHEMA_VERSION, type LumenProject, type ProjectAsset } from './schema'
import { isFutureSchema } from './migrate'

const DATA_URL = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=\s]+$/
const BAD_URL = /^(https?:|javascript:|file:|data:text)/i

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export class ProjectValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ProjectValidationError'
  }
}

function assertAsset(id: string, asset: unknown): asserts asset is ProjectAsset {
  if (!isRecord(asset)) throw new ProjectValidationError(`Asset ${id} is invalid`)
  if (asset.id !== id) throw new ProjectValidationError(`Asset ${id} id mismatch`)
  if (asset.mime !== 'image/png' && asset.mime !== 'image/jpeg') {
    throw new ProjectValidationError(`Asset ${id} has unsupported mime`)
  }
  if (typeof asset.dataUrl !== 'string') throw new ProjectValidationError(`Asset ${id} is missing data`)
  if (BAD_URL.test(asset.dataUrl) && !asset.dataUrl.startsWith('data:image/')) {
    throw new ProjectValidationError(`Asset ${id} uses a forbidden URL`)
  }
  if (!DATA_URL.test(asset.dataUrl.replace(/\s/g, ''))) {
    throw new ProjectValidationError(`Asset ${id} is not an embedded PNG/JPEG`)
  }
  if (asset.dataUrl.includes('..') || asset.dataUrl.includes('\\')) {
    throw new ProjectValidationError(`Asset ${id} path is not allowed`)
  }
}

export function parseProjectJson(text: string): unknown {
  if (text.length > 32 * 1024 * 1024) throw new ProjectValidationError('Project file is too large')
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new ProjectValidationError('Project file is not valid JSON')
  }
}

export function assertSafeProjectShape(raw: unknown): void {
  if (!isRecord(raw)) throw new ProjectValidationError('Project file is not an object')
  if (raw.kind !== 'lumen-project' && raw.schemaVersion == null) {
    throw new ProjectValidationError('Not a Vista Image Studio project file')
  }
  if (typeof raw.schemaVersion === 'number' && raw.schemaVersion < 0) {
    throw new ProjectValidationError('Invalid schema version')
  }
  const assets = isRecord(raw.assets) ? raw.assets : {}
  for (const [id, asset] of Object.entries(assets)) assertAsset(id, asset)
  if (Array.isArray(raw.layers)) {
    for (const layer of raw.layers) {
      if (!isRecord(layer)) throw new ProjectValidationError('Layer is invalid')
      if (typeof layer.assetId !== 'string') throw new ProjectValidationError('Layer is missing pixels')
      if (!(layer.assetId in assets)) throw new ProjectValidationError('Layer references a missing asset')
    }
  }
}

export function inspectProjectVersion(raw: unknown): {
  future: boolean
  readOnly: boolean
  schemaVersion: number
} {
  if (!isRecord(raw) || typeof raw.schemaVersion !== 'number') {
    return { future: false, readOnly: false, schemaVersion: 0 }
  }
  const future = isFutureSchema(raw)
  return {
    future,
    readOnly: future,
    schemaVersion: raw.schemaVersion,
  }
}

export function assertCurrentProject(project: LumenProject): void {
  if (project.kind !== 'lumen-project') throw new ProjectValidationError('Not a Vista Image Studio project file')
  if (project.schemaVersion !== PROJECT_SCHEMA_VERSION) {
    throw new ProjectValidationError(`Unexpected schema version ${project.schemaVersion}`)
  }
  if (!project.canvas?.width || !project.canvas?.height) {
    throw new ProjectValidationError('Project canvas size is missing')
  }
  if (!Array.isArray(project.layers) || project.layers.length === 0) {
    throw new ProjectValidationError('Project has no layers')
  }
}
