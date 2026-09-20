/**
 * Write original CC0 instrumental beds into public/music.
 * No downloads. No third-party samples. Regenerates only when files are missing.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dest = path.join(root, 'public', 'music')
const tracksDir = path.join(dest, 'tracks')
const catalogPath = path.join(root, 'features', 'music', 'catalogue.json')
const SAMPLE_RATE = 22050
const DURATION_SEC = 18

const LICENSE = 'CC0-1.0'
const LICENSE_URL = 'https://creativecommons.org/publicdomain/zero/1.0/'

function midiHz(midi) {
  return 440 * 2 ** ((midi - 69) / 12)
}

function hashId(id) {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619)
  return h >>> 0
}

function env(t, a, h, r, len) {
  if (t < 0) return 0
  if (t < a) return t / a
  if (t < a + h) return 1
  const tail = t - a - h
  if (tail > r || t > len) return 0
  return Math.max(0, 1 - tail / r)
}

function noise(i, seed) {
  const x = Math.sin(i * 12.9898 + seed * 78.233) * 43758.5453
  return (x - Math.floor(x)) * 2 - 1
}

function renderTrack(spec, seed) {
  const n = SAMPLE_RATE * DURATION_SEC
  const samples = new Float32Array(n)
  const rootMidi = spec.root
  const bpm = spec.bpm
  const beat = 60 / bpm
  const pent = [0, 2, 4, 7, 9]
  const kind = spec.kind

  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE
    const fade =
      Math.min(1, t / 0.8) * Math.min(1, (DURATION_SEC - t) / 1.5)
    let v = 0

    const bassHz = midiHz(rootMidi - 12)
    v += 0.18 * Math.sin(2 * Math.PI * bassHz * t) * (0.65 + 0.35 * Math.sin(2 * Math.PI * t / 6))

    if (kind === 'drone' || kind === 'strings' || kind === 'pad-pluck') {
      for (const det of [-0.08, 0, 0.11]) {
        const hz = midiHz(rootMidi) * (1 + det / 12)
        v += 0.09 * Math.sin(2 * Math.PI * hz * t + seed * 0.01)
        v += 0.05 * Math.sin(2 * Math.PI * hz * 1.5 * t)
      }
    }

    const step = Math.floor(t / (beat * (kind === 'pulse' ? 0.5 : 1)))
    const degree = pent[(step * 3 + (seed % 5)) % pent.length]
    const melHz = midiHz(rootMidi + degree + (kind === 'pluck' || kind === 'pulse' ? 12 : 0))
    const local = t % (beat * (kind === 'pulse' ? 0.5 : 1))
    const pluck = env(local, 0.01, 0.04, kind === 'keys' ? 0.55 : 0.22, beat)
    if (kind === 'pluck' || kind === 'pad-pluck' || kind === 'keys' || kind === 'pulse') {
      v += 0.16 * Math.sin(2 * Math.PI * melHz * t) * pluck
    }
    if (kind === 'strings') {
      v += 0.12 * Math.sin(2 * Math.PI * midiHz(rootMidi + 7) * t) * (0.5 + 0.5 * Math.sin(t * 0.7))
    }
    if (kind === 'pulse' || kind === 'upbeat') {
      const hat = env(t % (beat / 2), 0.002, 0.01, 0.04, beat / 2)
      v += 0.04 * noise(i, seed) * hat
    }

    samples[i] = Math.max(-1, Math.min(1, v * fade * 0.85))
  }
  return samples
}

function encodeWav(samples) {
  const dataSize = samples.length * 2
  const buf = Buffer.alloc(44 + dataSize)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataSize, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20)
  buf.writeUInt16LE(1, 22)
  buf.writeUInt32LE(SAMPLE_RATE, 24)
  buf.writeUInt32LE(SAMPLE_RATE * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataSize, 40)
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(Math.round(samples[i] * 32767), 44 + i * 2)
  }
  return buf
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
if (!Array.isArray(catalog.tracks) || catalog.tracks.length < 20 || catalog.tracks.length > 30) {
  throw new Error('catalogue.json must list 20–30 tracks')
}

fs.mkdirSync(tracksDir, { recursive: true })
fs.mkdirSync(path.join(dest, 'LICENSES'), { recursive: true })

const force = process.env.FORCE_MUSIC === '1'
const manifestTracks = []
let wrote = 0

for (const spec of catalog.tracks) {
  const file = `tracks/${spec.id}.wav`
  const out = path.join(dest, file)
  if (force || !fs.existsSync(out) || fs.statSync(out).size < 50_000) {
    const wav = encodeWav(renderTrack(spec, hashId(spec.id)))
    fs.writeFileSync(out, wav)
    wrote += 1
  }
  manifestTracks.push({
    id: spec.id,
    title: spec.title,
    file,
    license: LICENSE,
    license_url: LICENSE_URL,
    source_url: LICENSE_URL,
    verified_date: catalog.verified_date,
    composer: catalog.composer,
    category: spec.category,
    mood: spec.mood,
    duration_ms: DURATION_SEC * 1000,
  })
}

const cc0 = `Creative Commons CC0 1.0 Universal

These instrumental tracks are original works created for Vista Image Studio
and dedicated to the public domain under CC0 1.0.

  ${LICENSE_URL}

You may copy, modify, distribute, perform, and use them commercially,
including inside this application and in videos you export, with no
attribution required and no further permission needed.

No third-party samples or copyrighted recordings were used.
`
fs.writeFileSync(path.join(dest, 'LICENSES', 'CC0-1.0.txt'), cc0)
fs.writeFileSync(
  path.join(dest, 'manifest.json'),
  JSON.stringify(
    {
      license: LICENSE,
      license_url: LICENSE_URL,
      composer: catalog.composer,
      verified_date: catalog.verified_date,
      note: catalog.note,
      tracks: manifestTracks,
    },
    null,
    2,
  ),
)

const bytes = manifestTracks.reduce((sum, t) => {
  try {
    return sum + fs.statSync(path.join(dest, t.file)).size
  } catch {
    return sum
  }
}, 0)
console.log(
  `[generate-cc0-music] ${manifestTracks.length} tracks, wrote ${wrote}, ${(bytes / (1024 * 1024)).toFixed(1)} MB WAV`,
)
