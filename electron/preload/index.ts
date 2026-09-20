/**
 * Preload script: the only surface that bridges main↔renderer.
 * contextIsolation=true means this runs in a separate JS world;
 * nothing in the renderer can access Node APIs directly.
 */
import { contextBridge, ipcRenderer } from 'electron'

/** Mirrors HostInfo in lib/platform/bridge.ts (kept in sync manually — this
 *  file must compile standalone under the electron/ tsconfig, which is
 *  isolated from the renderer's rootDir). */
export interface HostInfo {
  host: 'electron' | 'web'
  platform: string
  arch?: string
  electronVersion?: string
  nodeVersion?: string
  backend: 'directml' | 'webgpu' | 'wasm' | 'cpu'
  gpuName?: string
}

// Allowed IPC channels (allowlist = defence in depth)
const RENDERER_TO_MAIN_CHANNELS = new Set([
  'fs:open-image',
  'fs:save-image',
  'fs:save-images',
  'fs:open-project',
  'fs:open-project-path',
  'fs:save-project',
  'fs:read-autosave',
  'fs:write-autosave',
  'fs:clear-autosave',
  'app:host-info',
  'app:privacy-info',
  'app:eula-get',
  'app:eula-set',
  'app:open-external',
  'app:allow-quit',
  'app:close-decision',
  'app:ui-ready',
  'video:export-mp4',
  'win:minimize',
  'win:maximize',
  'win:close',
])

const MAIN_TO_RENDERER_CHANNELS = new Set([
  'menu:open',
  'menu:new-project',
  'menu:open-project',
  'menu:save',
  'menu:save-as',
  'menu:close-project',
  'menu:print',
  'menu:export',
  'menu:undo',
  'menu:redo',
  'menu:resize',
  'menu:rotate-cw',
  'menu:rotate-ccw',
  'menu:flip-h',
  'menu:flip-v',
  'menu:auto-enhance',
  'menu:bg-remove',
  'menu:denoise',
  'menu:upscale',
  'menu:fit',
  'menu:zoom-in',
  'menu:zoom-out',
  'menu:zoom-100',
  'menu:about',
  'menu:eula',
  'menu:privacy-policy',
  'menu:notices',
  'app:before-quit',
  'app:confirm-close',
])

/** Serialisable return value from fs:open-image */
export interface OpenedFileData {
  name: string
  buffer: ArrayBuffer
}

const lumen = {
  // ─── Host info ──────────────────────────────────────────────────────────
  getHostInfo: (): Promise<HostInfo> =>
    ipcRenderer.invoke('app:host-info'),

  // ─── File I/O ────────────────────────────────────────────────────────────
  openImage: (): Promise<OpenedFileData | null> =>
    ipcRenderer.invoke('fs:open-image'),

  saveImage: (buffer: ArrayBuffer, suggestedName: string): Promise<boolean> =>
    ipcRenderer.invoke('fs:save-image', { buffer, suggestedName }),

  saveImages: (files: { name: string; buffer: ArrayBuffer }[]): Promise<boolean> =>
    ipcRenderer.invoke('fs:save-images', { files }),

  openProject: (): Promise<{ name: string; json: string; path: string | null } | null> =>
    ipcRenderer.invoke('fs:open-project'),

  openProjectPath: (filePath: string): Promise<{ name: string; json: string; path: string | null } | null> =>
    ipcRenderer.invoke('fs:open-project-path', filePath),

  saveProject: (
    json: string,
    suggestedName: string,
    existingPath?: string | null,
  ): Promise<{ ok: boolean; canceled: boolean; path: string | null }> =>
    ipcRenderer.invoke('fs:save-project', { json, suggestedName, existingPath }),

  readAutosave: (): Promise<string | null> => ipcRenderer.invoke('fs:read-autosave'),
  writeAutosave: (json: string): Promise<boolean> => ipcRenderer.invoke('fs:write-autosave', json),
  clearAutosave: (): Promise<void> => ipcRenderer.invoke('fs:clear-autosave'),
  allowQuit: (): Promise<void> => ipcRenderer.invoke('app:allow-quit'),
  decideClose: (decision: 'allow' | 'cancel'): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke('app:close-decision', decision),
  notifyUiReady: () => ipcRenderer.send('app:ui-ready'),
  getPrivacyInfo: () => ipcRenderer.invoke('app:privacy-info'),
  getEulaAcceptance: () => ipcRenderer.invoke('app:eula-get'),
  setEulaAcceptance: (record: { timestamp: string; eulaVersion: string; userAgent?: string }) =>
    ipcRenderer.invoke('app:eula-set', record),

  exportVideoMp4: (payload: unknown) => ipcRenderer.invoke('video:export-mp4', payload),

  openExternal: (url: string): Promise<boolean> =>
    ipcRenderer.invoke('app:open-external', url),

  // ─── Window controls (Windows custom titlebar) ───────────────────────────
  minimize: () => ipcRenderer.send('win:minimize'),
  maximize: () => ipcRenderer.send('win:maximize'),
  close: () => ipcRenderer.send('win:close'),

  // ─── Menu events → renderer ──────────────────────────────────────────────
  on: (channel: string, handler: (...args: unknown[]) => void) => {
    if (!MAIN_TO_RENDERER_CHANNELS.has(channel)) {
      console.warn(`[preload] Blocked unrecognised channel: ${channel}`)
      return () => {}
    }
    const wrapped = (_event: Electron.IpcRendererEvent, ...args: unknown[]) =>
      handler(...args)
    ipcRenderer.on(channel, wrapped)
    return () => ipcRenderer.removeListener(channel, wrapped)
  },
}

contextBridge.exposeInMainWorld('lumen', lumen)

export type LumenAPI = typeof lumen
