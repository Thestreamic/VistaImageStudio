# Third-party notices

This file lists bundled model weights and their licenses. Runtime libraries
are declared in `package.json`.

## Intel MiDaS v2.1 small (`public/models/midas-small.onnx`)

- Source: official Intel release
  `https://github.com/isl-org/MiDaS/releases/download/v2_1/model-small.onnx`
- Repository: `https://github.com/isl-org/MiDaS`
- Authors: René Ranftl, Katrin Lasinger, David Hafner, Konrad Schindler, Vladlen Koltun (Intel Intelligent Systems Lab)
- License: MIT
- Downloaded by `scripts/sync-models.mjs` (not committed; ~64MB).

```
MIT License

Copyright (c) Intel Corporation

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## MODNet photographic portrait matting (`public/models/modnet.onnx`)

- Source weights: official MODNet photographic portrait matting, ONNX export
  mirrored at
  `https://huggingface.co/DavG25/modnet-pretrained-models`
  (`models/modnet_photographic_portrait_matting.onnx`)
- Project: `https://github.com/ZHKKKe/MODNet`
- Authors: Zhanghan Ke, Kaican Li, Yurou Zhou, Zhicheng Yin, Kaixuan Yan,
  Yanqing Ren, Rynson W.H. Lau
- License: Apache License 2.0
- Downloaded by `scripts/sync-models.mjs` (not committed; ~25MB).
- SHA-256: `07C308CF0FC7E6E8B2065A12ED7FC07E1DE8FEBB7DC7839D7B7F15DD66584DF9`
- Runtime preprocess (locked to this graph): NCHW float32, spatial size from
  ref 512 keeping aspect (multiple of 32), `(pixel - 127.5) / 127.5` → [-1, 1].
  Input / output names are read from the session (`input` / `output`); height
  and width are dynamic.

```
Apache License
Version 2.0, January 2004
http://www.apache.org/licenses/

Copyright 2022 Zhanghan Ke et al.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
```

## LaMa inpainting (`public/models/lama.onnx`)

- Source: Carve/LaMa-ONNX `lama_fp32.onnx` (Apache-2.0), a port of
  Samsung AI Center’s big-LaMa (WACV 2022).
  `https://huggingface.co/Carve/LaMa-ONNX`
- Original paper/repo: `https://github.com/advimman/lama`
- Downloaded by `scripts/sync-models.mjs` (not committed; ~208MB).
- Runtime I/O: fixed **512×512**, inputs `image` (float32 NCHW 0–1) and
  `mask` (float32 NCHW, 1 = hole). The hole is zeroed in RGB before inference.
  Output RGB is typically already in 0–255.

