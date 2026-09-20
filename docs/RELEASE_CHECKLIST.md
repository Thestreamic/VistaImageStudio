# Release checklist

Do **not** publish GitHub Releases or Pages without an explicit go-ahead.

## Before a local build

- [ ] `pnpm test`
- [ ] `pnpm test:e2e` (includes an offline renderer smoke)
- [ ] `pnpm typecheck`
- [ ] Confirm Privacy Centre copy matches `docs/PRIVACY.md`
- [ ] No `.onnx` / GGUF files in the installer
- [ ] `resources/models` may be empty (builder warning is OK)

## Packaged smoke (`pnpm package:dir`)

1. Install or run the unpacked app (Windows: `dist/win-unpacked`).
2. First launch: skip or complete the walkthrough.
3. Drop a JPEG, save `Something.lumen`, quit, reopen, confirm dirty prompt if you skip save.
4. Export an Instagram 4:5 JPEG. Confirm no EXIF (canvas re-encode).
5. Toggle Privacy Centre — analytics off, paths under AppData (not Program Files).
6. Uninstall / delete the unpacked dir. Photos must not remain in Program Files.

## Known limitations

- Windows builds are **unsigned**. SmartScreen will warn.
- HEIC first decode can take several seconds (WASM).
- Colour is sRGB 8-bit. No RAW, ICC, or wide gamut.
