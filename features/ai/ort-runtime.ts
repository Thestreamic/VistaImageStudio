/**
 * Load onnxruntime-web with WASM files served from /ort/.
 *
 * Next/Turbopack rewrites ORT’s dynamic import to
 * `/_next/static/media/ort-wasm-simd-threaded.mjs`, which 404s. Pointing
 * `env.wasm.wasmPaths` at the copied public assets avoids that.
 */
import { absolutePublicHref } from '@/lib/public-url'

export type OrtWasm = {
  env: { wasm: { proxy: boolean; numThreads: number; wasmPaths: string } }
  Tensor: typeof import('onnxruntime-web').Tensor
  InferenceSession: typeof import('onnxruntime-web').InferenceSession
}

function unwrapOrt(mod: unknown): OrtWasm {
  const rec = mod as OrtWasm & { default?: OrtWasm }
  if (rec?.env && rec.Tensor && rec.InferenceSession) return rec
  if (rec?.default?.env && rec.default.Tensor && rec.default.InferenceSession) return rec.default
  throw new Error('onnxruntime-web wasm bundle is missing env/InferenceSession')
}

/** Absolute href for a public/ file so workers do not resolve against a blob: URL. */
export function resolvePublicHref(path: string): string {
  return absolutePublicHref(path)
}

export function resolveOrtWasmPrefix(): string {
  const href = resolvePublicHref('/ort/')
  return href.endsWith('/') ? href : `${href}/`
}

let loading: Promise<OrtWasm> | null = null

export async function loadOrtWasm(): Promise<OrtWasm> {
  if (loading) return loading
  loading = (async () => {
    const prefix = resolveOrtWasmPrefix()
    const ort = unwrapOrt(await import('onnxruntime-web/wasm'))
    ort.env.wasm.proxy = false
    ort.env.wasm.numThreads = 1
    ort.env.wasm.wasmPaths = prefix
    return ort
  })()
  try {
    return await loading
  } catch (err) {
    loading = null
    throw err
  }
}
