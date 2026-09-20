# On-device ONNX weights (not in git)

These files are downloaded by `node scripts/sync-models.mjs` (also run from `npm run dev` / `build`):

| File | Model | License |
| --- | --- | --- |
| `midas-small.onnx` | Intel MiDaS v2.1 small | MIT |
| `modnet.onnx` | MODNet photographic portrait matting | Apache-2.0 |
| `lama.onnx` | Carve/LaMa-ONNX `lama_fp32.onnx` | Apache-2.0 |

See `THIRD_PARTY_NOTICES.md`. Runtime CSP cannot fetch Hugging Face / GitHub, so the files must exist here before you open the editor.
