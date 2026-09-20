'use client'

import { create } from 'zustand'
import { cloneCanvas, createCanvas, ctx2d, uid, workingCanvasFromSource } from '@/lib/image/canvas'
import type {
  Adjustments,
  BlendMode,
  BrandKit,
  CollageFit,
  CropRect,
  DocumentState,
  LastExport,
  Layer,
  Selection,
  TextLayerData,
  ToolId,
  Viewport,
  WatermarkData,
} from '../types'
import { DEFAULT_BRAND_KIT, defaultAdjustments, defaultWatermark } from '../types'
import { renderTextLayer } from '../engine/text-render'
import { renderWatermarkText } from '../engine/watermark-render'
import { clampCollageFit, coverCropToSize, DEFAULT_COLLAGE_FIT, flipCanvas, renderCollagePlaceholder, rotateCanvas90 } from '../engine/collage'
import { collageFrameDeleteAction } from '../collage/delete-frame'
import { instantiateTemplate } from '../collage/instantiate'
import { collageLookTargetIds } from '../collage/look-targets'
import { getTemplateById } from '../collage/template-registry'
import { collageCellAtPoint, collageRearrangeKind, nextUnfilledCollageCell } from '../media-drag'
import {
  cropDocument,
  flipDocument,
  resizeDocument,
  rotateDocument90,
  rotateLayer,
} from '../engine/transforms'
import { combineSelections, invertSelection } from '../engine/selection'
import { compositor } from '../engine/compositor'
import { adjustmentsFromLook } from '../looks'
import { CAMERA_PROFILES } from '../camera-profiles'
import { FILTER_PRESETS } from '../filter-presets'
import { cropRectForPreset } from '../crop-presets'
import { clampZoom, computeFitViewport } from '../viewport'
import { deleteMediaItems, loadMediaLibrary, putMediaItem } from '@/lib/platform/media-library'

const HISTORY_LIMIT = 30
export const RECENT_IMPORTS_CAP = 200

export interface RecentImport {
  id: string
  name: string
  thumbnailDataUrl: string
  blob: Blob
  /** Decoded, size-capped canvas so collage drops skip a second JPEG/HEIC decode. */
  workingCanvas?: HTMLCanvasElement
}

export interface AiJob {
  id: string
  label: string
  progress: number // 0..1, -1 = indeterminate
  detail?: string
}

export interface StatusMessage {
  id: string
  kind: 'info' | 'success' | 'error'
  text: string
}

/** A small set of reusable brand colors + a default font, so a creator's
 *  text overlays stay visually consistent across a batch of posts without
 *  re-picking the same color every time. */
export type { BrandKit }

export type TextSession = {
  layerId: string
  isNew: boolean
  baseline: { textData: TextLayerData; x: number; y: number }
}

interface EditorState {
  doc: DocumentState | null
  tool: ToolId
  viewport: Viewport
  past: DocumentState[]
  future: DocumentState[]
  transactionSnapshot: DocumentState | null
  cropDraft: CropRect | null
  wandTolerance: number
  selectionMode: 'replace' | 'add' | 'subtract'
  aiJob: AiJob | null
  status: StatusMessage | null
  /** Incremented whenever pixels may have changed; the stage subscribes to it. */
  renderVersion: number
  brandKit: BrandKit
  theme: 'dark' | 'light'
  compareMode: boolean
  /** How many undo-steps back the "before" pane in compare view looks; 0 = the original as-imported state. */
  compareStepsBack: number
  dirty: boolean
  readOnly: boolean
  holdPreview: boolean
  textSession: TextSession | null
  recentImports: RecentImport[]
  activeImportId: string | null

  // document lifecycle
  openImage: (source: HTMLCanvasElement, fileName: string) => void
  newDocument: (width: number, height: number) => void
  closeDocument: () => void
  loadProjectDocument: (doc: DocumentState, brandKit: BrandKit, opts?: { dirty?: boolean; readOnly?: boolean }) => void
  markSaved: (projectPath: string | null) => void
  commit: (next: DocumentState, label?: string) => void
  beginTransaction: () => void
  endTransaction: () => void
  undo: () => void
  redo: () => void

  // tools & view
  setTool: (tool: ToolId) => void
  setViewport: (v: Partial<Viewport>) => void
  fitToScreen: (stageW: number, stageH: number) => void
  zoomBy: (factor: number) => void
  setCropDraft: (rect: CropRect | null) => void
  setLiveCrop: (rect: CropRect | null) => void
  bakeCrop: () => void
  applyLook: (lookId: string | null, intensity: number, commit?: boolean) => boolean
  addWatermarkLayer: (data: Partial<WatermarkData> & { source?: HTMLCanvasElement }) => void
  updateWatermark: (id: string, patch: Partial<WatermarkData>, source?: HTMLCanvasElement, commit?: boolean) => void
  setLastExport: (last: LastExport) => void
  setHoldPreview: (on: boolean) => void
  setWandTolerance: (t: number) => void
  setSelectionMode: (m: EditorState['selectionMode']) => void

  // layers
  setActiveLayer: (id: string) => void
  addLayerFromCanvas: (canvas: HTMLCanvasElement, name: string, opts?: Partial<Layer>) => void
  duplicateLayer: (id: string) => void
  removeLayer: (id: string) => void
  moveLayer: (id: string, direction: 'up' | 'down') => void
  toggleLayerVisibility: (id: string) => void
  toggleLayerLock: (id: string) => void
  renameLayer: (id: string, name: string) => void
  setLayerOpacity: (id: string, opacity: number, commit?: boolean) => void
  setLayerBlendMode: (id: string, mode: BlendMode) => void
  mergeDown: (id: string) => void
  flattenImage: () => void
  replaceLayerPixels: (id: string, canvas: HTMLCanvasElement, label: string) => void
  offsetLayer: (id: string, dx: number, dy: number, commit?: boolean) => void
  /** Replaces a layer's pixels AND resizes the whole document to match (e.g. after AI upscale). */
  resizeDocumentToLayer: (id: string, canvas: HTMLCanvasElement) => void

  // adjustments
  updateAdjustments: (id: string, patch: Partial<Adjustments>, commit?: boolean) => void
  resetAdjustments: (id: string) => void

  // text layers
  addTextLayer: (data: TextLayerData) => void
  updateTextLayer: (id: string, patch: Partial<TextLayerData>, commit?: boolean, anchor?: { x: number; y: number }) => void
  startTextSession: (id: string, isNew?: boolean) => void
  applyTextSession: () => void
  cancelTextSession: () => void

  // collage
  createCollage: (templateId: string, width?: number, height?: number) => void
  fillCollageCell: (layerId: string, photo: HTMLCanvasElement) => void
  /** Cover-fit a media-bin photo onto a collage cell or social template canvas. */
  placeMediaOnCanvas: (photo: HTMLCanvasElement, name: string, point?: { x: number; y: number }, targetLayerId?: string) => void
  /** Move or swap photos between collage boxes in any direction. */
  rearrangeCollageCells: (fromLayerId: string, toLayerId: string) => void
  /** Pan/zoom the photo inside a selected collage frame. */
  setCollageFit: (layerId: string, patch: Partial<CollageFit>, commit?: boolean) => void
  /** Empty a filled frame, or remove an empty frame. */
  deleteCollageFrame: (layerId: string) => void
  clearCollageCell: (layerId: string) => void
  setCollageFramePosition: (layerId: string, x: number, y: number, commit?: boolean) => void
  setActiveImportId: (id: string | null) => void
  hydrateMediaLibrary: () => Promise<void>

  // transforms
  applyCrop: () => void
  resize: (width: number, height: number) => void
  rotate90: (turns: 1 | -1 | 2) => void
  flip: (axis: 'horizontal' | 'vertical') => void
  rotateActiveLayer: (degrees: number) => void

  // selection
  setSelection: (sel: Selection | null, mode?: EditorState['selectionMode']) => void
  invertSelection: () => void
  clearSelection: () => void

  // ai & status
  setAiJob: (job: AiJob | null) => void

  // brand kit
  setBrandColor: (index: number, color: string) => void
  setBrandFont: (font: string) => void

  // theme + compare
  setTheme: (theme: 'dark' | 'light') => void
  toggleCompareMode: () => void
  setCompareStepsBack: (n: number) => void
  /** The DocumentState shown in the compare view's "before" pane. */
  getCompareBeforeDoc: () => DocumentState | null
  notify: (kind: StatusMessage['kind'], text: string) => void
  dismissStatus: () => void
  addRecentImport: (
    item: {
      id?: string
      name: string
      thumbnailDataUrl: string
      blob: Blob
      workingCanvas?: HTMLCanvasElement
    },
    opts?: { activate?: boolean },
  ) => void
}

function freshDocMeta(fileName: string): Pick<
  DocumentState,
  'id' | 'createdAt' | 'modifiedAt' | 'projectPath' | 'crop' | 'lookId' | 'lookIntensity' | 'lastExport'
> {
  const now = new Date().toISOString()
  return {
    id: uid('doc'),
    createdAt: now,
    modifiedAt: now,
    projectPath: null,
    crop: null,
    lookId: null,
    lookIntensity: 100,
    lastExport: null,
  }
}

function makeLayer(source: HTMLCanvasElement, name: string, opts?: Partial<Layer>): Layer {
  return {
    id: uid('layer'),
    name,
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: 'normal',
    source,
    x: 0,
    y: 0,
    adjustments: defaultAdjustments(),
    ...opts,
  }
}

function pushHistory(state: EditorState, snapshot: DocumentState) {
  const past = [...state.past, snapshot]
  if (past.length > HISTORY_LIMIT) past.shift()
  return { past, future: [] as DocumentState[] }
}

export const useEditorStore = create<EditorState>()((set, get) => {
  const bump = () => ({ renderVersion: get().renderVersion + 1 })

  const updateLayer = (id: string, patch: Partial<Layer> | ((l: Layer) => Partial<Layer>)) => {
    const doc = get().doc
    if (!doc) return null
    const layers = doc.layers.map((l) =>
      l.id === id ? { ...l, ...(typeof patch === 'function' ? patch(l) : patch) } : l,
    )
    return { ...doc, layers }
  }

  return {
    doc: null,
    tool: 'move',
    viewport: { zoom: 1, panX: 0, panY: 0 },
    past: [],
    future: [],
    transactionSnapshot: null,
    cropDraft: null,
    wandTolerance: 32,
    selectionMode: 'replace',
    aiJob: null,
    status: null,
    brandKit: DEFAULT_BRAND_KIT,
    // Starts on the default and is hydrated from localStorage after mount by
    // ThemeProvider — reading storage here would make the first client render
    // disagree with the server HTML.
    theme: 'dark',
    compareMode: false,
    compareStepsBack: 0,
    renderVersion: 0,
    dirty: false,
    readOnly: false,
    holdPreview: false,
    textSession: null,
    recentImports: [],
    activeImportId: null,

    openImage: (source, fileName) => {
      const layer = makeLayer(source, 'Background')
      set({
        doc: {
          ...freshDocMeta(fileName),
          width: source.width,
          height: source.height,
          layers: [layer],
          activeLayerId: layer.id,
          selection: null,
          fileName,
        },
        past: [],
        future: [],
        cropDraft: null,
        tool: 'move',
        compareMode: false,
        compareStepsBack: 0,
        viewport: { zoom: 1, panX: 0, panY: 0 },
        dirty: true,
        readOnly: false,
        holdPreview: false,
        ...bump(),
      })
    },

    newDocument: (width, height) => {
      const c = createCanvas(width, height)
      const ctx = ctx2d(c)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      get().openImage(c, 'Untitled.png')
      set({ dirty: false, textSession: null })
    },

    closeDocument: () =>
      set({
        doc: null,
        past: [],
        future: [],
        cropDraft: null,
        aiJob: null,
        compareMode: false,
        dirty: false,
        readOnly: false,
        holdPreview: false,
        textSession: null,
        ...bump(),
      }),

    loadProjectDocument: (doc, brandKit, opts) => {
      set({
        doc,
        brandKit,
        past: [],
        future: [],
        cropDraft: doc.crop,
        tool: 'move',
        compareMode: false,
        compareStepsBack: 0,
        viewport: { zoom: 1, panX: 0, panY: 0 },
        dirty: opts?.dirty ?? false,
        readOnly: opts?.readOnly ?? false,
        holdPreview: false,
        ...bump(),
      })
    },

    markSaved: (projectPath) => {
      const doc = get().doc
      if (!doc) return
      set({
        doc: { ...doc, projectPath, modifiedAt: new Date().toISOString() },
        dirty: false,
      })
    },

    commit: (next) => {
      const state = get()
      if (!state.doc) return
      set({
        doc: { ...next, modifiedAt: new Date().toISOString() },
        dirty: true,
        ...pushHistory(state, state.doc),
        ...bump(),
      })
    },

    beginTransaction: () => {
      const doc = get().doc
      if (doc && !get().transactionSnapshot) set({ transactionSnapshot: doc })
    },

    endTransaction: () => {
      const state = get()
      const snap = state.transactionSnapshot
      if (!snap) return
      if (snap !== state.doc) set({ ...pushHistory(state, snap), transactionSnapshot: null })
      else set({ transactionSnapshot: null })
    },

    undo: () => {
      const { past, future, doc } = get()
      if (!past.length || !doc) return
      const prev = past[past.length - 1]
      set({ doc: prev, past: past.slice(0, -1), future: [doc, ...future], cropDraft: null, ...bump() })
    },

    redo: () => {
      const { past, future, doc } = get()
      if (!future.length || !doc) return
      const [next, ...rest] = future
      set({ doc: next, past: [...past, doc], future: rest, cropDraft: null, ...bump() })
    },

    setTool: (tool) => {
      if (tool === 'crop') {
        const doc = get().doc
        const existing = get().cropDraft ?? doc?.crop
        const draft =
          existing ?? (doc ? cropRectForPreset(doc.width, doc.height, 'free') : null)
        set({ tool, cropDraft: draft })
        return
      }
      set({ tool })
    },
    setViewport: (v) => set({ viewport: { ...get().viewport, ...v } }),
    zoomBy: (factor) => {
      const viewport = get().viewport
      set({ viewport: { ...viewport, zoom: clampZoom(viewport.zoom * factor) } })
    },
    fitToScreen: (stageW, stageH) => {
      const doc = get().doc
      if (!doc) return
      const next = computeFitViewport(stageW, stageH, doc.width, doc.height)
      if (next) set({ viewport: next })
    },
    setCropDraft: (rect) => set({ cropDraft: rect }),
    setWandTolerance: (t) => set({ wandTolerance: t }),
    setSelectionMode: (m) => set({ selectionMode: m }),

    setActiveLayer: (id) => {
      const doc = get().doc
      if (doc) set({ doc: { ...doc, activeLayerId: id } })
    },

    addLayerFromCanvas: (canvas, name, opts) => {
      const doc = get().doc
      if (!doc) return
      const layer = makeLayer(canvas, name, opts)
      const idx = doc.layers.findIndex((l) => l.id === doc.activeLayerId)
      const layers = [...doc.layers]
      layers.splice(idx + 1, 0, layer)
      get().commit({ ...doc, layers, activeLayerId: layer.id })
    },

    duplicateLayer: (id) => {
      const doc = get().doc
      const src = doc?.layers.find((l) => l.id === id)
      if (!doc || !src) return
      const copy: Layer = {
        ...src,
        id: uid('layer'),
        name: `${src.name} copy`,
        source: cloneCanvas(src.source),
        adjustments: structuredClone(src.adjustments),
      }
      const idx = doc.layers.indexOf(src)
      const layers = [...doc.layers]
      layers.splice(idx + 1, 0, copy)
      get().commit({ ...doc, layers, activeLayerId: copy.id })
    },

    removeLayer: (id) => {
      const doc = get().doc
      if (!doc || doc.layers.length <= 1) return
      const idx = doc.layers.findIndex((l) => l.id === id)
      const layers = doc.layers.filter((l) => l.id !== id)
      const active =
        doc.activeLayerId === id ? layers[Math.max(0, idx - 1)].id : doc.activeLayerId
      get().commit({ ...doc, layers, activeLayerId: active })
      if (get().textSession?.layerId === id) set({ textSession: null })
    },

    moveLayer: (id, direction) => {
      const doc = get().doc
      if (!doc) return
      const idx = doc.layers.findIndex((l) => l.id === id)
      const target = direction === 'up' ? idx + 1 : idx - 1
      if (idx < 0 || target < 0 || target >= doc.layers.length) return
      const layers = [...doc.layers]
      ;[layers[idx], layers[target]] = [layers[target], layers[idx]]
      get().commit({ ...doc, layers })
    },

    toggleLayerVisibility: (id) => {
      const next = updateLayer(id, (l) => ({ visible: !l.visible }))
      if (next) get().commit(next)
    },

    toggleLayerLock: (id) => {
      const next = updateLayer(id, (l) => ({ locked: !l.locked }))
      if (next) set({ doc: next, dirty: true })
    },

    renameLayer: (id, name) => {
      const next = updateLayer(id, { name })
      if (next) set({ doc: next, dirty: true })
    },

    setLayerOpacity: (id, opacity, commit = false) => {
      const next = updateLayer(id, { opacity })
      if (!next) return
      if (commit) get().commit(next)
      else set({ doc: next, dirty: true, ...bump() })
    },

    setLayerBlendMode: (id, mode) => {
      const next = updateLayer(id, { blendMode: mode })
      if (next) get().commit(next)
    },

    mergeDown: (id) => {
      const doc = get().doc
      if (!doc) return
      const idx = doc.layers.findIndex((l) => l.id === id)
      if (idx <= 0) return
      const upper = doc.layers[idx]
      const lower = doc.layers[idx - 1]
      const merged = createCanvas(doc.width, doc.height)
      const ctx = ctx2d(merged)
      ctx.drawImage(lower.source, lower.x, lower.y)
      ctx.globalAlpha = upper.opacity
      ctx.drawImage(upper.source, upper.x, upper.y)
      const layer: Layer = { ...lower, source: merged, x: 0, y: 0 }
      const layers = doc.layers.filter((l) => l !== upper).map((l) => (l === lower ? layer : l))
      get().commit({ ...doc, layers, activeLayerId: layer.id })
    },

    flattenImage: () => {
      const doc = get().doc
      if (!doc) return
      const flat = compositor.render(doc)
      const layer = makeLayer(flat, 'Background')
      get().commit({ ...doc, layers: [layer], activeLayerId: layer.id })
    },

    replaceLayerPixels: (id, canvas, _label) => {
      const doc = get().doc
      const layer = doc?.layers.find((l) => l.id === id)
      if (!doc || !layer) return
      if (layer.collageCell) {
        const fit = clampCollageFit(layer.collageFit)
        const cropped = coverCropToSize(canvas, layer.collageCell.width, layer.collageCell.height, fit)
        const next = updateLayer(id, {
          source: cropped,
          collageOriginal: canvas,
          collageFilled: true,
          collageFit: fit,
        })
        if (next) get().commit(next)
        return
      }
      const next = updateLayer(id, { source: canvas })
      if (next) get().commit(next)
    },

    resizeDocumentToLayer: (id, canvas) => {
      const doc = get().doc
      const layer = doc?.layers.find((l) => l.id === id)
      if (!doc || !layer) return
      if (layer.collageCell) {
        get().replaceLayerPixels(id, canvas, 'Upscale')
        return
      }
      const scaleX = canvas.width / layer.source.width
      const scaleY = canvas.height / layer.source.height
      const layers = doc.layers.map((l) =>
        l.id === id
          ? { ...l, source: canvas, x: 0, y: 0 }
          : { ...l, x: Math.round(l.x * scaleX), y: Math.round(l.y * scaleY) },
      )
      get().commit({ ...doc, width: canvas.width, height: canvas.height, layers, selection: null })
    },

    offsetLayer: (id, dx, dy, commit = false) => {
      const next = updateLayer(id, (l) => ({ x: l.x + dx, y: l.y + dy }))
      if (!next) return
      if (commit) get().commit(next)
      else set({ doc: next, dirty: true, ...bump() })
    },

    setCollageFramePosition: (layerId, x, y, commit = true) => {
      const doc = get().doc
      const layer = doc?.layers.find((l) => l.id === layerId)
      if (!doc || !layer?.collageCell || layer.collageMat) return
      const next = {
        ...doc,
        layers: doc.layers.map((l) => (l.id === layerId ? { ...l, x: Math.round(x), y: Math.round(y) } : l)),
      }
      if (commit) get().commit(next)
      else set({ doc: next, dirty: true, ...bump() })
    },

    updateAdjustments: (id, patch, commit = false) => {
      const next = updateLayer(id, (l) => ({ adjustments: { ...l.adjustments, ...patch } }))
      if (!next) return
      if (commit) get().commit(next)
      else set({ doc: next, dirty: true, ...bump() })
    },

    resetAdjustments: (id) => {
      const next = updateLayer(id, { adjustments: defaultAdjustments() })
      if (next) get().commit(next)
    },

    addTextLayer: (data) => {
      const doc = get().doc
      if (!doc) return
      const canvas = renderTextLayer(data)
      const layer: Layer = {
        id: uid('layer'),
        name: data.content.slice(0, 24) || 'Text',
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'normal',
        source: canvas,
        x: Math.round((doc.width - canvas.width) / 2),
        y: Math.round((doc.height - canvas.height) / 2),
        adjustments: defaultAdjustments(),
        kind: 'text' as const,
        textData: data,
      }
      const idx = doc.layers.findIndex((l) => l.id === doc.activeLayerId)
      const layers = [...doc.layers]
      layers.splice(idx + 1, 0, layer)
      get().commit({ ...doc, layers, activeLayerId: layer.id })
      set({
        tool: 'move',
        textSession: {
          layerId: layer.id,
          isNew: true,
          baseline: { textData: { ...data }, x: layer.x, y: layer.y },
        },
      })
    },

    startTextSession: (id, isNew = false) => {
      const { textSession, doc } = get()
      if (textSession?.layerId === id) return
      const layer = doc?.layers.find((l) => l.id === id)
      if (!layer?.textData) return
      set({
        textSession: {
          layerId: id,
          isNew,
          baseline: { textData: { ...layer.textData }, x: layer.x, y: layer.y },
        },
      })
    },

    applyTextSession: () => {
      const { textSession, doc } = get()
      if (!doc) {
        set({ textSession: null })
        return
      }
      get().commit(doc)
      const layer = doc.layers.find((l) => l.id === (textSession?.layerId ?? doc.activeLayerId))
      if (layer?.textData) {
        set({
          textSession: {
            layerId: layer.id,
            isNew: false,
            baseline: { textData: { ...layer.textData }, x: layer.x, y: layer.y },
          },
        })
        return
      }
      set({ textSession: null })
    },

    cancelTextSession: () => {
      const session = get().textSession
      if (!session) return
      if (session.isNew) {
        set({ textSession: null })
        get().removeLayer(session.layerId)
        return
      }
      const doc = get().doc
      const layer = doc?.layers.find((l) => l.id === session.layerId)
      if (doc && layer?.textData) {
        const canvas = renderTextLayer(session.baseline.textData)
        const nextLayer: Layer = {
          ...layer,
          source: canvas,
          textData: session.baseline.textData,
          x: session.baseline.x,
          y: session.baseline.y,
          name: session.baseline.textData.content.slice(0, 24) || 'Text',
        }
        get().commit({ ...doc, layers: doc.layers.map((l) => (l.id === layer.id ? nextLayer : l)) })
      }
      set({ textSession: null })
    },

    updateTextLayer: (id, patch, commit = false, anchor) => {
      const doc = get().doc
      const layer = doc?.layers.find((l) => l.id === id)
      if (!doc || !layer || !layer.textData) return
      const nextData = { ...layer.textData, ...patch }
      const canvas = renderTextLayer(nextData)
      let x: number
      let y: number
      if (anchor) {
        const relX = layer.source.width ? (anchor.x - layer.x) / layer.source.width : 0.5
        const relY = layer.source.height ? (anchor.y - layer.y) / layer.source.height : 0.5
        x = Math.round(anchor.x - relX * canvas.width)
        y = Math.round(anchor.y - relY * canvas.height)
      } else {
        const oldCx = layer.x + layer.source.width / 2
        const oldCy = layer.y + layer.source.height / 2
        x = Math.round(oldCx - canvas.width / 2)
        y = Math.round(oldCy - canvas.height / 2)
      }
      const nextLayer: Layer = {
        ...layer,
        source: canvas,
        textData: nextData,
        name: nextData.content.slice(0, 24) || 'Text',
        x,
        y,
      }
      const layers = doc.layers.map((l) => (l.id === id ? nextLayer : l))
      const next = { ...doc, layers }
      if (commit) get().commit(next)
      else set({ doc: next, dirty: true, ...bump() })
    },

    createCollage: (templateId, width, height) => {
      const template = getTemplateById(templateId)
      if (!template) return
      const built = instantiateTemplate(template, width ?? template.canvasWidth, height ?? template.canvasHeight)
      set({
        doc: {
          ...freshDocMeta(built.fileName),
          width: built.width,
          height: built.height,
          layers: built.layers,
          activeLayerId: built.activeLayerId,
          selection: null,
          fileName: built.fileName,
        },
        past: [],
        future: [],
        cropDraft: null,
        tool: 'move',
        compareMode: false,
        compareStepsBack: 0,
        dirty: true,
        readOnly: false,
        ...bump(),
      })
    },

    fillCollageCell: (layerId, photo) => {
      const doc = get().doc
      const layer = doc?.layers.find((l) => l.id === layerId)
      if (!doc || !layer || !layer.collageCell) return
      const original = workingCanvasFromSource(photo)
      const fit = DEFAULT_COLLAGE_FIT
      const cropped = coverCropToSize(original, layer.collageCell.width, layer.collageCell.height, fit)
      const layers = doc.layers.map((l) =>
        l.id === layerId
          ? {
              ...l,
              source: cropped,
              collageFilled: true,
              collageOriginal: original,
              collageFit: fit,
              name: `Photo ${doc.layers.indexOf(l) + 1}`,
            }
          : l,
      )
      get().commit({ ...doc, layers, activeLayerId: layerId })
    },

    rearrangeCollageCells: (fromLayerId, toLayerId) => {
      const doc = get().doc
      if (!doc) return
      const from = doc.layers.find((l) => l.id === fromLayerId)
      const to = doc.layers.find((l) => l.id === toLayerId)
      const kind = collageRearrangeKind(from, to)
      if (kind === 'invalid' || kind === 'noop' || !from?.collageCell || !to?.collageCell) return

      const cells = doc.layers.filter((l) => l.collageCell)
      const fromIndex = cells.findIndex((l) => l.id === from.id)
      const toIndex = cells.findIndex((l) => l.id === to.id)
      const fromOrig = from.collageOriginal ?? from.source
      const toOrig = to.collageFilled ? (to.collageOriginal ?? to.source) : null
      const fromFit = clampCollageFit(from.collageFit)
      const toFit = clampCollageFit(to.collageFit)

      const layers = doc.layers.map((l) => {
        if (l.id === to.id && l.collageCell) {
          return {
            ...l,
            source: coverCropToSize(fromOrig, l.collageCell.width, l.collageCell.height, fromFit),
            collageFilled: true,
            collageOriginal: fromOrig,
            collageFit: fromFit,
            name: `Photo ${toIndex + 1}`,
          }
        }
        if (l.id === from.id && l.collageCell) {
          if (kind === 'move') {
            return {
              ...l,
              source: renderCollagePlaceholder(l.collageCell.width, l.collageCell.height, fromIndex + 1),
              collageFilled: false,
              collageOriginal: undefined,
              collageFit: undefined,
              name: `Photo ${fromIndex + 1}`,
            }
          }
          return {
            ...l,
            source: coverCropToSize(toOrig!, l.collageCell.width, l.collageCell.height, toFit),
            collageFilled: true,
            collageOriginal: toOrig!,
            collageFit: toFit,
            name: `Photo ${fromIndex + 1}`,
          }
        }
        return l
      })
      get().commit({ ...doc, layers, activeLayerId: toLayerId })
      get().notify('success', kind === 'swap' ? 'Swapped photos' : 'Moved photo')
    },

    setCollageFit: (layerId, patch, commit = true) => {
      const doc = get().doc
      const layer = doc?.layers.find((l) => l.id === layerId)
      if (!doc || !layer?.collageCell || !layer.collageFilled) return
      const original = layer.collageOriginal ?? layer.source
      const fit = clampCollageFit({ ...layer.collageFit, ...patch })
      const source = coverCropToSize(original, layer.collageCell.width, layer.collageCell.height, fit)
      const next = {
        ...doc,
        layers: doc.layers.map((l) =>
          l.id === layerId ? { ...l, source, collageFit: fit, collageOriginal: original } : l,
        ),
      }
      if (commit) get().commit(next)
      else set({ doc: next, dirty: true, ...bump() })
    },

    clearCollageCell: (layerId) => {
      const doc = get().doc
      const layer = doc?.layers.find((l) => l.id === layerId)
      if (!doc || !layer?.collageCell || !layer.collageFilled) return
      const cells = doc.layers.filter((l) => l.collageCell)
      const index = cells.findIndex((l) => l.id === layerId)
      const source = renderCollagePlaceholder(layer.collageCell.width, layer.collageCell.height, index + 1)
      get().commit({
        ...doc,
        layers: doc.layers.map((l) =>
          l.id === layerId
            ? {
                ...l,
                source,
                collageFilled: false,
                collageOriginal: undefined,
                collageFit: undefined,
              }
            : l,
        ),
        activeLayerId: layerId,
      })
    },

    deleteCollageFrame: (layerId) => {
      const doc = get().doc
      const layer = doc?.layers.find((l) => l.id === layerId)
      const action = collageFrameDeleteAction(layer)
      if (action === 'clear') get().clearCollageCell(layerId)
      else if (action === 'remove') get().removeLayer(layerId)
    },

    placeMediaOnCanvas: (photo, name, point, targetLayerId) => {
      const doc = get().doc
      if (!doc) {
        get().openImage(photo, name)
        return
      }
      const cells = doc.layers.filter((l) => l.collageCell)
      if (cells.length) {
        const targeted = targetLayerId ? cells.find((l) => l.id === targetLayerId) : null
        const hit = point ? collageCellAtPoint(doc.layers, point.x, point.y) : null
        const inOrder = cells.slice().sort((a, b) => a.y - b.y || a.x - b.x)
        const target = targeted ?? hit ?? nextUnfilledCollageCell(doc.layers) ?? inOrder[inOrder.length - 1]
        get().fillCollageCell(target.id, photo)
        get().notify('success', `Placed on ${target.name}`)
        return
      }
      const photoLayer = selectPhotoLayer(get())
      const cropped = coverCropToSize(photo, doc.width, doc.height)
      if (!photoLayer) {
        get().addLayerFromCanvas(cropped, name, { x: 0, y: 0 })
        return
      }
      const next = updateLayer(photoLayer.id, { source: cropped, x: 0, y: 0, name })
      if (next) get().commit({ ...next, activeLayerId: photoLayer.id })
    },

    applyCrop: () => {
      const { doc, cropDraft } = get()
      if (!doc || !cropDraft) return
      get().commit({ ...doc, crop: cropDraft })
      set({ cropDraft, tool: 'move' })
    },

    setLiveCrop: (rect) => {
      const doc = get().doc
      if (!doc) return
      get().commit({ ...doc, crop: rect })
      set({ cropDraft: rect })
    },

    bakeCrop: () => {
      const { doc } = get()
      if (!doc?.crop) return
      get().commit({ ...cropDocument(doc, doc.crop), crop: null })
      set({ cropDraft: null, tool: 'move' })
    },

    applyLook: (lookId, intensity, commit = true) => {
      const doc = get().doc
      if (!doc) return false
      const preset =
        FILTER_PRESETS.find((p) => p.id === lookId) ??
        CAMERA_PROFILES.find((p) => p.id === lookId)
      const nextAdj =
        !lookId || lookId === 'original' || !preset
          ? defaultAdjustments()
          : adjustmentsFromLook(preset.adjustments, intensity)
      const collageTargets = collageLookTargetIds(doc.layers)
      let targetIds = collageTargets
      if (!targetIds.length) {
        const layer = selectPhotoLayer(get())
        if (layer?.collageCell && !layer.collageFilled) {
          get().notify('info', 'Add a photo to a frame first, then Optimize Image.')
          return false
        }
        if (layer && !layer.collageMat) targetIds = [layer.id]
      }
      if (!targetIds.length) return false
      const idSet = new Set(targetIds)
      const layers = doc.layers.map((l) => (idSet.has(l.id) ? { ...l, adjustments: nextAdj } : l))
      const next = { ...doc, layers, lookId: lookId === 'original' ? null : lookId, lookIntensity: intensity }
      if (commit) get().commit(next)
      else set({ doc: next, dirty: true, ...bump() })
      return true
    },

    addWatermarkLayer: (data) => {
      const doc = get().doc
      if (!doc) return
      const wm = defaultWatermark(data)
      const source = data.source ?? renderWatermarkText(wm.text)
      const layer = makeLayer(source, wm.kind === 'logo' ? 'Logo' : 'Watermark', {
        kind: 'watermark',
        watermark: wm,
      })
      const layers = [...doc.layers.filter((l) => l.kind !== 'watermark'), layer]
      get().commit({ ...doc, layers, activeLayerId: layer.id })
    },

    updateWatermark: (id, patch, source, commit = false) => {
      const next = updateLayer(id, (l) => ({
        watermark: { ...defaultWatermark(), ...l.watermark, ...patch },
        source: source ?? l.source,
        kind: 'watermark' as const,
      }))
      if (!next) return
      if (commit) get().commit(next)
      else set({ doc: next, dirty: true, ...bump() })
    },

    setLastExport: (last) => {
      const doc = get().doc
      if (doc) set({ doc: { ...doc, lastExport: last } })
    },

    setHoldPreview: (on) => set({ holdPreview: on }),

    resize: (width, height) => {
      const doc = get().doc
      if (!doc) return
      get().commit(resizeDocument(doc, width, height))
    },

    rotate90: (turns) => {
      const doc = get().doc
      if (!doc) return
      const layer = doc.layers.find((l) => l.id === doc.activeLayerId)
      if (layer?.collageCell && layer.collageFilled && layer.collageCell) {
        const original = rotateCanvas90(layer.collageOriginal ?? layer.source, turns)
        const fit = clampCollageFit(layer.collageFit)
        const source = coverCropToSize(original, layer.collageCell.width, layer.collageCell.height, fit)
        get().commit({
          ...doc,
          layers: doc.layers.map((l) =>
            l.id === layer.id ? { ...l, source, collageOriginal: original, collageFit: fit } : l,
          ),
        })
        return
      }
      if (doc.layers.some((l) => l.collageCell)) {
        get().notify('info', 'Select a filled frame, then rotate that photo.')
        return
      }
      get().commit(rotateDocument90(doc, turns))
    },

    flip: (axis) => {
      const doc = get().doc
      if (!doc) return
      const layer = doc.layers.find((l) => l.id === doc.activeLayerId)
      if (layer?.collageCell && layer.collageFilled && layer.collageCell) {
        const original = flipCanvas(layer.collageOriginal ?? layer.source, axis)
        const fit = clampCollageFit(layer.collageFit)
        const source = coverCropToSize(original, layer.collageCell.width, layer.collageCell.height, fit)
        get().commit({
          ...doc,
          layers: doc.layers.map((l) =>
            l.id === layer.id ? { ...l, source, collageOriginal: original, collageFit: fit } : l,
          ),
        })
        return
      }
      if (doc.layers.some((l) => l.collageCell)) {
        get().notify('info', 'Select a filled frame, then flip that photo.')
        return
      }
      get().commit(flipDocument(doc, axis))
    },

    rotateActiveLayer: (degrees) => {
      const doc = get().doc
      const layer = doc?.layers.find((l) => l.id === doc.activeLayerId)
      if (!doc || !layer) return
      const rotated = rotateLayer(layer, degrees)
      get().commit({ ...doc, layers: doc.layers.map((l) => (l === layer ? rotated : l)) })
    },

    setSelection: (sel, mode) => {
      const doc = get().doc
      if (!doc) return
      const selection = sel ? combineSelections(doc.selection, sel, mode ?? get().selectionMode) : null
      set({ doc: { ...doc, selection }, ...bump() })
    },

    invertSelection: () => {
      const doc = get().doc
      if (!doc?.selection) return
      set({ doc: { ...doc, selection: invertSelection(doc.selection) }, ...bump() })
    },

    clearSelection: () => {
      const doc = get().doc
      if (doc) set({ doc: { ...doc, selection: null }, ...bump() })
    },

    setAiJob: (job) => set({ aiJob: job }),

    setBrandColor: (index, color) => {
      const colors = [...get().brandKit.colors]
      colors[index] = color
      set({ brandKit: { ...get().brandKit, colors } })
    },
    setBrandFont: (font) => set({ brandKit: { ...get().brandKit, font } }),

    setTheme: (theme) => {
      if (typeof window !== 'undefined') localStorage.setItem('vista-theme', theme)
      set({ theme })
    },
    toggleCompareMode: () =>
      set((s) => ({
        compareMode: !s.compareMode,
        // Always land on the as-imported original so BEFORE is the true
        // before, not the previous look (which reads as swapped after a reset).
        compareStepsBack: s.compareMode ? s.compareStepsBack : 0,
      })),
    setCompareStepsBack: (n) => set({ compareStepsBack: Math.max(0, Math.min(5, n)) }),
    getCompareBeforeDoc: () => {
      const { doc, past, compareStepsBack } = get()
      if (!doc) return null
      if (past.length === 0) return doc // nothing to undo yet — before === after
      if (compareStepsBack === 0) return past[0] // true original as-imported
      const index = Math.max(0, past.length - compareStepsBack)
      return past[index]
    },
    notify: (kind, text) => set({ status: { id: uid('msg'), kind, text } }),
    dismissStatus: () => set({ status: null }),
    setActiveImportId: (id) => set({ activeImportId: id }),
    addRecentImport: ({ id, name, thumbnailDataUrl, blob, workingCanvas }, opts) => {
      const nextId = id ?? uid('imp')
      const entry: RecentImport = { id: nextId, name, thumbnailDataUrl, blob, workingCanvas }
      const rest = get().recentImports.filter((r) => r.id !== nextId)
      const recentImports = [entry, ...rest].slice(0, RECENT_IMPORTS_CAP)
      const kept = new Set(recentImports.map((r) => r.id))
      const evicted = get().recentImports.filter((r) => !kept.has(r.id)).map((r) => r.id)
      set({
        recentImports,
        activeImportId: opts?.activate === false ? get().activeImportId : nextId,
      })
      void putMediaItem({
        id: nextId,
        name,
        thumbnailDataUrl,
        blob,
        addedAt: Date.now(),
      })
      if (evicted.length) void deleteMediaItems(evicted)
    },

    hydrateMediaLibrary: async () => {
      const stored = await loadMediaLibrary()
      if (!stored.length) return
      const have = new Set(get().recentImports.map((r) => r.id))
      const extras = stored
        .filter((row) => !have.has(row.id))
        .map((row) => ({
          id: row.id,
          name: row.name,
          thumbnailDataUrl: row.thumbnailDataUrl,
          blob: row.blob,
        }))
      if (!extras.length) return
      set({ recentImports: [...get().recentImports, ...extras].slice(0, RECENT_IMPORTS_CAP) })
    },
  }
})

export const selectActiveLayer = (s: EditorState): Layer | null =>
  s.doc?.layers.find((l) => l.id === s.doc?.activeLayerId) ?? null

/**
 * Target for photo-wide operations (filters, AI ops).
 *
 * The active layer, unless it holds text: a filter or a background removal
 * run against a text layer changes nothing you can see (white glyphs stay
 * white, transparent padding stays transparent), which reads as the feature
 * being broken. In that case fall back to the topmost photo layer instead.
 */
const isAdjustablePhoto = (layer: Layer) =>
  !layer.textData && layer.kind !== 'watermark' && !layer.collageMat && !(layer.collageCell && !layer.collageFilled)

export const selectPhotoLayer = (s: EditorState): Layer | null => {
  const layers = s.doc?.layers ?? []
  const active = layers.find((l) => l.id === s.doc?.activeLayerId) ?? null
  if (active && isAdjustablePhoto(active)) return active
  const photos = layers.filter(isAdjustablePhoto)
  return photos.findLast((l) => l.visible) ?? photos.at(-1) ?? active
}

export const selectWatermarkLayer = (s: EditorState): Layer | null =>
  s.doc?.layers.find((l) => l.kind === 'watermark' || l.watermark) ?? null

