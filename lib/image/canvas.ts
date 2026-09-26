/**
 * Small, dependency-free canvas helpers. Everything in the editor works on
 * HTMLCanvasElement so pixels never leave the renderer process.
 */

export function createCanvas(width: number, height: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(width))
  c.height = Math.max(1, Math.round(height))
  return c
}

export function ctx2d(canvas: HTMLCanvasElement, mode: 'read' | 'draw' = 'read'): CanvasRenderingContext2D {
  // `willReadFrequently` forces a CPU rasterizer — fine for LUT work, deadly
  // on a 12MP iPhone composite that is only blitted to the screen.
  const ctx =
    mode === 'draw'
      ? canvas.getContext('2d', { alpha: true })
      : canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('2D canvas context unavailable')
  return ctx
}

export function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = createCanvas(src.width, src.height)
  ctx2d(c).drawImage(src, 0, 0)
  return c
}

export function canvasFromImageData(data: ImageData): HTMLCanvasElement {
  const c = createCanvas(data.width, data.height)
  ctx2d(c).putImageData(data, 0, 0)
  return c
}

export function imageDataOf(canvas: HTMLCanvasElement): ImageData {
  return ctx2d(canvas).getImageData(0, 0, canvas.width, canvas.height)
}

const IMAGE_EXTENSIONS = /\.(png|jpe?g|webp|avif|bmp|gif|tiff?|heic|heif|hif)$/i
const HEIC_NAME = /\.(heic|heif|hif)$/i
const HEIC_MIME = /^image\/hei[cf](?:-sequence)?$/i
const HEIC_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'])

/** Shared by the hidden file input and the web-fallback picker. */
export const IMAGE_FILE_ACCEPT =
  'image/png,image/jpeg,image/webp,image/avif,image/bmp,image/gif,image/tiff,image/heic,image/heif,.heic,.heif,.hif,.tif,.tiff'

/**
 * Windows hands over files with an empty `type` for several codecs (notably
 * TIFF, HEIC from iPhone, and files opened from some network shares), so the
 * extension is the fallback rather than trusting the MIME type alone.
 */
export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true
  if (IMAGE_EXTENSIONS.test(file.name)) return true
  return false
}

/** OS file drops put the photo on `items` in Chromium and on `files` in Electron. */
export function fileFromDataTransfer(transfer: DataTransfer | null | undefined): File | null {
  if (!transfer) return null
  for (const item of Array.from(transfer.items ?? [])) {
    if (item.kind !== 'file') continue
    const file = item.getAsFile()
    if (file) return file
  }
  return transfer.files?.[0] ?? null
}

type EntryLike = {
  isFile: boolean
  isDirectory: boolean
  file?: (ok: (file: File) => void, err?: (err: DOMException) => void) => void
  createReader?: () => { readEntries: (ok: (entries: EntryLike[]) => void, err?: (err: DOMException) => void) => void }
}

function entryOf(item: DataTransferItem): EntryLike | null {
  const getter = (item as DataTransferItem & { webkitGetAsEntry?: () => FileSystemEntry | null }).webkitGetAsEntry
  if (typeof getter !== 'function') return null
  return (getter.call(item) as unknown as EntryLike | null) ?? null
}

function readDirectory(entry: EntryLike): Promise<EntryLike[]> {
  const reader = entry.createReader?.()
  if (!reader) return Promise.resolve([])
  const all: EntryLike[] = []
  const readBatch = (): Promise<EntryLike[]> =>
    new Promise((resolve, reject) => {
      reader.readEntries(
        (batch) => {
          if (!batch.length) {
            resolve(all)
            return
          }
          all.push(...batch)
          void readBatch().then(resolve, reject)
        },
        (err) => reject(err),
      )
    })
  return readBatch()
}

async function collectEntry(entry: EntryLike, out: File[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) => {
      if (!entry.file) {
        reject(new Error('file entry missing file()'))
        return
      }
      entry.file(resolve, reject)
    })
    out.push(file)
    return
  }
  if (entry.isDirectory) {
    const children = await readDirectory(entry)
    for (const child of children) await collectEntry(child, out)
  }
}

/**
 * All files from a drop, including a dropped folder via `webkitGetAsEntry`.
 * Falls back to `transfer.files` when entries are unavailable (typical in Electron).
 */
export async function filesFromDataTransfer(transfer: DataTransfer | null | undefined): Promise<File[]> {
  if (!transfer) return []
  const fromEntries: File[] = []
  let usedEntries = false
  for (const item of Array.from(transfer.items ?? [])) {
    if (item.kind !== 'file') continue
    const entry = entryOf(item)
    if (!entry) continue
    usedEntries = true
    await collectEntry(entry, fromEntries)
  }
  if (usedEntries && fromEntries.length) return fromEntries
  return Array.from(transfer.files ?? [])
}

function headerBytes(header: ArrayBuffer | Uint8Array): Uint8Array {
  return header instanceof Uint8Array ? header : new Uint8Array(header)
}

/** JPEG, PNG, GIF, or WebP bytes. A stored HEIC import is re-saved as one of these but keeps the .HEIC name. */
function headerIsCommonRaster(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 3) return false
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return true
  if (bytes.byteLength >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return true
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return true
  if (bytes.byteLength >= 4 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true
  return false
}

export function looksLikeHeic(file: { name?: string; type?: string }, header?: ArrayBuffer | Uint8Array): boolean {
  if (header) {
    const bytes = headerBytes(header)
    if (bytes.byteLength >= 12) {
      const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).replace(/\0/g, ' ').trim()
      if (HEIC_BRANDS.has(brand)) return true
    }
    if (headerIsCommonRaster(bytes)) return false
  }
  if (file.type && HEIC_MIME.test(file.type)) return true
  if (file.name && HEIC_NAME.test(file.name)) return true
  return false
}

async function blobLooksLikeHeic(blob: Blob, fileName = ''): Promise<boolean> {
  const name = fileName || (blob instanceof File ? blob.name : '')
  const type = blob.type || (blob instanceof File ? blob.type : '')
  try {
    const header = await blob.slice(0, 16).arrayBuffer()
    if (header.byteLength >= 3) return looksLikeHeic({ name, type }, header)
  } catch {
    /* Fall back to the file name when the bytes cannot be read. */
  }
  return looksLikeHeic({ name, type })
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

async function decodeWithBrowser(blob: Blob): Promise<HTMLCanvasElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Chromium/Electron on Windows can hang forever on HEIC (and some
      // WIC codecs) instead of rejecting. Cap it so we can fall through.
      const bitmap = await withTimeout(
        createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions).catch(() =>
          createImageBitmap(blob),
        ),
        2500,
        'createImageBitmap timed out',
      )
      const c = createCanvas(bitmap.width, bitmap.height)
      ctx2d(c).drawImage(bitmap, 0, 0)
      bitmap.close()
      return c
    } catch {
      // Some Windows image codecs fail through createImageBitmap but still
      // decode correctly through Chromium's HTMLImageElement pipeline.
    }
  }

  const url = URL.createObjectURL(blob)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('Unsupported or damaged image'))
      element.src = url
    })
    const c = createCanvas(image.naturalWidth, image.naturalHeight)
    ctx2d(c).drawImage(image, 0, 0)
    return c
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * iPhone HEIC/HEIF. Chromium on Windows cannot decode these natively, so
 * both the desktop app and the web build go through the same libheif wasm
 * path (heic-to). Safari can decode natively — we try that first.
 */
async function decodeHeic(blob: Blob): Promise<HTMLCanvasElement> {
  const { heicTo } = await import('heic-to/csp')
  try {
    const bitmap = await heicTo({ blob, type: 'bitmap' })
    const c = createCanvas(bitmap.width, bitmap.height)
    ctx2d(c).drawImage(bitmap, 0, 0)
    bitmap.close()
    assertDecodedCanvas(c, 'HEIC')
    return c
  } catch {
    const png = await heicTo({ blob, type: 'image/png' })
    return decodeWithBrowser(png)
  }
}

function canDecodeHeicNatively(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return /Safari/i.test(ua) && !/Chrome|Chromium|Edg|Electron/i.test(ua)
}

function assertDecodedCanvas(canvas: HTMLCanvasElement, label: string) {
  if (canvas.width < 2 || canvas.height < 2) {
    throw new Error(`${label} decode failed (${canvas.width}×${canvas.height})`)
  }
}

export async function canvasFromBlob(blob: Blob, fileName = ''): Promise<HTMLCanvasElement> {
  if (!blob || blob.size === 0) {
    throw new Error(`${fileName || 'image'} is empty`)
  }
  const heic = await blobLooksLikeHeic(blob, fileName)
  let canvas: HTMLCanvasElement
  if (heic) {
    if (canDecodeHeicNatively()) {
      try {
        canvas = await decodeWithBrowser(blob)
      } catch {
        canvas = await decodeHeic(blob)
      }
    } else {
      canvas = await decodeHeic(blob)
    }
  } else {
    canvas = await decodeWithBrowser(blob)
  }
  assertDecodedCanvas(canvas, heic ? `HEIC ${fileName || 'photo'}` : fileName || 'image')
  return canvas
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = 'image/png',
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))),
      type,
      quality,
    )
  })
}

/** Resample a canvas to a new size using the browser's high quality filter. */
export function resampleCanvas(
  src: HTMLCanvasElement,
  width: number,
  height: number,
): HTMLCanvasElement {
  const out = createCanvas(width, height)
  const ctx = ctx2d(out)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, width, height)
  return out
}

export type ExportFitMode = 'fill' | 'fit' | 'stretch'

/**
 * Places `src` into a canvas of exactly `targetW`×`targetH` — the step every
 * social platform export needs since a source photo's aspect ratio almost
 * never matches the target post size.
 *  - 'fill' (cover): scales up to cover the target, cropping the overflow.
 *    This is what most social exports want — no letterboxing.
 *  - 'fit' (contain): scales down to fit entirely inside the target,
 *    padding the remainder with `background`.
 *  - 'stretch': squeezes the full photo into the target (no crop, may distort).
 */
export function fitCanvasToSize(
  src: HTMLCanvasElement,
  targetW: number,
  targetH: number,
  mode: ExportFitMode,
  background = '#ffffff',
): HTMLCanvasElement {
  const out = createCanvas(targetW, targetH)
  const ctx = ctx2d(out)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  if (mode === 'stretch') {
    ctx.drawImage(src, 0, 0, targetW, targetH)
    return out
  }

  const srcRatio = src.width / src.height
  const targetRatio = targetW / targetH

  let drawW: number
  let drawH: number
  if (mode === 'fill' ? srcRatio > targetRatio : srcRatio < targetRatio) {
    drawH = targetH
    drawW = targetH * srcRatio
  } else {
    drawW = targetW
    drawH = targetW / srcRatio
  }

  if (mode === 'fit') {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, targetW, targetH)
  }

  const dx = (targetW - drawW) / 2
  const dy = (targetH - drawH) / 2
  ctx.drawImage(src, dx, dy, drawW, drawH)
  return out
}

export const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v)
export const clamp = (v: number, min: number, max: number) =>
  v < min ? min : v > max ? max : v

/** Max edge for media-bin drops into collage cells — skips a second full decode. */
export const IMPORT_WORKING_MAX_EDGE = 2048

/** Downsample huge imports so collage fill/pan does not blit 12MP every drop. */
export function workingCanvasFromSource(
  src: HTMLCanvasElement,
  maxEdge = IMPORT_WORKING_MAX_EDGE,
): HTMLCanvasElement {
  const edge = Math.max(src.width, src.height, 1)
  if (edge <= maxEdge) return src
  const scale = maxEdge / edge
  return resampleCanvas(
    src,
    Math.max(1, Math.round(src.width * scale)),
    Math.max(1, Math.round(src.height * scale)),
  )
}

export function hasWorkingCanvas(item: { workingCanvas?: HTMLCanvasElement | null }): boolean {
  const canvas = item.workingCanvas
  return !!canvas && canvas.width > 1 && canvas.height > 1
}

export async function canvasFromRecentImport(item: {
  name: string
  blob: Blob
  workingCanvas?: HTMLCanvasElement
}): Promise<HTMLCanvasElement> {
  if (hasWorkingCanvas(item)) return item.workingCanvas as HTMLCanvasElement
  if (!item.blob || item.blob.size === 0) {
    throw new Error(`Imported photo "${item.name}" is no longer available`)
  }
  const decoded = await canvasFromBlob(item.blob, item.name)
  const working = workingCanvasFromSource(decoded)
  item.workingCanvas = working
  return working
}

/** Open a Media-bin photo on the canvas without re-running the file import. */
export async function canvasToOpenFromImport(item: {
  name: string
  blob: Blob
  workingCanvas?: HTMLCanvasElement
}): Promise<HTMLCanvasElement> {
  return cloneCanvas(await canvasFromRecentImport(item))
}

/** Small JPEG data-URL for the imported-images strip. Full pixels stay on `blob`. */
export function thumbnailDataUrl(source: HTMLCanvasElement, maxEdge = 96): string {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height, 1))
  const c = createCanvas(
    Math.max(1, Math.round(source.width * scale)),
    Math.max(1, Math.round(source.height * scale)),
  )
  const ctx = ctx2d(c, 'draw')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, c.width, c.height)
  return c.toDataURL('image/jpeg', 0.72)
}

let idCounter = 0
export function uid(prefix = 'id'): string {
  idCounter += 1
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`
}
