import { uid } from '@/lib/image/canvas'
import { canvasFromBlob, createCanvas, ctx2d } from '@/lib/image/canvas'
import type { BrandKit, DocumentState, Layer } from '../types'
import { defaultAdjustments, defaultWatermark, normalizeAdjustments } from '../types'
import { migrateProject } from './migrate'
import {
  AUTOSAVE_MAX_BYTES,
  PROJECT_SCHEMA_VERSION,
  type LumenProject,
  type ProjectAsset,
  type ProjectLayer,
} from './schema'
import { assertCurrentProject, assertSafeProjectShape, inspectProjectVersion, parseProjectJson } from './validate'

export interface SerializeOptions {
  brandKit: BrandKit
}

export interface DeserializeResult {
  doc: DocumentState
  brandKit: BrandKit
  readOnly: boolean
  warning?: string
}

function canvasToPngDataUrl(canvas: HTMLCanvasElement): string {
  return canvas.toDataURL('image/png')
}

function layerToProject(layer: Layer, assets: Record<string, ProjectAsset>): ProjectLayer {
  const assetId = uid('asset')
  assets[assetId] = {
    id: assetId,
    mime: 'image/png',
    dataUrl: canvasToPngDataUrl(layer.source),
  }
  return {
    id: layer.id,
    name: layer.name,
    visible: layer.visible,
    locked: layer.locked,
    opacity: layer.opacity,
    blendMode: layer.blendMode,
    kind: layer.kind ?? (layer.textData ? 'text' : layer.watermark ? 'watermark' : 'raster'),
    x: layer.x,
    y: layer.y,
    adjustments: normalizeAdjustments(layer.adjustments),
    assetId,
    textData: layer.textData,
    collageCell: layer.collageCell,
    collageFilled: layer.collageFilled,
    collageFit: layer.collageFit,
    collageMat: layer.collageMat,
    collageSlot: layer.collageSlot,
    watermark: layer.watermark,
  }
}

export function serializeProject(doc: DocumentState, opts: SerializeOptions): LumenProject {
  const assets: Record<string, ProjectAsset> = {}
  const layers = doc.layers.map((layer) => layerToProject(layer, assets))
  return {
    kind: 'lumen-project',
    schemaVersion: PROJECT_SCHEMA_VERSION,
    id: doc.id,
    createdAt: doc.createdAt,
    modifiedAt: new Date().toISOString(),
    fileName: doc.fileName,
    canvas: { width: doc.width, height: doc.height },
    activeLayerId: doc.activeLayerId,
    crop: doc.crop,
    lookId: doc.lookId,
    lookIntensity: doc.lookIntensity,
    lastExport: doc.lastExport,
    brandKit: { colors: [...opts.brandKit.colors], font: opts.brandKit.font },
    layers,
    assets,
  }
}

export function stringifyProject(project: LumenProject): string {
  return JSON.stringify(project)
}

export function projectFitsAutosave(json: string): boolean {
  return json.length <= AUTOSAVE_MAX_BYTES
}

async function canvasFromAsset(asset: ProjectAsset): Promise<HTMLCanvasElement> {
  const res = await fetch(asset.dataUrl)
  const blob = await res.blob()
  return canvasFromBlob(blob, `${asset.id}.png`)
}

function placeholderCanvas(): HTMLCanvasElement {
  const c = createCanvas(8, 8)
  const ctx = ctx2d(c)
  ctx.fillStyle = '#222'
  ctx.fillRect(0, 0, 8, 8)
  return c
}

export async function deserializeProject(text: string, projectPath: string | null): Promise<DeserializeResult> {
  const raw = parseProjectJson(text)
  assertSafeProjectShape(raw)
  const version = inspectProjectVersion(raw)
  const project = migrateProject(raw)
  assertCurrentProject(project)

  const layers: Layer[] = []
  for (const layer of project.layers) {
    const asset = project.assets[layer.assetId]
    let source: HTMLCanvasElement
    try {
      source = asset ? await canvasFromAsset(asset) : placeholderCanvas()
    } catch {
      source = placeholderCanvas()
    }
    layers.push({
      id: layer.id,
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity,
      blendMode: layer.blendMode,
      kind: layer.kind,
      source,
      x: layer.x,
      y: layer.y,
      adjustments: normalizeAdjustments(layer.adjustments ?? defaultAdjustments()),
      textData: layer.textData,
      collageCell: layer.collageCell,
      collageFilled: layer.collageFilled,
      collageFit: layer.collageFit,
      collageMat: layer.collageMat,
      collageSlot: layer.collageSlot,
      watermark: layer.watermark ? { ...defaultWatermark(), ...layer.watermark } : undefined,
    })
  }

  const doc: DocumentState = {
    id: project.id,
    createdAt: project.createdAt,
    modifiedAt: project.modifiedAt,
    width: project.canvas.width,
    height: project.canvas.height,
    layers,
    activeLayerId: project.activeLayerId ?? layers[0]?.id ?? null,
    selection: null,
    fileName: project.fileName,
    projectPath,
    crop: project.crop,
    lookId: project.lookId,
    lookIntensity: project.lookIntensity ?? 100,
    lastExport: project.lastExport,
  }

  return {
    doc,
    brandKit: project.brandKit,
    readOnly: version.readOnly,
    warning: version.future
      ? 'This project was saved in a newer Vista Image Studio. You can export, but saving may lose newer fields.'
      : undefined,
  }
}

export function suggestedProjectName(fileName: string): string {
  const base = fileName.replace(/\.[^.]+$/, '') || 'Untitled'
  return `${base}.lumen`
}
