# Roadmap

## Shipped in this build

- Core image engine: layers, non-destructive adjustments (including
  tint/highlights/shadows/whites/blacks/vibrance/sharpness), monotone-cubic
  curves, live crop + optional bake, resize/rotate/flip, blend modes,
  opacity, undo/redo with transaction batching.
- Versioned `.lumen` projects: Save / Save As / Open, dirty flag, quit
  prompt, atomic write, autosave, recents.
- Looks with 0–100 intensity and neutral names (Punch, Natural Mobile, …).
- Logo/handle overlay layers, creator export pack with size estimates and
  `{name}-{preset}` templates. Canvas export drops camera EXIF.
- Local command chat with an allowlisted schema and Apply/Cancel.
- Privacy Centre, first-run walkthrough, local recipes, folder batch export.
- Electron shell: native menu, secure IPC (contextBridge + allowlist),
  file open/save dialogs, CSP, single-instance lock, custom Windows
  titlebar.
- Tooling: electron-builder config for Windows/macOS/Linux, Vitest unit
  tests, Playwright e2e (including offline renderer smoke), GitHub Actions CI.

## Near-term (next milestone)

- **MODNet portrait matting** bundled for Remove Background and Portrait Bokeh
  (`public/models/modnet.onnx`, Apache-2.0, see `THIRD_PARTY_NOTICES`).
- **Wire rectangle / magic-wand selection** (tools are hidden until they
  work).
- **DirectML execution provider on Windows** for GPU-accelerated inference
  where available — `InferenceBackend` already has a `directml` variant.

## Mid-term

- Curves per-layer presets (save/load a curve shape).
- History panel (visual undo stack).
- `.cube` 3D LUT import.
- RAW file support (libraw via a native Node addon or WASM port).

## Longer-term / exploratory

- Plugin API for third-party filters/AI models.
- Cloud sync as an *opt-in* addition — the core promise (fully local,
  works offline, no telemetry) must never regress.
- GPU compute path via WebGPU compute shaders for the CPU-fallback
  algorithms.
- Auto-update channel via electron-builder's publish providers (currently
  `publish: null`).

## Explicitly out of scope for now

- Any code path that phones home by default.
- Bundled LLM / GGUF assistants.
- Native RAW decoding without a vetted, licensed library.
- Publishing GitHub Releases without an explicit go-ahead.
