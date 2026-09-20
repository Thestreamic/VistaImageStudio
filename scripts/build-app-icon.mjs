/**
 * Rasterize the studio mark into Windows .ico + PNG sizes used by Electron.
 * Source of truth: resources/icon.png (1024) or the generated 1024 asset.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const resources = path.join(root, 'resources')
const publicDir = path.join(root, 'public')
fs.mkdirSync(resources, { recursive: true })
fs.mkdirSync(publicDir, { recursive: true })

const sourceCandidates = [
  path.join(resources, 'icon.png'),
  path.join(
    process.env.USERPROFILE || '',
    '.cursor/projects/c-Users-AFF-Computers-Downloads-lumen-studio/assets/vista-app-icon-1024.png',
  ),
  path.join(root, 'assets/vista-app-icon-1024.png'),
]

function findSource() {
  for (const candidate of sourceCandidates) {
    if (candidate && fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

function resizePng(src, dest, size) {
  const srcEsc = src.replace(/'/g, "''")
  const destEsc = dest.replace(/'/g, "''")
  const ps = `
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Image]::FromFile('${srcEsc}')
$bmp = New-Object System.Drawing.Bitmap ${size}, ${size}
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)
$g.DrawImage($src, 0, 0, ${size}, ${size})
$bmp.Save('${destEsc}', [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose(); $src.Dispose()
`.trim()
  execFileSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'inherit' })
}

function pngsToIco(entries, dest) {
  const count = entries.length
  const headerSize = 6 + 16 * count
  let offset = headerSize
  const chunks = []
  for (const entry of entries) {
    chunks.push({ ...entry, offset, size: entry.buf.length })
    offset += entry.buf.length
  }
  const out = Buffer.alloc(offset)
  out.writeUInt16LE(0, 0)
  out.writeUInt16LE(1, 2)
  out.writeUInt16LE(count, 4)
  let dir = 6
  for (const chunk of chunks) {
    out.writeUInt8(chunk.sizePx >= 256 ? 0 : chunk.sizePx, dir)
    out.writeUInt8(chunk.sizePx >= 256 ? 0 : chunk.sizePx, dir + 1)
    out.writeUInt8(0, dir + 2)
    out.writeUInt8(0, dir + 3)
    out.writeUInt16LE(1, dir + 4)
    out.writeUInt16LE(32, dir + 6)
    out.writeUInt32LE(chunk.size, dir + 8)
    out.writeUInt32LE(chunk.offset, dir + 12)
    chunk.buf.copy(out, chunk.offset)
    dir += 16
  }
  fs.writeFileSync(dest, out)
}

const source = findSource()
if (!source) {
  console.error('[build-app-icon] missing 1024 source PNG')
  process.exit(1)
}

const icon1024 = path.join(resources, 'icon.png')
if (path.resolve(source) !== path.resolve(icon1024)) fs.copyFileSync(source, icon1024)
fs.copyFileSync(icon1024, path.join(publicDir, 'app-icon.png'))

const sizes = [16, 24, 32, 48, 64, 128, 256]
const icoEntries = []
for (const size of sizes) {
  const dest = path.join(resources, `icon-${size}.png`)
  resizePng(icon1024, dest, size)
  icoEntries.push({ sizePx: size, buf: fs.readFileSync(dest) })
  if (size === 32) {
    fs.copyFileSync(dest, path.join(publicDir, 'icon-dark-32x32.png'))
    fs.copyFileSync(dest, path.join(publicDir, 'icon-light-32x32.png'))
  }
}

pngsToIco(icoEntries, path.join(resources, 'icon.ico'))
for (const size of sizes) {
  const dest = path.join(resources, `icon-${size}.png`)
  if (size !== 32 && fs.existsSync(dest)) fs.unlinkSync(dest)
}
console.log('[build-app-icon] wrote resources/icon.ico and public/app-icon.png')
