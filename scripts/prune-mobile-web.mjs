/**
 * Android (Tier 1) ships without ML models. `next build` copies everything in
 * public/ into out-mobile/, so remove the model, runtime and music assets the
 * mobile app never loads: ~320 MB down to ~5 MB of app code.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'out-mobile')

if (!fs.existsSync(path.join(out, 'index.html'))) {
  console.error('[prune-mobile-web] out-mobile/index.html missing. Run the mobile export first.')
  process.exit(1)
}

// models: MODNet / LaMa / MiDaS (Tier 2+). ort: onnxruntime-web WASM.
// music: photo-video soundtracks (video export is not in Tier 1).
// VistaImageStudio: GitHub project-pages alias, web only.
const PRUNE = ['models', 'ort', 'music', 'VistaImageStudio']

function dirSize(dir) {
  let total = 0
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    total += entry.isDirectory() ? dirSize(p) : fs.statSync(p).size
  }
  return total
}

for (const name of PRUNE) {
  const target = path.join(out, name)
  if (!fs.existsSync(target)) continue
  const mb = dirSize(target) / 1024 / 1024
  fs.rmSync(target, { recursive: true, force: true })
  console.log(`[prune-mobile-web] removed ${name}/ (${mb.toFixed(1)} MB)`)
}

console.log(`[prune-mobile-web] out-mobile is ${(dirSize(out) / 1024 / 1024).toFixed(1)} MB`)
