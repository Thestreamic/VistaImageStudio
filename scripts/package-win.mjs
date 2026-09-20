/**
 * Package Windows installers in %TEMP% so Cursor/Explorer locks on
 * dist/win-unpacked cannot fail electron-builder, then copy the .exe files
 * back into dist/.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(os.tmpdir(), 'vista-image-studio-pack')

try {
  fs.rmSync(out, { recursive: true, force: true })
} catch {
  /* previous pack still open — use a unique folder */
}
const packDir = fs.existsSync(out) ? `${out}-${Date.now()}` : out
fs.mkdirSync(packDir, { recursive: true })

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const result = spawnSync(
  npx,
  ['electron-builder', '--win', 'nsis', 'portable', '--x64', '--arm64', `--config.directories.output=${packDir}`],
  { cwd: root, stdio: 'inherit', shell: true },
)
if (result.status !== 0) process.exit(result.status ?? 1)

const dist = path.join(root, 'dist')
fs.mkdirSync(dist, { recursive: true })
const copied = []
for (const name of fs.readdirSync(packDir)) {
  if (!/\.exe$/i.test(name)) continue
  fs.copyFileSync(path.join(packDir, name), path.join(dist, name))
  copied.push(name)
  console.log(`[package-win] copied ${name}`)
}
if (!copied.length) {
  console.error(`[package-win] electron-builder produced no .exe in ${packDir}`)
  process.exit(1)
}
