# On-device AI

The assistant is a **local keyword parser** (`features/editor/command-parser.ts`) plus an
allowlisted command schema (`features/editor/commands/`). It is not an LLM.
Unknown phrases never become edits.

Pixel ops (denoise, background removal, upscale, …) run in `features/ai/workers/ai.worker.ts`.
Remove Background uses bundled **MODNet** (`public/models/modnet.onnx`) via
`onnxruntime-web` (WASM, on-device). If that model cannot load, Remove Background
fails with an error — it does not silently flood-fill.

Portrait Bokeh (`portrait-blur.ts`, `bokeh.ts`, `object-focus.ts`) locks one
focus plane, then disc-blurs everything else:

1. A usable selection mask, if the user marked an object.
2. MODNet, when the person matte actually isolates a subject.
3. A local object-focus mask (single-camera style) when there is no person.

MiDaS (`estimateDepthWithModel`) is still in the tree. The live Bokeh button
does not call it. Blur radius scales with the short side of the photo
(`phoneBlurRadius`). The sharp plane is pasted back from the original pixels.

Do not add cloud inference, GGUF runtimes, or NC-licensed ONNX weights without a
separate product decision and `THIRD_PARTY_NOTICES`.
