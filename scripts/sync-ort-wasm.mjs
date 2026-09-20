/**
 * Copy onnxruntime-web WASM glue into public/ort so the worker can load it
 * from a real URL. Next/Turbopack rewrites the package import to
 * /_next/static/media/ort-wasm-simd-threaded.mjs but never emits that file.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const srcDir = path.join(root, 'node_modules', 'onnxruntime-web', 'dist')
const destDir = path.join(root, 'public', 'ort')

const files = ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']

if (!fs.existsSync(srcDir)) {
  console.warn('[sync-ort] onnxruntime-web dist not found — skip')
  process.exit(0)
}

fs.mkdirSync(destDir, { recursive: true })
for (const name of files) {
  const from = path.join(srcDir, name)
  if (!fs.existsSync(from)) {
    console.warn(`[sync-ort] missing ${name}`)
    continue
  }
  const to = path.join(destDir, name)
  fs.copyFileSync(from, to)
  const bytes = fs.statSync(to).size
  console.log(`[sync-ort] ${name} (${bytes} bytes)`)
}
