# Vista Image Studio project file (`.lumen`)

Schema version **1**. A project is a JSON object (UTF-8), not a ZIP. Assets are
embedded as PNG data URLs so a file can be copied without a sidecar folder.

```json
{
  "kind": "lumen-project",
  "schemaVersion": 1,
  "id": "doc_…",
  "createdAt": "ISO-8601",
  "modifiedAt": "ISO-8601",
  "fileName": "Shot.png",
  "canvas": { "width": 1080, "height": 1350 },
  "activeLayerId": "layer_…",
  "crop": { "x": 0, "y": 0, "width": 1080, "height": 1350 },
  "lookId": "punch",
  "lookIntensity": 80,
  "lastExport": { "presetIds": ["ig-portrait"], "format": "jpeg", "quality": 90, "fileNameTemplate": "{name}-{preset}", "fitMode": "fill" },
  "brandKit": { "colors": ["#ff5ea6"], "font": "Inter" },
  "layers": [],
  "assets": {}
}
```

## Rules

- Never `eval` JSON. Parse, then validate.
- Assets may only be `data:image/png;base64,…` or `data:image/jpeg;base64,…`.
  `http(s):`, `javascript:`, `file:`, and `..` paths are rejected.
- Future `schemaVersion` values open **read-only** (export still allowed).
- Writes are atomic: temp file + rename.
- Autosave is capped (~12 MB JSON) under the host user-data folder
  (`%APPDATA%/vista-image-studio/autosave` on Windows) or `localStorage` in the browser.

There are no on-disk projects from earlier Vista Image Studio builds to migrate.
