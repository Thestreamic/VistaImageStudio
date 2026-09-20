'use client'

import { useMemo, useState } from 'react'
import { Film, X } from 'lucide-react'
import { compositor } from '@/features/editor/engine/compositor'
import { canvasToBlob } from '@/lib/image/canvas'
import { getBridge, isElectron } from '@/lib/platform/bridge'
import { useEditorStore } from '@/features/editor/store/editor-store'
import { DEFAULT_HOLD_SEC, slideshowDuration } from '@/features/music/ffmpeg-args'
import { loadMusicLibrary, type MusicTrack } from '@/features/music/library'
import { stopPreview } from '@/features/music/preview'
import { MusicPickerDialog } from './MusicPickerDialog'

async function jpegOf(canvas: HTMLCanvasElement): Promise<ArrayBuffer> {
  const blob = await canvasToBlob(canvas, 'image/jpeg', 0.9)
  return blob.arrayBuffer()
}

export function PhotoVideoDialog({ onClose }: { onClose: () => void }) {
  const doc = useEditorStore((s) => s.doc)
  const recentImports = useEditorStore((s) => s.recentImports)
  const notify = useEditorStore((s) => s.notify)
  const [hold, setHold] = useState(DEFAULT_HOLD_SEC)
  const [includeBin, setIncludeBin] = useState(false)
  const [track, setTrack] = useState<MusicTrack | null>(null)
  const [picker, setPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const desktop = isElectron()

  const stillCount = useMemo(() => {
    const extras = includeBin ? recentImports.filter((r) => r.workingCanvas && r.workingCanvas.width > 1).length : 0
    return (doc ? 1 : 0) + extras
  }, [doc, includeBin, recentImports])

  if (!doc) return null

  const exportVideo = async () => {
    setBusy(true)
    stopPreview()
    try {
      if (!desktop) {
        notify('info', 'MP4 with music is desktop-only. Preview tracks here; export video from the Windows app.')
        return
      }
      const frames: { name: string; buffer: ArrayBuffer }[] = []
      const main = compositor.renderOutput(doc)
      frames.push({ name: 'slide-00.jpg', buffer: await jpegOf(main) })
      if (includeBin) {
        for (let i = 0; i < recentImports.length; i++) {
          const canvas = recentImports[i].workingCanvas
          if (!canvas || canvas.width < 2) continue
          frames.push({ name: `slide-${String(i + 1).padStart(2, '0')}.jpg`, buffer: await jpegOf(canvas) })
        }
      }
      if (!frames.length) {
        notify('error', 'Add a photo first.')
        return
      }
      let musicId = track?.id ?? null
      if (musicId) {
        const lib = await loadMusicLibrary()
        if (!lib.some((t) => t.id === musicId)) {
          notify('info', 'Music unavailable — exporting a silent video.')
          musicId = null
        }
      }
      const result = await getBridge().exportVideoMp4?.({
        frames,
        holdSec: hold,
        musicId,
        suggestedName: `${doc.fileName.replace(/\.[^.]+$/, '') || 'slideshow'}.mp4`,
        width: main.width,
        height: main.height,
      })
      if (!result) {
        notify('info', 'MP4 with music is desktop-only.')
        return
      }
      if (result.canceled) return
      if (!result.ok) {
        notify('error', result.error || 'Video export failed.')
        return
      }
      notify('success', 'Exported MP4')
      onClose()
    } catch (err) {
      notify('error', `Video export failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        data-testid="photo-video-dialog"
        className="w-[420px] max-h-[85vh] overflow-y-auto rounded-xl bg-popover border border-border shadow-2xl p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Make video</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
          Turns the current photo (and optional Media bin stills) into an MP4. Apply Portrait Bokeh on stills first if
          you want it in the video. Music is CC0 and stays on this device.
        </p>
        <p className="text-xs mb-3">
          {stillCount} still{stillCount === 1 ? '' : 's'} · about {slideshowDuration(stillCount, hold).toFixed(1)}s
        </p>
        <label className="flex items-center gap-2 text-xs mb-3">
          <input type="checkbox" checked={includeBin} onChange={(e) => setIncludeBin(e.target.checked)} />
          Also include photos from Media
        </label>
        <label className="block mb-3">
          <span className="text-[10px] text-muted-foreground">Hold each still {hold.toFixed(1)}s</span>
          <input
            type="range"
            className="slider mt-1"
            min={1}
            max={6}
            step={0.5}
            value={hold}
            onChange={(e) => setHold(Number(e.target.value))}
          />
        </label>
        <div className="mb-4">
          <span className="panel-label">Music</span>
          <p className="text-[10px] text-muted-foreground mt-1 mb-2">
            {track ? `${track.title} · ${track.license}` : 'Optional — silent if none'}
          </p>
          <div className="flex gap-1.5">
            <button
              type="button"
              data-testid="music-choose"
              onClick={() => setPicker(true)}
              className="flex-1 py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80"
            >
              {track ? 'Change track' : 'Choose music'}
            </button>
            {track && (
              <button
                type="button"
                onClick={() => setTrack(null)}
                className="px-3 py-1.5 text-xs rounded-md bg-secondary hover:bg-secondary/80"
              >
                None
              </button>
            )}
          </div>
        </div>
        {!desktop && (
          <p className="text-[10px] text-muted-foreground mb-3">
            You can preview tracks in the browser. Saving an MP4 with audio needs the desktop app.
          </p>
        )}
        <button
          type="button"
          data-testid="export-mp4"
          disabled={busy}
          onClick={() => void exportVideo()}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md brand-gradient-bg text-white text-sm font-medium disabled:opacity-60"
        >
          <Film size={14} />
          {busy ? 'Exporting…' : desktop ? 'Export MP4' : 'Preview music / desktop MP4'}
        </button>
      </div>
      {picker && (
        <MusicPickerDialog
          selectedId={track?.id}
          onSelect={(next) => {
            setTrack(next)
            setPicker(false)
          }}
          onClose={() => setPicker(false)}
        />
      )}
    </div>
  )
}
