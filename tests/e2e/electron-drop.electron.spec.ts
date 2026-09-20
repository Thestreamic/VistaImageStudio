import { test, expect, _electron as electron, type ElectronApplication } from '@playwright/test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { eulaAcceptanceFilePayload } from './legal-init'

/**
 * Browser-tab tests can only dispatch synthetic DragEvents, which skips the
 * parts of the real path that actually break: Chromium's requirement that
 * `dragover` be cancelled, and Electron's own window-level drop handling.
 * These drive the packaged main process and inject a true OS-level drag
 * through CDP instead.
 */

const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

let app: ElectronApplication

test.beforeAll(async () => {
  const mainEntry = path.join(process.cwd(), 'dist-electron', 'main', 'index.js')
  if (!fs.existsSync(mainEntry)) {
    throw new Error(`Missing ${mainEntry}. Run "npx tsc -p electron" first.`)
  }
  // Its own user-data dir, or the app's single-instance lock makes this
  // process quit immediately whenever a real copy is already running.
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vista-e2e-'))
  fs.writeFileSync(
    path.join(userDataDir, 'eula-acceptance.json'),
    JSON.stringify(eulaAcceptanceFilePayload()),
  )
  app = await electron.launch({
    args: ['.', `--user-data-dir=${userDataDir}`],
    cwd: process.cwd(),
    env: { ...process.env, NODE_ENV: 'development', LUMEN_E2E: '1' },
  })
})

test.afterAll(async () => {
  await app?.close()
})

test('dropping a file onto the Electron window imports it', async () => {
  const page = await app.firstWindow()
  page.on('pageerror', (e) => console.log(`[renderer:error] ${e.message}`))
  // data-ready only flips once React hydrates, which a too-strict CSP in the
  // main process silently prevents — the window renders, nothing responds.
  await page.waitForSelector('[data-testid="editor-shell"][data-ready="true"][data-eula-accepted="true"]')
  await expect(page.getByText('Drag & drop a photo')).toBeVisible()

  const filePath = path.join(os.tmpdir(), `vista-drop-${Date.now()}.png`)
  fs.writeFileSync(filePath, Buffer.from(PNG_BASE64, 'base64'))

  const cdp = await app.context().newCDPSession(page)
  const box = await page.getByTestId('editor-shell').boundingBox()
  if (!box) throw new Error('editor shell has no layout box')
  const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const data = { items: [], files: [filePath], dragOperationsMask: 1 }

  await cdp.send('Input.dispatchDragEvent', { type: 'dragEnter', ...point, data })
  await cdp.send('Input.dispatchDragEvent', { type: 'dragOver', ...point, data })
  await cdp.send('Input.dispatchDragEvent', { type: 'drop', ...point, data })

  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 10_000 })
  fs.rmSync(filePath, { force: true })
})
