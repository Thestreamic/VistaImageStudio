# Bundled music (CC0)

Vista Image Studio ships **24 original instrumental beds** dedicated to the
public domain under **CC0 1.0**. You may use them in the app and in exported
videos, including commercial work, with no attribution required.

  https://creativecommons.org/publicdomain/zero/1.0/

Files:

- `manifest.json` — titles, categories, licence URLs (generated)
- `tracks/*.wav` — generated at build/dev time; not stored in git
- `LICENSES/CC0-1.0.txt`

No music is downloaded while you edit. `npm run dev` / `build:web` /
`build:electron` run `scripts/sync-music-library.mjs`, which generates the
beds if Vistora-Music-Library is not beside this repo.

Do not add third-party MP3s here unless they are individually verified CC0
and listed in `features/music/catalogue.json`.
