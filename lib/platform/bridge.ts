/**
 * Platform bridge: the single seam between the renderer and the host.
 *
 * In Electron the preload script exposes `window.lumen` through contextBridge;
 * in the browser we fall back to <input type=file> and anchor downloads.
 * Nothing else in the app knows which host it is running in.
 */

import { IMAGE_FILE_ACCEPT } from '@/lib/image/canvas'

export type InferenceBackend = 'directml' | 'webgpu' | 'wasm' | 'cpu'

export interface HostInfo {
  host: 'electron' | 'web'
  platform: string
  arch?: string
  electronVersion?: string
  nodeVersion?: string
  backend: InferenceBackend
  gpuName?: string
  userDataPath?: string
  autosavePath?: string
  modelsPath?: string
}

export interface OpenedFile {
  name: string
  blob: Blob
}

export interface OpenedProject {
  name: string
  json: string
  path: string | null
}

export interface SaveProjectResult {
  ok: boolean
  canceled: boolean
  path: string | null
}

export interface PrivacyInfo {
  host: 'electron' | 'web'
  platform: string
  csp: string
  analytics: 'off'
  modelsFolder: string
  userDataPath: string
  autosavePath: string
  connectSrc: string
}

export interface LumenBridge {
  getHostInfo(): Promise<HostInfo>
  openImage(): Promise<OpenedFile | null>
  saveImage(blob: Blob, suggestedName: string): Promise<boolean>
  saveImages(files: { blob: Blob; name: string }[]): Promise<boolean>
  openProject(): Promise<OpenedProject | null>
  openProjectPath?(filePath: string): Promise<OpenedProject | null>
  saveProject(json: string, suggestedName: string, existingPath?: string | null): Promise<SaveProjectResult>
  readAutosave(): Promise<string | null>
  writeAutosave(json: string): Promise<boolean>
  clearAutosave(): Promise<void>
  allowQuit(): Promise<void>
  decideClose?(decision: 'allow' | 'cancel'): Promise<{ ok: boolean }>
  notifyUiReady?(): void
  getPrivacyInfo(): Promise<PrivacyInfo>
  getEulaAcceptance?(): Promise<{ timestamp: string; eulaVersion: string; userAgent?: string } | null>
  setEulaAcceptance?(record: { timestamp: string; eulaVersion: string; userAgent?: string }): Promise<boolean>
  exportVideoMp4?(payload: {
    frames: { name: string; buffer: ArrayBuffer }[]
    holdSec?: number
    musicId?: string | null
    suggestedName?: string
    width?: number
    height?: number
  }): Promise<{ ok: boolean; canceled?: boolean; error?: string }>
  on(channel: string, handler: (...args: unknown[]) => void): () => void
  openExternal?(url: string): Promise<boolean>
  minimize?(): void
  maximize?(): void
  close?(): void
}

declare global {
  interface Window {
    lumen?: {
      getHostInfo(): Promise<HostInfo>
      openImage(): Promise<{ name: string; buffer: ArrayBuffer } | null>
      saveImage(buffer: ArrayBuffer, suggestedName: string): Promise<boolean>
      saveImages?(files: { buffer: ArrayBuffer; name: string }[]): Promise<boolean>
      openProject?(): Promise<OpenedProject | null>
      openProjectPath?(filePath: string): Promise<OpenedProject | null>
      saveProject?(json: string, suggestedName: string, existingPath?: string | null): Promise<SaveProjectResult>
      readAutosave?(): Promise<string | null>
      writeAutosave?(json: string): Promise<boolean>
      clearAutosave?(): Promise<void>
      allowQuit?(): Promise<void>
      decideClose?(decision: 'allow' | 'cancel'): Promise<{ ok: boolean }>
      notifyUiReady?(): void
      getPrivacyInfo?(): Promise<PrivacyInfo>
      getEulaAcceptance?(): Promise<{ timestamp: string; eulaVersion: string; userAgent?: string } | null>
      setEulaAcceptance?(record: { timestamp: string; eulaVersion: string; userAgent?: string }): Promise<boolean>
      exportVideoMp4?(payload: {
        frames: { name: string; buffer: ArrayBuffer }[]
        holdSec?: number
        musicId?: string | null
        suggestedName?: string
        width?: number
        height?: number
      }): Promise<{ ok: boolean; canceled?: boolean; error?: string }>
      on(channel: string, handler: (...args: unknown[]) => void): () => void
      openExternal?(url: string): Promise<boolean>
      minimize?(): void
      maximize?(): void
      close?(): void
    }
  }
}

async function detectWebBackend(): Promise<{ backend: InferenceBackend; gpuName?: string }> {
  if (typeof navigator === 'undefined') return { backend: 'cpu' }
  const nav = navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }
  if (nav.gpu) {
    try {
      const adapter = (await nav.gpu.requestAdapter()) as
        | { info?: { device?: string; vendor?: string } }
        | null
      if (adapter) {
        const name = adapter.info?.device || adapter.info?.vendor
        return { backend: 'webgpu', gpuName: name || undefined }
      }
    } catch { /* fall through */ }
  }
  return { backend: typeof WebAssembly !== 'undefined' ? 'wasm' : 'cpu' }
}

const _webListeners = new Map<string, Set<(...args: unknown[]) => void>>()
const AUTOSAVE_KEY = 'vista-autosave'

const WEB_PRIVACY: PrivacyInfo = {
  host: 'web',
  platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown',
  csp: "connect-src 'self' blob: data:",
  analytics: 'off',
  modelsFolder: '(not bundled — local heuristics only)',
  userDataPath: 'browser localStorage',
  autosavePath: 'localStorage:vista-autosave',
  connectSrc: "'self' blob: data:",
}

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.position = 'fixed'
    input.style.left = '-9999px'
    input.style.width = '1px'
    input.style.height = '1px'
    input.style.opacity = '0'
    const finish = (file: File | null) => {
      input.remove()
      resolve(file)
    }
    input.onchange = () => finish(input.files?.[0] ?? null)
    input.oncancel = () => finish(null)
    document.body.appendChild(input)
    input.click()
  })
}

const webBridge: LumenBridge = {
  async getHostInfo() {
    const gpu = await detectWebBackend()
    return { host: 'web', platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown', ...gpu }
  },
  openImage() {
    return pickFile(IMAGE_FILE_ACCEPT).then((file) => (file ? { name: file.name, blob: file } : null))
  },
  async saveImage(blob, suggestedName) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = suggestedName
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return true
  },
  async saveImages(files) {
    const picker = (window as Window & {
      showDirectoryPicker?: () => Promise<{
        getFileHandle: (name: string, opts: { create: boolean }) => Promise<{
          createWritable: () => Promise<{ write: (d: Blob) => Promise<void>; close: () => Promise<void> }>
        }>
      }>
    }).showDirectoryPicker
    if (picker) {
      try {
        const dir = await picker()
        for (const file of files) {
          const handle = await dir.getFileHandle(file.name.replace(/[\\/]/g, '_'), { create: true })
          const writable = await handle.createWritable()
          await writable.write(file.blob)
          await writable.close()
        }
        return true
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return false
      }
    }
    for (const file of files) {
      await webBridge.saveImage(file.blob, file.name)
    }
    return true
  },
  async openProject() {
    const file = await pickFile('.lumen,application/json')
    if (!file) return null
    return { name: file.name, json: await file.text(), path: null }
  },
  async saveProject(json, suggestedName) {
    const blob = new Blob([json], { type: 'application/json' })
    await webBridge.saveImage(blob, suggestedName.endsWith('.lumen') ? suggestedName : `${suggestedName}.lumen`)
    return { ok: true, canceled: false, path: null }
  },
  async readAutosave() {
    try {
      return localStorage.getItem(AUTOSAVE_KEY)
    } catch {
      return null
    }
  },
  async writeAutosave(json) {
    try {
      localStorage.setItem(AUTOSAVE_KEY, json)
      return true
    } catch {
      return false
    }
  },
  async clearAutosave() {
    try {
      localStorage.removeItem(AUTOSAVE_KEY)
    } catch { /* ignore */ }
  },
  async allowQuit() { /* browser has nothing to quit */ },
  async decideClose() { return { ok: true } },
  notifyUiReady() { /* web splash waits on React complete */ },
    async getPrivacyInfo() {
      return { ...WEB_PRIVACY, platform: typeof navigator !== 'undefined' ? navigator.platform : 'unknown' }
    },
    async getEulaAcceptance() {
      return null
    },
    async setEulaAcceptance() {
      return true
    },
  on(channel, handler) {
    if (!_webListeners.has(channel)) _webListeners.set(channel, new Set())
    _webListeners.get(channel)!.add(handler)
    return () => _webListeners.get(channel)?.delete(handler)
  },
}

function makeElectronBridge(): LumenBridge {
  const e = window.lumen!
  return {
    getHostInfo: () => e.getHostInfo(),
    async openImage() {
      const result = await e.openImage()
      if (!result) return null
      return { name: result.name, blob: new Blob([result.buffer]) }
    },
    async saveImage(blob, suggestedName) {
      const buffer = await blob.arrayBuffer()
      return e.saveImage(buffer, suggestedName)
    },
    async saveImages(files) {
      if (e.saveImages) {
        const packed = await Promise.all(
          files.map(async (file) => ({ name: file.name, buffer: await file.blob.arrayBuffer() })),
        )
        return e.saveImages(packed)
      }
      for (const file of files) {
        const buffer = await file.blob.arrayBuffer()
        const ok = await e.saveImage(buffer, file.name)
        if (!ok) return false
      }
      return true
    },
    async openProject() {
      if (e.openProject) return e.openProject()
      return webBridge.openProject()
    },
    async openProjectPath(filePath) {
      if (e.openProjectPath) return e.openProjectPath(filePath)
      return null
    },
    async saveProject(json, suggestedName, existingPath) {
      if (e.saveProject) return e.saveProject(json, suggestedName, existingPath)
      return webBridge.saveProject(json, suggestedName, existingPath)
    },
    async readAutosave() {
      if (e.readAutosave) return e.readAutosave()
      return webBridge.readAutosave()
    },
    async writeAutosave(json) {
      if (e.writeAutosave) return e.writeAutosave(json)
      return webBridge.writeAutosave(json)
    },
    async clearAutosave() {
      if (e.clearAutosave) return e.clearAutosave()
      return webBridge.clearAutosave()
    },
    async allowQuit() {
      if (e.allowQuit) return e.allowQuit()
    },
    async decideClose(decision) {
      if (e.decideClose) return e.decideClose(decision)
      if (decision === 'allow' && e.allowQuit) await e.allowQuit()
      return { ok: true }
    },
    notifyUiReady() {
      e.notifyUiReady?.()
    },
    async getPrivacyInfo() {
      if (e.getPrivacyInfo) return e.getPrivacyInfo()
      return WEB_PRIVACY
    },
    async getEulaAcceptance() {
      if (e.getEulaAcceptance) return e.getEulaAcceptance()
      return null
    },
    async setEulaAcceptance(record) {
      if (e.setEulaAcceptance) return e.setEulaAcceptance(record)
      return true
    },
    exportVideoMp4(payload) {
      if (e.exportVideoMp4) return e.exportVideoMp4(payload)
      return Promise.resolve({ ok: false, error: 'MP4 export is desktop-only.' })
    },
    on: e.on.bind(e),
    openExternal: e.openExternal?.bind(e),
    minimize: e.minimize?.bind(e),
    maximize: e.maximize?.bind(e),
    close: e.close?.bind(e),
  }
}

let _bridge: LumenBridge | null = null

export function getBridge(): LumenBridge {
  if (!_bridge) {
    _bridge = typeof window !== 'undefined' && window.lumen ? makeElectronBridge() : webBridge
  }
  return _bridge
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!window.lumen
}
