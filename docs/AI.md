# On-device AI

The assistant is a **local keyword parser** (`features/editor/command-parser.ts`) plus an
allowlisted command schema (`features/editor/commands/`). It is not an LLM.
Unknown phrases never become edits.

Pixel ops (denoise, background removal, upscale, …) run in `features/ai/workers/ai.worker.ts`.
Background removal and Portrait Bokeh use bundled **MODNet** (`public/models/modnet.onnx`)
via `onnxruntime-web` (WASM, on-device). If the model cannot load, the op fails
with an error — it does not silently flood-fill.

Do not add cloud inference, GGUF runtimes, or NC-licensed ONNX weights without a
separate product decision and `THIRD_PARTY_NOTICES`.
