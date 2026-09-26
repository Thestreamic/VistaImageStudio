# Vista Image Studio — Architecture

Local-first AI photo editor. Electron shell + Next.js/React renderer. No
network calls are required for any editing or AI operation — everything
runs on-device.

Handover date: 24 September 2026. Read this file, then `docs/FEATURES.txt`
and `docs/AI.md`. Do not rename `.lumen`, `lumen-project`, or `window.lumen`.

## Handover (current facts)

- Product: Vista Image Studio 0.1.0. Working copy:
  `C:\Users\AFF Computers\Downloads\lumen-studio` (no git remote).
  Live Pages source: `C:\Users\AFF Computers\Documents\GitHub\VistaImageStudio\VistaImageStudio`
  → `https://github.com/Thestreamic/VistaImageStudio` `main`.
- Live site: `https://vistaimagestudio.thestreamic.in` at `/`.
  `BASE_PATH` must stay empty. A `/VistaImageStudio` base path 404s CSS.
- No cloud photo upload, no account, no LLM. CSP `connect-src 'self' blob: data:`.
- EULA gate before the editor (`vista-eula-accepted`, version `2026-09-25`).
  Ireland law. Help → About, Privacy, Notices.
- Media bin: Zustand `recentImports` + IndexedDB `vista-media-library`.
  Click opens `canvasToOpenFromImport` (cached canvas, cloned). A JPEG copy
  is stored so refresh can decode. After EULA accept, if there is no
  document, the last Media item is opened automatically.
- Portrait Bokeh live path is **not** MiDaS. The approved look is locked.
  Parameters, how to apply it, and the Background f-stop control are in
  **Locked Portrait Bokeh** below. A file backup of the locked sources is
  `C:\Users\AFF Computers\Downloads\vista-lock-web-exe-2026-09-25`.
- Magic Eraser: no selection arms `select-wand` (click the object). A drag
  under 4px is a wand click. LaMa fills the mask. Progress overlay.
- Music is built and hidden. To show Choose music again, follow
  `docs/MUSIC.md`: set `MUSIC_UI_ENABLED` in `features/music/offer.ts` to
  `true`, then rebuild. Web mux is `web-slideshow.ts`; the Windows app uses
  FFmpeg. No extra music repo.
- Mobile chrome at 767px (`useMobileLayout`). Desktop title bar otherwise.
- `replaceLayerPixels` clones the canvas so an AI result does not share
  pixels with the Media cache.

## Process model

```
┌─────────────────────────────────────────────────────────────┐
│ Electron Main Process (Node.js)                              │
│  electron/main/index.ts                                      │
│  - BrowserWindow lifecycle, native menu, file dialogs         │
│  - IPC handlers: fs:open-image, fs:save-image, fs:save-project, app:host-info  │
│  - CSP headers, single-instance lock, external-link handling  │
└───────────────────────────┬───────────────────────────────────┘
                             │ contextBridge (IPC, allowlisted channels)
┌───────────────────────────▼───────────────────────────────────┐
│ Preload (isolated world)                                       │
│  electron/preload/index.ts                                     │
│  - Exposes window.lumen: typed, minimal surface only            │
│  - contextIsolation: true, nodeIntegration: false, sandbox: true│
└───────────────────────────┬───────────────────────────────────┘
                             │ window.lumen
┌───────────────────────────▼───────────────────────────────────┐
│ Renderer (Next.js static export, React 19)                     │
│                                                                  │
│  lib/platform/bridge.ts    — host abstraction (Electron | Web) │
│  features/editor/          — core image engine + store          │
│    engine/{adjustments,curves,transforms,compositor,selection}  │
│    store/editor-store.ts   — Zustand: single source of truth    │
│  features/ai/               — AI feature layer                  │
│    algorithms/*             — pure CPU implementations           │
│    workers/ai.worker.ts     — off-main-thread execution          │
│    ai-client.ts             — promise API + progress callback    │
│  components/editor/        — UI: canvas stage, panels, chrome   │
└─────────────────────────────────────────────────────────────────┘
```

## Why this split

**Main process owns the OS.** File dialogs, native menu, and window
management live in `electron/main`. It never touches image pixels — that
keeps the privileged process small and easy to audit.

**Preload is the only bridge.** `contextIsolation: true` + `sandbox: true`
means the renderer cannot reach Node or Electron APIs directly. Everything
crosses through `window.lumen`, a small typed object with an explicit
channel allowlist (see `RENDERER_TO_MAIN_CHANNELS` / `MAIN_TO_RENDERER_CHANNELS`
in `preload/index.ts`). This is the standard Electron security posture
recommended by the Electron team, applied deliberately rather than left to
defaults.

**The renderer doesn't know which host it's in.** `lib/platform/bridge.ts`
exposes one `LumenBridge` interface with two implementations — an Electron
one (via `window.lumen`) and a browser fallback (`<input type=file>` +
anchor download). Every other module calls `getBridge()`; none of them
branch on `isElectron()`. This is what makes the same codebase runnable as
a Next.js dev server for fast iteration and as a packaged desktop app.

## Core image engine

Everything works on `HTMLCanvasElement` so pixels never leave the renderer
process and never need serialisation to disk mid-edit.

- **`types.ts`** — the document model: `DocumentState → Layer[] → Adjustments`,
  plus live `crop`, look intensity, and watermark overlay layers.
- **`project/`** — `.lumen` JSON schema, migrate, validate (no remote URLs), serialize.
- **`engine/curves.ts`** — monotone cubic (Fritsch–Carlson) interpolation
  of curve control points into a 256-entry LUT. Monotone interpolation is
  deliberate: natural cubic splines overshoot near steep control points,
  which shows up as banding/clipping artefacts at the tonal extremes.
- **`engine/adjustments.ts`** — folds exposure, brightness, contrast,
  temperature, tint, highlights/shadows/whites/blacks and curves into
  per-channel LUTs (`buildAdjustmentLuts`). Saturation and vibrance run
  per-pixel; sharpness is a light unsharp pass.
- **`engine/compositor.ts`** — renders a `DocumentState` to a canvas,
  caching each layer's *adjusted* bitmap keyed by an adjustments hash so
  dragging one layer's slider never reprocesses the others.
- **`engine/transforms.ts`** — crop/resize/rotate90/flip, operating on the
  whole document (all layers scaled/rotated together, offsets preserved).
- **`engine/selection.ts`** — rectangle and magic-wand (flood fill)
  selection, plus combine (`replace`/`add`/`subtract`), invert, dilate, and
  bounds/coverage queries. A `Selection` is a `{ width, height, mask }`
  where mask is 0..255 coverage — a soft mask, not a boolean one, so
  selections can be feathered.

## State management

`features/editor/store/editor-store.ts` is a single Zustand store. Design
choices:

- **Immutable snapshots for undo/redo.** `commit(next)` pushes the
  *previous* `DocumentState` onto `past` and clears `future`. Because
  layers hold canvas references (not copies) until actually mutated,
  history entries are cheap — most of a `DocumentState` is structurally
  shared between undo steps.
- **Transactions for continuous input.** Slider drags call the setter with
  `commit=false` on every `input` event (so the canvas updates live) and
  `commit=true` once on `mouseup` — one history entry per drag, not one
  per pixel of slider travel. `beginTransaction`/`endTransaction` exist for
  the same pattern where a single `set()` call per step doesn't fit (e.g.
  interactive crop).
- **`renderVersion` as a dirty flag.** Adjustments mutate layer data
  in-place from the compositor's point of view (new canvas, but the store
  doesn't necessarily get a brand-new `doc` object on every intermediate
  drag frame in some flows), so a monotonically increasing counter is the
  signal the canvas stage subscribes to, decoupled from object identity.

## AI feature layer

**Design principle:** most CPU ops have a heuristic fallback. **Remove Background
requires bundled MODNet** — `segmentWithModel` throws if the ONNX cannot run
(no silent flood-fill). Portrait Bokeh tries MODNet, then a local object mask.
Upscale / smart-select still fall back.

| Feature | Model-backed path | Fallback (always available) |
|---|---|---|
| Auto color | — | grey-world white balance + histogram stretch + S-curve (`auto-color.ts`) |
| Background removal | MODNet photographic portrait matting (`public/models/modnet.onnx`) | None on the live path (heuristic kept for tests / `local-enhance` only) |
| Portrait Bokeh | MODNet person matte when it isolates a subject | Selection mask, else `object-focus.ts`. Disc blur in `bokeh.ts`. MiDaS is not the live button. Centre of the Background slider is the locked look. |

## Locked Portrait Bokeh (25 September 2026)

This is the look approved for the web app and the Windows exe. Do not change
`BACKGROUND_DISC`, `PORTRAIT_DISC`, `SUBJECT_SHARPNESS`, or the default
strength `0.84`. Those live in `features/ai/algorithms/bokeh.ts`.

A copy of the sources that produce this look, taken before the Background
slider, is at `C:\Users\AFF Computers\Downloads\vista-lock-web-exe-2026-09-25`
(`LOCK.txt` lists the same numbers). Restore by copying those files back
over the same paths. The app-repo commit of this look, before the slider,
is `0ee4026`.

### How to apply

1. Open a photo.
2. Optionally select the subject. With no selection, Portrait Bokeh uses a
   MODNet person matte when that matte isolates someone, otherwise the local
   object mask in `features/ai/algorithms/object-focus.ts`.
3. Leave **Background** at the centre (`f/2 locked`) for the approved look,
   or move it as described under Manual disc.
4. Click **Portrait Bokeh**. The click applies the current disc. Dragging
   the slider does not reprocess the photo.

`resolveFocusMatte` in `portrait-blur.ts` picks the matte. `depthFromAlphaMatte`
builds depth, then `applyBokehFit` blurs. The subject is pasted back with
`compositeSubject`, and a 10% unsharp runs on those pixels only. The worker
op is `portrait-blur` (`ai.worker.ts`), called from `ai-client.ts`. MiDaS is
not on this button.

The working image is at most 1440 px on the long GPU path and 800 px on the
CPU path. The disc is a fraction of the short side, so that downsample does
not shrink the blur back to a few pixels.

### Locked parameters

| Parameter | Value | What it does |
|---|---|---|
| `BACKGROUND_DISC` | `1.24 × 1.2 × 1.05` = **1.5624** | Openings stacked on the base disc (24%, then 20%, then 5%) |
| `PORTRAIT_DISC` | `0.018 × BACKGROUND_DISC` ≈ **0.0281232** | Disc as a fraction of the short side, before strength |
| strength | **0.84** | Default argument of `phoneBlurRadius` |
| strength factor | `0.82 + 0.18 × 0.84` = **0.9712** | Scales the disc at the locked strength |
| effective disc | ≈ **2.73%** of the short side | `edge × PORTRAIT_DISC × 0.9712` |
| `phoneBlurRadius` | 800 → **22** px, 1600 → **44** px, 4000 → **109** px | Approved radius at strength 0.84 |
| `SUBJECT_SHARPNESS` | **0.1** | Unsharp amount, radius 1, threshold 2, subject pixels only |
| `subjectThreshold` | **0.58** | Depth at or above this stays fully sharp |
| `depthGamma` | **1.45** | Near background stays more readable than the far field |
| `highlightThreshold` | **0.78** | Bright points that can become soft orbs |
| `highlightGain` | **1.35** | How hard those points are lifted before the disc |
| `samples` | **28** | Samples inside the disc |
| GPU / CPU edge | **1440** / **800** | Longest side of the working image |

Depth curve in `backgroundDepthMap`: `bgFar = smoothstep(0.04, 0.75, dist)`,
`far = 0.64 + 0.26 × bgFar + 0.06 × yFar`, `depth = 1 − min(0.9, far)`.
Disc sample weight is `1 + smoothstep(0.82, 1, luma) × 0.85`.

`phoneBlurRadius(edge)` clamps
`edge × PORTRAIT_DISC × (0.82 + 0.18 × strength)`.

### Manual disc

The **Background** slider on the AI panel sits on the locked look. It does
not replace it.

| Slider | Label | Disc scale | Effect |
|---|---|---|---|
| 0 | f/4.0 | × 0.75 | A bit more background focus |
| 50 | f/2 locked | × 1.00 | The approved look |
| 100 | f/1.4 | × 1.25 | A bit more background blur |

The f-number is the control label, in the same sense as iPhone Portrait
f-stop and Pixel blur amount. It does not change exposure. Scale is linear
between those three points (`discScaleFromFocus`). `blurRadiusForDisc`
returns `phoneBlurRadius(edge, 0.84)` at 50.

`clampBokehRadius` caps at `edge × PORTRAIT_DISC × 1.25`, so the right end
of the slider is not clipped back to the lock. The default call still
returns the approved radius.

`AiPanel` keeps `discFocus` (default 50) and passes it to
`aiClient.portraitBlur`. An explicit `maxBlurRadius` still wins over the
slider.
| Denoise | — | bilateral filter + light re-sharpen (`enhance.ts`) |
| Upscale | ESRGAN-lite, tiled inference | bicubic resample + unsharp mask (`upscale.ts`) |
| Face enhance | — | YCbCr skin mask + selective bilateral smooth (`enhance.ts`) |
| Smart select | MobileSAM (planned, see roadmap) | Lab-space flood fill from seed (`smart-select.ts`) |
| Object removal | LaMa ONNX when `public/models/lama.onnx` is present | multi-scale diffusion inpainting (`inpaint.ts`) |

**Everything expensive runs in a Web Worker.** `features/ai/workers/ai.worker.ts`
hosts every algorithm; `ai-client.ts` is the main-thread promise wrapper
that transfers (not copies) the pixel `ArrayBuffer` both directions, so a
denoise pass on a 24MP image doesn't drop a single UI frame. Progress
reports (`{ id, progress, detail }`) flow back over the same channel for
indeterminate or percentage-based progress UI.

## Security

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` on
  the `BrowserWindow` — the renderer has no Node access under any
  circumstance, scripting bugs included.
- Preload exposes an **allowlist**, not a passthrough: unrecognised IPC
  channel names are rejected with a console warning rather than silently
  forwarded.
- `will-navigate` and `setWindowOpenHandler` are locked down — the only
  in-app navigation allowed is to `localhost:3000` (dev) or the packaged
  `file://` bundle; every other URL opens in the system browser instead of
  inside the app's webContents.
- A `Content-Security-Policy` header is set on every response
  (`default-src 'self'`), with `worker-src 'self' blob:` and
  `connect-src 'self' blob: data:` scoped narrowly for the AI worker and
  in-memory image data — never opened to arbitrary remote origins.
- File dialogs are the *only* filesystem entry point; the main process
  validates the extension against an allowlist before reading, and image
  bytes are handed to the renderer as an `ArrayBuffer`, never a raw path.
- `webSecurity: true`, single-instance lock, and a `Content-Security-Policy`
  on the packaged build turns off remote-content loading entirely — this
  is a fully offline app.

## Build & packaging

- **Dev**: `next dev` (renderer, hot reload) + `tsc -p electron -w`
  (main/preload, watch-compiled to `dist-electron/`) + Electron launched
  once both are ready (`wait-on`).
- **Package**: `next build` with `output: 'export'` (static HTML/JS, no
  Node server needed at runtime) → `tsc -p electron` → `electron-builder`.
  See `electron-builder.yml` for per-platform targets (NSIS + portable on
  Windows, dmg/zip on macOS, AppImage/deb on Linux). `build-exe.bat` and
  `build-appx.bat` both use that file.
- The installer contains `out/`, `dist-electron/`, `package.json`, production
  dependencies, and `extraResources` (models, music, ffmpeg, icons, notices).
  It does not contain `docs/`, `tests/`, `scripts/`, `electron/` source,
  `.github/`, `Git/`, logs, or markdown. Legal text in the app comes from
  `lib/legal`, which the Next build already compiles into `out/`.
- ONNX model files are optional and excluded from `asar` packing
  (`asarUnpack`) so they can be swapped without rebuilding the archive.
