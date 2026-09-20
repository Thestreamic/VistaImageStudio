/**
 * Close a running packaged app so electron-builder can replace dist/win-unpacked.
 * Windows keeps d3dcompiler_47.dll locked while Vista Image Studio.exe is open.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const unpacked = ['win-unpacked', 'win-arm64-unpacked', 'win-ia32-unpacked'].map((name) =>
  path.join(root, 'dist', name),
)

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

if (process.platform === 'win32') {
  try {
    execFileSync('taskkill', ['/IM', 'Vista Image Studio.exe', '/F'], { stdio: 'ignore' })
    console.log('[unlock-dist] closed running Vista Image Studio.exe')
  } catch {
    /* not running */
  }
}

await sleep(800)

for (const dir of unpacked) {
  if (!fs.existsSync(dir)) continue
  let lastErr
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
      lastErr = null
      break
    } catch (err) {
      lastErr = err
      await sleep(400 * attempt)
    }
  }
  if (lastErr) {
    console.warn(`[unlock-dist] ${dir} is still in use (${lastErr instanceof Error ? lastErr.message : lastErr})`)
    console.warn('[unlock-dist] packaging will use a fresh folder instead.')
  } else {
    console.log(`[unlock-dist] removed ${path.relative(root, dir)}`)
  }
}
