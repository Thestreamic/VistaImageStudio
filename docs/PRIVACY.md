# Privacy

Last updated: September 20, 2026  
Publisher: The Streamic (`thestreamic@gmail.com`)  
Sites: [vistaimagestudio.thestreamic.in](https://vistaimagestudio.thestreamic.in), [thestreamic.in](https://thestreamic.in)

Vista Image Studio is local-first.

- **No account, no telemetry, no photo upload API** in the app.
- Production CSP `connect-src` is `'self' blob: data:` (dev also allows the Next.js HMR websocket).
- Pixels live on `HTMLCanvasElement` in the renderer. AI runs in a Web Worker.
- Command chat stores **text only** (no pixels, no file paths) in `localStorage`.
- Canvas export **rebuilds** the bitmap, so camera EXIF is not copied.
- ONNX portrait matting (**MODNet**, Apache-2.0), inpainting (**LaMa**, Apache-2.0) and depth (**MiDaS**, MIT) are bundled under `public/models/` when present and run via `onnxruntime-web`. Nothing is uploaded.
- The in-app **Privacy Centre** lists host, user-data path, autosave path, and analytics=off.
- EULA acceptance (`vista-eula-accepted`) is stored locally (and, on desktop, in the app user-data folder).
- Optional contact: email `thestreamic@gmail.com`. We only receive what you send.
- The marketing site (`docs/index.html`) may call the GitHub API. That page is not shipped inside the desktop app.

The canonical policy text used by `/privacy` and Help → About lives in `lib/legal/privacy.ts`.

See also [AI.md](./AI.md) and the [End-User License Agreement](./eula.html).
