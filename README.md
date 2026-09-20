# Vista Image Studio

A local-first, privacy-first photo editor. Layers, non-destructive crop,
looks with intensity, a versioned `.lumen` project file, and AI tools
(background removal, denoise, upscaling, face enhance) run entirely
on-device — no cloud calls, no telemetry, no account required.

Built with Electron + Next.js/React + Zustand. See
[`docs/ARCHITECTURE-AND-CONCEPT.txt`](docs/ARCHITECTURE-AND-CONCEPT.txt)
(full product/engineering spec),
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md),
[`docs/PRIVACY.md`](docs/PRIVACY.md),
[`docs/PROJECT_SCHEMA.md`](docs/PROJECT_SCHEMA.md),
[`docs/AI.md`](docs/AI.md),
and [`docs/ROADMAP.md`](docs/ROADMAP.md).

**Put the site online, or build the Windows .exe / .appx:** see [`START-HERE.txt`](START-HERE.txt) in this folder.

## Getting started

```bash
pnpm install
pnpm dev              # renderer only, in a browser tab, for fast UI iteration
pnpm dev:electron     # full desktop app with hot reload
```

## Building

```bash
pnpm run package        # Windows (NSIS + portable), current arch defaults
pnpm run package:mac    # macOS (dmg + zip)
pnpm run package:linux  # Linux (AppImage + deb)
pnpm run package:dir    # unpacked dir only, fastest — for local verification
```

## Testing

```bash
pnpm test              # unit tests (Vitest)
pnpm test:coverage      # with coverage report
pnpm test:e2e           # Playwright end-to-end smoke tests
pnpm typecheck          # renderer + electron main/preload
```

## Project layout

```
electron/         Main process + preload (Node-side, IPC, native menu, .lumen I/O)
lib/platform/      Host abstraction — Electron vs. browser bridge
features/editor/   Core image engine + Zustand store + project/commands/recipes
features/ai/       AI algorithms (CPU fallback + optional ONNX models),
                    Web Worker host, promise-based client
components/editor/ React UI: canvas stage, toolbar, panels, chrome
docs/              Architecture, privacy, project schema, release checklist, FEATURES.txt, landing HTML
tests/             Vitest unit tests + Playwright e2e specs
```
