// onnxruntime-web ships types at 'onnxruntime-web/types' but its package.json
// "exports" map doesn't resolve them for the default `onnxruntime-web`
// specifier under our TS module resolution. We only ever touch a tiny corner
// of its API (session creation + tensor construction) behind a try/catch
// fallback, so a minimal ambient module is safer than fighting resolution.
declare module 'onnxruntime-web' {
  export class Tensor {
    constructor(type: string, data: Float32Array | Uint8Array, dims: number[])
    data: Float32Array | Uint8Array
  }
  export namespace InferenceSession {
    function create(
      modelUrl: string,
      options?: { executionProviders?: string[] },
    ): Promise<{
      inputNames: string[]
      outputNames: string[]
      run(feeds: Record<string, unknown>): Promise<Record<string, { data: Float32Array | Uint8Array }>>
    }>
  }
}
