# Privacy

Last updated: September 27, 2026  
Publisher: The Streamic (`thestreamic@gmail.com`)  
Sites: [vistaimagestudio.thestreamic.in](https://vistaimagestudio.thestreamic.in), [vistaimage.thestreamic.in](https://vistaimage.thestreamic.in), [thestreamic.in](https://thestreamic.in)

Canonical policy text lives in `lib/legal/privacy.ts` (also `/privacy` and Help → About).

Summary for engineers (not marketing claims):

- No account is required to edit.
- The **web app needs network access** to load HTML, scripts, WASM, and model assets from hosting.
- Core editing is designed to run in the browser/desktop runtime; we do not operate a Streamic photo-storage/viewing service for the user’s library.
- The public web app counts anonymous visits with Umami (cookie-free; no photos, edits or file names). The desktop app has no analytics. No crash-reporting SDK.
- Production CSP `connect-src` is `'self' blob: data:` (dev also allows the Next.js HMR websocket).
- Command chat stores **text only** in `localStorage`.
- Canvas export **rebuilds** the bitmap (no camera EXIF copy).
- Privacy Centre is a local status panel — not an offline guarantee.
- Optional contact: email `thestreamic@gmail.com`.

See also [AI.md](./AI.md) and the [End-User License Agreement](./eula.html).
