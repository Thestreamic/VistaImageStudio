# Turn music back on

Music export is already built for the website and the Windows app. The
Choose music control is hidden until it is sold as a paid option.

Follow this file when that option should appear. Do not add a second music
catalogue.

## Show the control

1. Open `features/music/offer.ts`.
2. Set `MUSIC_UI_ENABLED` to `true`.
3. Rebuild the surface you are shipping:
   - Web: `npm run build:web`
   - Windows app: `npm run package`

That one flag is the switch. While it is `false`, Export → Make video still
saves a silent MP4 and does not show Choose music.

## What comes back

- Export, File, and the mobile menu → Make video… → Choose music.
- Preview plays the selected CC0 track in the browser and in the app.
- Web export muxes that track into the downloaded MP4
  (`features/music/web-slideshow.ts`, `mp4-muxer`).
- The Windows app still muxes with FFmpeg
  (`electron/main/video-export.ts`).

A track shorter than the video loops. A longer track is trimmed. Fade in is
0.8s and fade out is 1.5s, same as the desktop encode.

## Where the tracks live

- List: `features/music/catalogue.json`
- `scripts/sync-music-library.mjs` copies them into `public/music`.
- The desktop package reads `public/music` or `resources/music`.
- If that folder has no `manifest.json`, export stays silent and the picker
  says music is unavailable. Editing is unchanged.

## Check before you ship it

1. Open a photo.
2. Export → Make video…
3. Choose a track and play the preview.
4. Export MP4.
5. Confirm the file has audio, the subject stills are the photos you chose,
   and a short track repeats for the whole video.

On the web the MP4 downloads. In the Windows app a save dialog opens.
