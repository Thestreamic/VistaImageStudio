/**
 * Android (Capacitor) host. Implements the same LumenBridge the editor already
 * uses on web and desktop, so the engine and UI do not branch on platform.
 *
 * In:  Android system Photo Picker (Camera.chooseFromGallery) — no storage permission.
 * Out: Pictures/Vista Image Studio via the app's VistaGallery plugin (MediaStore),
 *      or the Android share sheet.
 * Projects and autosave live in app-private storage (Directory.Data).
 */
import { Capacitor, registerPlugin } from '@capacitor/core'
import { Camera, MediaTypeSelection } from '@capacitor/camera'
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'
import type { LumenBridge, OpenedFile, OpenedProject, PrivacyInfo } from './bridge'

interface VistaGalleryPlugin {
  saveImage(options: { data: string; fileName: string; mimeType: string }): Promise<{ uri: string }>
}

/** App-local plugin: android/app/src/main/java/in/thestreamic/vistaimagestudio/GalleryPlugin.java */
const VistaGallery = registerPlugin<VistaGalleryPlugin>('VistaGallery')

const PROJECTS_DIR = 'projects'
const AUTOSAVE_PATH = 'autosave/recovery.lumen'
const SHARE_DIR = 'share'

export function isNativeApp(): boolean {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform()
}

function safeName(name: string): string {
  const cleaned = name.replace(/[\\/:*?"<>|]+/g, '_').trim()
  return cleaned || `vista-${Date.now()}`
}

function mimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  return 'image/jpeg'
}

function extFromMime(mime: string): string {
  if (mime.includes('png')) return 'png'
  if (mime.includes('webp')) return 'webp'
  if (mime.includes('heic') || mime.includes('heif')) return 'heic'
  return 'jpg'
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image'))
    reader.readAsDataURL(blob)
  })
}

function isCancel(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err)
  return /cancel/i.test(message)
}

async function readText(path: string): Promise<string | null> {
  try {
    const file = await Filesystem.readFile({ path, directory: Directory.Data, encoding: Encoding.UTF8 })
    return typeof file.data === 'string' ? file.data : await file.data.text()
  } catch {
    return null
  }
}

const ANDROID_PRIVACY: PrivacyInfo = {
  host: 'android',
  platform: 'android',
  csp: 'Bundled app only (https://localhost)',
  analytics: 'off',
  modelsFolder: '(not included in this version)',
  userDataPath: 'App-private storage',
  autosavePath: `App storage: ${AUTOSAVE_PATH}`,
  connectSrc: 'Bundled app only',
}

export function makeCapacitorBridge(fallback: LumenBridge): LumenBridge {
  const bridge: LumenBridge = {
    async getHostInfo() {
      return { host: 'android', platform: Capacitor.getPlatform(), backend: 'cpu' }
    },

    async openImage(): Promise<OpenedFile | null> {
      try {
        const picked = await Camera.chooseFromGallery({
          mediaType: MediaTypeSelection.Photo,
          allowMultipleSelection: false,
          limit: 1,
        })
        const item = picked.results[0]
        if (!item?.webPath) return null
        const blob = await (await fetch(item.webPath)).blob()
        return { name: `photo-${Date.now()}.${extFromMime(blob.type)}`, blob }
      } catch (err) {
        if (isCancel(err)) return null
        throw err
      }
    },

    async saveImage(blob, suggestedName) {
      const fileName = safeName(suggestedName)
      await VistaGallery.saveImage({
        data: await blobToBase64(blob),
        fileName,
        mimeType: blob.type || mimeFromName(fileName),
      })
      return true
    },

    async saveImages(files) {
      for (const file of files) {
        await bridge.saveImage(file.blob, file.name)
      }
      return true
    },

    async shareImages(files) {
      const uris: string[] = []
      for (const file of files) {
        const path = `${SHARE_DIR}/${safeName(file.name)}`
        await Filesystem.writeFile({
          path,
          data: await blobToBase64(file.blob),
          directory: Directory.Cache,
          recursive: true,
        })
        uris.push((await Filesystem.getUri({ path, directory: Directory.Cache })).uri)
      }
      try {
        await Share.share({ files: uris })
        return true
      } catch (err) {
        if (isCancel(err)) return false
        throw err
      }
    },

    // The Home screen (Step 2) lists saved projects; until then the WebView
    // file chooser opens a .lumen file the same way the web build does.
    openProject: () => fallback.openProject(),

    async openProjectPath(path): Promise<OpenedProject | null> {
      const json = await readText(path)
      if (json === null) return null
      return { name: path.split('/').pop() ?? path, json, path }
    },

    async saveProject(json, suggestedName, existingPath) {
      const name = safeName(suggestedName.endsWith('.lumen') ? suggestedName : `${suggestedName}.lumen`)
      const path = existingPath ?? `${PROJECTS_DIR}/${name}`
      await Filesystem.writeFile({ path, data: json, directory: Directory.Data, encoding: Encoding.UTF8, recursive: true })
      return { ok: true, canceled: false, path }
    },

    readAutosave: () => readText(AUTOSAVE_PATH),

    async writeAutosave(json) {
      try {
        await Filesystem.writeFile({
          path: AUTOSAVE_PATH,
          data: json,
          directory: Directory.Data,
          encoding: Encoding.UTF8,
          recursive: true,
        })
        return true
      } catch {
        return false
      }
    },

    async clearAutosave() {
      try {
        await Filesystem.deleteFile({ path: AUTOSAVE_PATH, directory: Directory.Data })
      } catch { /* nothing saved yet */ }
    },

    async allowQuit() { /* Android manages the app lifecycle */ },
    async decideClose() { return { ok: true } },
    notifyUiReady() { /* the native splash hides itself */ },

    async getPrivacyInfo() {
      return ANDROID_PRIVACY
    },
    // EULA acceptance persists in the WebView's localStorage (lib/legal).
    getEulaAcceptance: async () => null,
    setEulaAcceptance: async () => true,

    on: (channel, handler) => fallback.on(channel, handler),
  }
  return bridge
}
