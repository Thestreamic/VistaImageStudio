/**
 * Copy ffmpeg-static into resources/ffmpeg for electron-builder extraResources.
 * Missing binary is not a build failure — video export then reports unavailable.
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const destDir = path.join(root, 'resources', 'ffmpeg')
fs.mkdirSync(destDir, { recursive: true })

let bin = null
try {
  bin = createRequire(import.meta.url)('ffmpeg-static')
} catch {
  bin = null
}

if (!bin || !fs.existsSync(bin)) {
  console.warn('[prepare-ffmpeg] ffmpeg-static not installed — MP4 export will be unavailable until it is.')
  process.exit(0)
}

const name = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
const dest = path.join(destDir, name)
fs.copyFileSync(bin, dest)
try {
  fs.chmodSync(dest, 0o755)
} catch {
  /* windows */
}
console.log(`[prepare-ffmpeg] ${dest}`)
