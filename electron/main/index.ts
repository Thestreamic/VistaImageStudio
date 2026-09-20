import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  MenuItemConstructorOptions,
  net,
  protocol,
  session,
  shell,
} from 'electron'
import path from 'node:path'
import fs from 'node:fs/promises'
import fsSync from 'node:fs'
import { createWriteStream } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'

import { splashHtml } from '../splash'
import { exportSlideshowMp4 } from './video-export'

// ─── Constants ───────────────────────────────────────────────────────────────
const isDev = !app.isPackaged
const RENDERER_URL = isDev ? 'http://localhost:3000' : null
const RENDERER_SCHEME = 'lumen'
const ALLOWED_IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.avif', '.bmp', '.gif', '.tiff', '.tif', '.heic', '.heif', '.hif']

/** file:// cannot load Next's root-absolute /_next CSS. Serve the export as a real origin. */
protocol.registerSchemesAsPrivileged([
  {
    scheme: RENDERER_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
      allowServiceWorkers: true,
    },
  },
])

let mainWindow: BrowserWindow | null = null
let splashWindow: BrowserWindow | null = null
/** close/quit is blocked only while the renderer confirms unsaved work. */
let closePhase: 'idle' | 'confirming' | 'allowed' = 'idle'
let quitAfterClose = false
let bootFinished = false
const skipCloseConfirm = process.env.LUMEN_E2E === '1'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function autosaveFile() {
  return path.join(app.getPath('userData'), 'autosave', 'recovery.lumen')
}

async function atomicWrite(filePath: string, contents: string) {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  const tmp = `${filePath}.${process.pid}.tmp`
  await fs.writeFile(tmp, contents, 'utf8')
  try {
    await fs.unlink(filePath)
  } catch {
    /* first save */
  }
  await fs.rename(tmp, filePath)
}

// ─── App Singleton ────────────────────────────────────────────────────────────
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  }
})

// ─── Security Hardening ───────────────────────────────────────────────────────
app.on('web-contents-created', (_, contents) => {
  // Block navigation away from the renderer. A dropped image arrives as a
  // file:// (or sometimes a blob:) navigation — if we allow it, the editor
  // is replaced by the OS image viewer / a raw file tab and import never runs.
  contents.on('will-navigate', (e, url) => {
    const isDevApp = isDev && /^http:\/\/localhost:3000(\/|\?|#|$)/.test(url)
    const isPackagedApp = !isDev && url.startsWith(`${RENDERER_SCHEME}://`)
    if (isDevApp || isPackagedApp) return
    e.preventDefault()
    if (url.startsWith('https:') || url.startsWith('http:')) shell.openExternal(url)
  })

  // Block new window creation (open in system browser instead)
  contents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
})

// ─── CSP ─────────────────────────────────────────────────────────────────────
const CSP = [
  "default-src 'self'",
  // Next.js boots the client with inline <script> tags (and in dev, the HMR
  // client). A static export has no server pass to attach a nonce to them, so
  // blocking inline scripts here stops React from ever hydrating — the window
  // renders but nothing is interactive. Everything loaded is local.
  // 'unsafe-eval' is separately required by the ONNX wasm runtime.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "worker-src 'self' blob:",
  isDev
    ? "connect-src 'self' blob: data: http://localhost:3000 ws://localhost:3000 http://127.0.0.1:7255"
    : "connect-src 'self' blob: data:",
  "media-src 'self' blob: data:",
].join('; ')

app.whenReady().then(() => {
  if (!isDev) registerRendererProtocol()
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    // Drop any upstream CSP first: multiple policies intersect, so a leftover
    // header would silently re-impose the restrictions above.
    const responseHeaders = Object.fromEntries(
      Object.entries(details.responseHeaders ?? {}).filter(
        ([key]) => key.toLowerCase() !== 'content-security-policy',
      ),
    )
    callback({
      responseHeaders: { ...responseHeaders, 'Content-Security-Policy': [CSP] },
    })
  })
})

function rendererAlive(): boolean {
  return Boolean(mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed())
}

function beginCloseConfirm(quit: boolean) {
  if (quit) quitAfterClose = true
  if (closePhase === 'allowed' || skipCloseConfirm) {
    finishAllowedClose()
    return
  }
  if (closePhase === 'confirming') return
  closePhase = 'confirming'
  if (!rendererAlive() || mainWindow!.webContents.isCrashed()) {
    finishAllowedClose()
    return
  }
  mainWindow!.webContents.send('app:confirm-close')
  setTimeout(() => {
    if (closePhase !== 'confirming') return
    if (!rendererAlive() || mainWindow!.webContents.isCrashed()) finishAllowedClose()
  }, 4000)
}

function finishAllowedClose() {
  closePhase = 'allowed'
  const win = mainWindow
  setImmediate(() => {
    try {
      if (win && !win.isDestroyed()) win.close()
    } catch {
      /* already tearing down */
    }
    if (quitAfterClose || process.platform !== 'darwin') app.quit()
  })
}

function cancelCloseConfirm() {
  closePhase = 'idle'
  quitAfterClose = false
}

// ─── Window Creation ──────────────────────────────────────────────────────────
function packagedRendererRoot() {
  return path.resolve(path.join(__dirname, '../../out'))
}

const RENDERER_MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.onnx': 'application/octet-stream',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.txt': 'text/plain; charset=utf-8',
}

function registerRendererProtocol() {
  const root = packagedRendererRoot()
  protocol.handle(RENDERER_SCHEME, (request) => {
    let pathname = '/'
    try {
      pathname = decodeURIComponent(new URL(request.url).pathname)
    } catch {
      return new Response('Bad Request', { status: 400 })
    }
    if (!pathname || pathname === '/') pathname = '/index.html'
    else if (pathname.endsWith('/')) pathname += 'index.html'
    const fsPath = path.resolve(root, pathname.replace(/^[/\\]+/, ''))
    const rel = path.relative(root, fsPath)
    if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
      return new Response('Forbidden', { status: 403 })
    }
    return net
      .fetch(pathToFileURL(fsPath).href)
      .then((res) => {
        const mime = RENDERER_MIME[path.extname(fsPath).toLowerCase()]
        if (!mime) return res
        const headers = new Headers(res.headers)
        headers.set('Content-Type', mime)
        return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
      })
      .catch(() => new Response('Not Found', { status: 404 }))
  })
}

function appIconPath(): string | undefined {
  const candidates = [
    path.join(__dirname, '../../resources/icon.ico'),
    path.join(__dirname, '../../resources/icon.png'),
    path.join(__dirname, '../../out/app-icon.png'),
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(process.resourcesPath, 'icon.png'),
  ]
  return candidates.find((candidate) => fsSync.existsSync(candidate))
}

function createWindow() {
  createSplash()
  const icon = appIconPath()
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0e0f14',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'hidden',
    frame: process.platform !== 'win32',
    show: false,
    maximizable: true,
    fullscreenable: true,
    autoHideMenuBar: false,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
    },
  })

  void bootWindow(mainWindow)
  mainWindow.setMenuBarVisibility(true)

  mainWindow.on('close', (e) => {
    if (closePhase === 'allowed' || skipCloseConfirm) return
    e.preventDefault()
    beginCloseConfirm(false)
  })

  mainWindow.on('closed', () => { mainWindow = null })

  buildMenu()
}

function createSplash() {
  splashWindow = new BrowserWindow({
    width: 720,
    height: 440,
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    frame: false,
    show: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#0e0f14',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  splashWindow.setMenuBarVisibility(false)
  void splashWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(splashHtml))
  splashWindow.once('ready-to-show', () => {
    splashWindow?.center()
    splashWindow?.show()
    setSplashPhase(4, 22, 'Starting Vista Image Studio…')
    // Never leave this window up: Next.js compile must not park a fake 84% bar.
    setTimeout(() => finishSplash(), 3500)
  })
  splashWindow.on('closed', () => { splashWindow = null })
}

function setSplashPhase(floor: number, cap: number, text: string) {
  const win = splashWindow
  if (!win || win.isDestroyed()) return
  const payload = JSON.stringify(text)
  void win.webContents.executeJavaScript(
    `window.__setPhase && window.__setPhase(${floor}, ${cap}, ${payload})`,
  ).catch(() => { /* splash not ready */ })
}

function finishSplash() {
  if (bootFinished) return
  bootFinished = true
  const splash = splashWindow
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.maximize()
      mainWindow.show()
      mainWindow.focus()
    }
    if (splash && !splash.isDestroyed()) splash.close()
    splashWindow = null
    if (isDev && mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  }, 80)
}

async function bootWindow(win: BrowserWindow) {
  setSplashPhase(8, 28, 'Starting editor…')
  win.webContents.once('did-finish-load', () => finishSplash())
  win.webContents.once('dom-ready', () => finishSplash())

  if (RENDERER_URL) {
    setSplashPhase(18, 50, 'Starting editor…')
    await waitForRenderer(RENDERER_URL)
  }

  setSplashPhase(40, 70, 'Loading editor…')
  try {
    if (RENDERER_URL) {
      await win.loadURL(RENDERER_URL)
    } else {
      await win.loadURL(`${RENDERER_SCHEME}://app/index.html`)
    }
  } catch (error) {
    console.error('Editor failed to load', error)
  }
  finishSplash()
}

async function waitForRenderer(url: string) {
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(url)
      if (res.status < 500) return
    } catch {
      /* Next dev not up yet */
    }
    await delay(250)
  }
}

// ─── Native Menu ──────────────────────────────────────────────────────────────
function buildMenu() {
  const send = (ch: string) => mainWindow?.webContents.send(ch)

  const template: MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        { label: 'New Project', accelerator: 'CmdOrCtrl+N', click: () => send('menu:new-project') },
        { label: 'Open Image…', accelerator: 'CmdOrCtrl+O', click: () => send('menu:open') },
        { label: 'Open Project…', accelerator: 'CmdOrCtrl+Shift+O', click: () => send('menu:open-project') },
        { label: 'Save', accelerator: 'CmdOrCtrl+S', click: () => send('menu:save') },
        { label: 'Save As…', accelerator: 'CmdOrCtrl+Shift+S', click: () => send('menu:save-as') },
        { label: 'Close Project', accelerator: 'CmdOrCtrl+W', click: () => send('menu:close-project') },
        { type: 'separator' },
        { label: 'Print…', accelerator: 'CmdOrCtrl+P', click: () => send('menu:print') },
        { type: 'separator' },
        {
          label: process.platform === 'darwin' ? 'Quit' : 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => beginCloseConfirm(true),
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z', click: () => send('menu:undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', click: () => send('menu:redo') },
        { type: 'separator' },
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' },
      ],
    },
    {
      label: 'Image',
      submenu: [
        { label: 'Resize…', click: () => send('menu:resize') },
        { label: 'Rotate 90° CW', click: () => send('menu:rotate-cw') },
        { label: 'Rotate 90° CCW', click: () => send('menu:rotate-ccw') },
        { label: 'Flip Horizontal', click: () => send('menu:flip-h') },
        { label: 'Flip Vertical', click: () => send('menu:flip-v') },
        { type: 'separator' },
        { label: 'Auto Enhance', accelerator: 'CmdOrCtrl+Shift+A', click: () => send('menu:auto-enhance') },
        { label: 'Remove Background', click: () => send('menu:bg-remove') },
        { label: 'Denoise', click: () => send('menu:denoise') },
        { label: 'Upscale 2×', click: () => send('menu:upscale') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Fit to Screen', accelerator: 'CmdOrCtrl+0', click: () => send('menu:fit') },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', click: () => send('menu:zoom-in') },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: () => send('menu:zoom-out') },
        { label: 'Actual Pixels', accelerator: 'CmdOrCtrl+1', click: () => send('menu:zoom-100') },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        ...(isDev ? [{ role: 'toggleDevTools' as const }] : []),
      ],
    },
    {
      label: 'Window',
      submenu: [{ role: 'minimize' }, { role: 'zoom' }],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'About Vista Image Studio', click: () => send('menu:about') },
        { type: 'separator' },
        { label: 'End-User License Agreement', click: () => send('menu:eula') },
        { label: 'Privacy Policy', click: () => send('menu:privacy-policy') },
        { label: 'Third-party notices', click: () => send('menu:notices') },
      ],
    },
  ]

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.name,
      submenu: [
        { label: 'About Vista Image Studio', click: () => send('menu:about') },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { label: 'Quit', accelerator: 'Cmd+Q', click: () => beginCloseConfirm(true) },
      ],
    })
  }

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ─── IPC Handlers ─────────────────────────────────────────────────────────────

/** Open image file dialog → ArrayBuffer */
ipcMain.handle('fs:open-image', async () => {
  if (!mainWindow) return null
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Image',
    filters: [
      { name: 'Images', extensions: ALLOWED_IMAGE_EXTENSIONS.map(e => e.slice(1)) },
      { name: 'iPhone photos (HEIC)', extensions: ['heic', 'heif', 'hif'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  })
  if (canceled || filePaths.length === 0) return null
  const filePath = filePaths[0]
  const ext = path.extname(filePath).toLowerCase()
  if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
    throw new Error(`Unsupported file type: ${ext}`)
  }
  const buffer = await fs.readFile(filePath)
  return { name: path.basename(filePath), buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) }
})

/** Save image file dialog → path chosen or null */
ipcMain.handle('fs:save-image', async (_, { buffer, suggestedName }: { buffer: ArrayBuffer; suggestedName: string }) => {
  if (!mainWindow) return false
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Image',
    defaultPath: suggestedName,
    filters: [
      { name: 'PNG Image', extensions: ['png'] },
      { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
      { name: 'WebP Image', extensions: ['webp'] },
    ],
  })
  if (canceled || !filePath) return false
  await fs.writeFile(filePath, Buffer.from(buffer))
  return true
})

ipcMain.handle('fs:save-images', async (_, { files }: { files: { name: string; buffer: ArrayBuffer }[] }) => {
  if (!mainWindow) return false
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: 'Save export pack to folder',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (canceled || !filePaths[0]) return false
  const dir = filePaths[0]
  for (const file of files) {
    const safeName = path.basename(file.name).replace(/[\\/]/g, '_')
    await fs.writeFile(path.join(dir, safeName), Buffer.from(file.buffer))
  }
  return true
})

ipcMain.handle('fs:open-project', async () => {
  if (!mainWindow) return null
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Project',
    filters: [{ name: 'Vista Image Studio Project', extensions: ['lumen'] }],
    properties: ['openFile'],
  })
  if (canceled || !filePaths[0]) return null
  const filePath = filePaths[0]
  const json = await fs.readFile(filePath, 'utf8')
  return { name: path.basename(filePath), json, path: filePath }
})

ipcMain.handle('fs:open-project-path', async (_, filePath: string) => {
  if (typeof filePath !== 'string' || !filePath.endsWith('.lumen')) return null
  if (filePath.includes('..')) return null
  const resolved = path.resolve(filePath)
  const json = await fs.readFile(resolved, 'utf8')
  return { name: path.basename(resolved), json, path: resolved }
})

ipcMain.handle(
  'fs:save-project',
  async (
    _,
    { json, suggestedName, existingPath }: { json: string; suggestedName: string; existingPath?: string | null },
  ) => {
    if (!mainWindow) return { ok: false, canceled: true, path: null }
    let filePath = existingPath || ''
    if (!filePath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Save Project',
        defaultPath: suggestedName.endsWith('.lumen') ? suggestedName : `${suggestedName}.lumen`,
        filters: [{ name: 'Vista Image Studio Project', extensions: ['lumen'] }],
      })
      if (result.canceled || !result.filePath) return { ok: false, canceled: true, path: null }
      filePath = result.filePath.endsWith('.lumen') ? result.filePath : `${result.filePath}.lumen`
    }
    await atomicWrite(filePath, json)
    return { ok: true, canceled: false, path: filePath }
  },
)

ipcMain.handle('fs:read-autosave', async () => {
  try {
    return await fs.readFile(autosaveFile(), 'utf8')
  } catch {
    return null
  }
})

ipcMain.handle('fs:write-autosave', async (_, json: string) => {
  if (typeof json !== 'string' || json.length > 32 * 1024 * 1024) return false
  await atomicWrite(autosaveFile(), json)
  return true
})

ipcMain.handle('fs:clear-autosave', async () => {
  try {
    await fs.unlink(autosaveFile())
  } catch { /* none */ }
})

ipcMain.handle('app:privacy-info', async () => {
  const userData = app.getPath('userData')
  return {
    host: 'electron',
    platform: process.platform,
    csp: "connect-src 'self' blob: data:",
    analytics: 'off',
    modelsFolder: path.join(process.resourcesPath, 'models'),
    userDataPath: userData,
    autosavePath: path.join(userData, 'autosave', 'recovery.lumen'),
    connectSrc: isDev
      ? "'self' blob: data: http://localhost:3000 ws://localhost:3000"
      : "'self' blob: data:",
  }
})

function eulaAcceptanceFile() {
  return path.join(app.getPath('userData'), 'eula-acceptance.json')
}

function parseEulaRecord(raw: unknown): { timestamp: string; eulaVersion: string; userAgent?: string } | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  if (typeof rec.timestamp !== 'string' || !rec.timestamp.trim()) return null
  if (typeof rec.eulaVersion !== 'string' || !rec.eulaVersion.trim()) return null
  if (Number.isNaN(Date.parse(rec.timestamp))) return null
  const out: { timestamp: string; eulaVersion: string; userAgent?: string } = {
    timestamp: rec.timestamp,
    eulaVersion: rec.eulaVersion.trim(),
  }
  if (typeof rec.userAgent === 'string' && rec.userAgent.trim()) out.userAgent = rec.userAgent
  return out
}

ipcMain.handle('app:eula-get', async () => {
  try {
    const raw = await fs.readFile(eulaAcceptanceFile(), 'utf8')
    return parseEulaRecord(JSON.parse(raw))
  } catch {
    return null
  }
})

ipcMain.handle('app:eula-set', async (_e, payload: unknown) => {
  const record = parseEulaRecord(payload)
  if (!record) return false
  const json = JSON.stringify(record)
  if (json.length > 8 * 1024) return false
  await atomicWrite(eulaAcceptanceFile(), json)
  return true
})

ipcMain.handle('app:close-decision', async (_e, decision: unknown) => {
  if (decision === 'cancel') {
    cancelCloseConfirm()
    return { ok: true }
  }
  finishAllowedClose()
  return { ok: true }
})

ipcMain.handle('app:allow-quit', async () => {
  finishAllowedClose()
})

ipcMain.handle('video:export-mp4', async (_, payload) => exportSlideshowMp4(mainWindow, payload ?? {}))

/** Get host/GPU info */
ipcMain.handle('app:host-info', async () => {
  const gpuInfo = await app.getGPUInfo('basic').catch(() => ({ auxAttributes: {} })) as Record<string, unknown>
  const aux = (gpuInfo.auxAttributes as Record<string, unknown>) ?? {}
  const gpuName = String(aux.glRenderer ?? aux.glVendor ?? 'Unknown GPU')
  return {
    host: 'electron' as const,
    platform: process.platform,
    arch: process.arch,
    electronVersion: process.versions.electron,
    nodeVersion: process.versions.node,
    gpuName,
    backend: 'wasm' as const, // Electron renderer uses WASM ONNX
    userDataPath: app.getPath('userData'),
    autosavePath: path.join(app.getPath('userData'), 'autosave', 'recovery.lumen'),
    modelsPath: path.join(process.resourcesPath, 'models'),
  }
})

/** Open URL in system browser */
ipcMain.handle('app:open-external', async (_, url: string) => {
  if (typeof url === 'string' && (url.startsWith('https:') || url.startsWith('http:'))) {
    await shell.openExternal(url)
    return true
  }
  return false
})

/** Window controls (for custom title bar on Windows) */
ipcMain.on('app:ui-ready', () => finishSplash())
ipcMain.on('win:minimize', () => mainWindow?.minimize())
ipcMain.on('win:maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.restore()
  else mainWindow?.maximize()
})
ipcMain.on('win:close', () => mainWindow?.close())

// ─── App Lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(createWindow)

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', (e) => {
  if (closePhase === 'allowed' || skipCloseConfirm) return
  e.preventDefault()
  beginCloseConfirm(true)
})
