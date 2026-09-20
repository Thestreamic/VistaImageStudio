# Privacy

Vista Image Studio is local-first.

- **No account, no telemetry, no photo upload API** in the app.
- Production CSP `connect-src` is `'self' blob: data:` (dev also allows the Next.js HMR websocket).
- Pixels live on `HTMLCanvasElement` in the renderer. AI runs in a Web Worker.
- Command chat stores **text only** (no pixels, no file paths) in `localStorage`.
- Canvas export **rebuilds** the bitmap, so camera EXIF is not copied.
- ONNX portrait matting (**MODNet**, Apache-2.0) is bundled at `public/models/modnet.onnx` and runs in a Web Worker via `onnxruntime-web`. Nothing is uploaded.
- The in-app **Privacy Centre** lists host, user-data path, autosave path, and analytics=off.

The marketing site (`docs/index.html`) may call the GitHub API. That page is not shipped inside the desktop app.

See also [AI.md](./AI.md).
