/**
 * Download on-device ONNX weights into public/models/.
 * Runtime CSP is connect-src 'self', so these cannot be fetched from the
 * network while the editor is running — they must be local first.
 *
 *   midas-small.onnx  Intel MiDaS v2.1 small (~64MB, MIT)
 *   modnet.onnx       MODNet photographic portrait matting (~25MB, Apache-2.0)
 *   lama.onnx         Carve/LaMa-ONNX lama_fp32.onnx (~208MB, Apache-2.0)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const destDir = path.join(root, 'public', 'models')

const MODELS = [
  {
    name: 'midas-small.onnx',
    url: 'https://github.com/isl-org/MiDaS/releases/download/v2_1/model-small.onnx',
    minBytes: 40 * 1024 * 1024,
    label: 'MiDaS v2.1 small (~64MB)',
    required: false,
  },
  {
    name: 'modnet.onnx',
    url: 'https://huggingface.co/DavG25/modnet-pretrained-models/resolve/main/models/modnet_photographic_portrait_matting.onnx?download=true',
    minBytes: 10 * 1024 * 1024,
    label: 'MODNet photographic (~25MB)',
    required: true,
  },
  {
    name: 'lama.onnx',
    url: 'https://huggingface.co/Carve/LaMa-ONNX/resolve/main/lama_fp32.onnx?download=true',
    minBytes: 80 * 1024 * 1024,
    label: 'LaMa lama_fp32 (~208MB)',
    required: true,
  },
]

const isStrict =
  process.env.STRICT_MODELS === '1' || process.env.CI === 'true' || process.env.WEB_EXPORT === '1'
const RETRIES = 3

fs.mkdirSync(destDir, { recursive: true })

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function requestHeaders() {
  const headers = {
    'User-Agent': 'vista-image-studio-model-sync/1.0',
    Accept: 'application/octet-stream, */*',
  }
  const token = process.env.HF_TOKEN || process.env.HUGGING_FACE_HUB_TOKEN
  if (token) headers.Authorization = `Bearer ${token}`
  return headers
}

async function downloadOnce(url, dest, minBytes, label) {
  if (fs.existsSync(dest) && fs.statSync(dest).size >= minBytes) {
    console.log(`[sync-models] present ${path.basename(dest)} (${fs.statSync(dest).size} bytes)`)
    return
  }
  console.log(`[sync-models] downloading ${label}…`)
  const res = await fetch(url, { redirect: 'follow', headers: requestHeaders() })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status} ${res.statusText}`)
  const tmp = `${dest}.part`
  const out = fs.createWriteStream(tmp)
  const reader = res.body.getReader()
  let written = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      out.write(Buffer.from(value))
      written += value.byteLength
      if (written === value.byteLength || written % (16 * 1024 * 1024) < value.byteLength) {
        console.log(`[sync-models] ${path.basename(dest)} ${(written / (1024 * 1024)).toFixed(1)} MB`)
      }
    }
  } finally {
    await new Promise((resolve, reject) => {
      out.end((err) => (err ? reject(err) : resolve()))
    })
  }
  if (written < minBytes) {
    fs.unlinkSync(tmp)
    throw new Error(`download too small (${written} bytes)`)
  }
  fs.renameSync(tmp, dest)
  console.log(`[sync-models] saved ${dest} (${written} bytes)`)
}

async function download(url, dest, minBytes, label) {
  let lastErr
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      await downloadOnce(url, dest, minBytes, label)
      return
    } catch (err) {
      lastErr = err
      try {
        if (fs.existsSync(`${dest}.part`)) fs.unlinkSync(`${dest}.part`)
      } catch {
        // ignore leftover part file
      }
      console.warn(
        `[sync-models] attempt ${attempt}/${RETRIES} failed for ${path.basename(dest)}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      if (attempt < RETRIES) await sleep(1500 * attempt)
    }
  }
  throw lastErr
}

const missingRequired = []
for (const model of MODELS) {
  try {
    await download(model.url, path.join(destDir, model.name), model.minBytes, model.label)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (model.required && isStrict) {
      missingRequired.push(`${model.name} (${msg})`)
      console.error(`[sync-models] required model missing: ${model.name}: ${msg}`)
    } else {
      console.warn(`[sync-models] skipped ${model.name}: ${msg}`)
    }
  }
}

if (missingRequired.length) {
  console.error(
    `[sync-models] Background Remover / Magic Eraser need these files in public/models:\n  - ${missingRequired.join('\n  - ')}`,
  )
  process.exit(1)
}
