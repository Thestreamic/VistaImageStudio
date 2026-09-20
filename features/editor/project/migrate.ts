import { PROJECT_SCHEMA_VERSION, type LumenProject } from './schema'
import { defaultAdjustments, normalizeAdjustments } from '../types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Brings any recognised historical shape up to schemaVersion 1. */
export function migrateProject(raw: unknown): LumenProject {
  if (!isRecord(raw)) throw new Error('Project file is not an object')
  const version = typeof raw.schemaVersion === 'number' ? raw.schemaVersion : 0
  let current: Record<string, unknown> = { ...raw }

  if (version < 1) {
    current = migrateToV1(current)
  }

  const project = current as unknown as LumenProject
  project.schemaVersion = PROJECT_SCHEMA_VERSION
  project.layers = project.layers.map((layer) => ({
    ...layer,
    adjustments: normalizeAdjustments(layer.adjustments ?? defaultAdjustments()),
    kind: layer.kind ?? (layer.textData ? 'text' : layer.watermark ? 'watermark' : 'raster'),
  }))
  return project
}

function migrateToV1(raw: Record<string, unknown>): Record<string, unknown> {
  const canvas = isRecord(raw.canvas)
    ? raw.canvas
    : { width: Number(raw.width) || 1, height: Number(raw.height) || 1 }
  return {
    kind: 'lumen-project',
    schemaVersion: 1,
    id: typeof raw.id === 'string' ? raw.id : 'migrated',
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    modifiedAt: typeof raw.modifiedAt === 'string' ? raw.modifiedAt : new Date().toISOString(),
    fileName: typeof raw.fileName === 'string' ? raw.fileName : 'Untitled.lumen',
    canvas,
    activeLayerId: typeof raw.activeLayerId === 'string' ? raw.activeLayerId : null,
    crop: raw.crop ?? null,
    lookId: raw.lookId ?? null,
    lookIntensity: typeof raw.lookIntensity === 'number' ? raw.lookIntensity : 100,
    lastExport: raw.lastExport ?? null,
    brandKit: raw.brandKit ?? { colors: ['#ff5ea6', '#7c5cff', '#4f9dff', '#14161c', '#ffffff'], font: 'Inter' },
    layers: Array.isArray(raw.layers) ? raw.layers : [],
    assets: isRecord(raw.assets) ? raw.assets : {},
  }
}

export function isFutureSchema(raw: unknown): boolean {
  return isRecord(raw) && typeof raw.schemaVersion === 'number' && raw.schemaVersion > PROJECT_SCHEMA_VERSION
}
