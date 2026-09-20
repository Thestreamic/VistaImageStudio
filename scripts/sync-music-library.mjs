/**
 * Copy Vistora-Music-Library if present; otherwise generate the bundled CC0 beds.
 * Runtime never fetches music — this is build/dev only.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dest = path.join(root, 'public', 'music')

function resolveSource() {
  const env = process.env.VISTORA_MUSIC_LIBRARY
  if (env && fs.existsSync(path.join(env, 'manifest.json'))) return path.resolve(env)
  const sibling = path.resolve(root, '..', 'Vistora-Music-Library')
  if (fs.existsSync(path.join(sibling, 'manifest.json'))) return sibling
  return null
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true })
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const src = path.join(from, entry.name)
    const out = path.join(to, entry.name)
    if (entry.isDirectory()) copyDir(src, out)
    else fs.copyFileSync(src, out)
  }
}

function countTracks(manifestPath) {
  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    const tracks = Array.isArray(raw) ? raw : raw.tracks
    return Array.isArray(tracks) ? tracks.length : 0
  } catch {
    return 0
  }
}

const src = resolveSource()
fs.mkdirSync(dest, { recursive: true })

if (src) {
  for (const name of ['manifest.json', 'tracks', 'LICENSES', 'README.md']) {
    const from = path.join(src, name)
    if (!fs.existsSync(from)) continue
    const to = path.join(dest, name)
    const st = fs.statSync(from)
    if (st.isDirectory()) copyDir(from, to)
    else fs.copyFileSync(from, to)
  }
  console.log(`[sync-music] copied from ${src} (${countTracks(path.join(dest, 'manifest.json'))} tracks)`)
  process.exit(0)
}

const gen = spawnSync(process.execPath, [path.join(root, 'scripts', 'generate-cc0-music.mjs')], {
  cwd: root,
  stdio: 'inherit',
  env: process.env,
})
if (gen.status !== 0) {
  console.warn('[sync-music] CC0 generator failed — public/music may stay empty.')
  process.exit(0)
}
console.log(`[sync-music] bundled CC0 library (${countTracks(path.join(dest, 'manifest.json'))} tracks)`)
