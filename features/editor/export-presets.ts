export interface ExportPreset {
  id: string
  label: string
  width: number | null // null = keep the document's own size
  height: number | null
  hint: string
}

/** The sizes creators actually export to most, per platform. */
export const EXPORT_PRESETS: ExportPreset[] = [
  { id: 'original', label: 'Original Size', width: null, height: null, hint: 'No resize' },
  { id: 'ig-post', label: 'Instagram Post', width: 1080, height: 1080, hint: '1:1' },
  { id: 'ig-portrait', label: 'Instagram Portrait', width: 1080, height: 1350, hint: '4:5' },
  { id: 'ig-story', label: 'Story / Reel / TikTok', width: 1080, height: 1920, hint: '9:16' },
  { id: 'yt-thumb', label: 'YouTube Thumbnail', width: 1280, height: 720, hint: '16:9 · full photo squeezed' },
  { id: 'pinterest', label: 'Pinterest Pin', width: 1000, height: 1500, hint: '2:3' },
  { id: 'linkedin-post', label: 'LinkedIn Post', width: 1200, height: 627, hint: '1.91:1' },
  { id: 'x-post', label: 'X / Twitter Post', width: 1600, height: 900, hint: '16:9' },
  { id: 'fb-post', label: 'Facebook Post', width: 1200, height: 630, hint: '1.91:1' },
]
