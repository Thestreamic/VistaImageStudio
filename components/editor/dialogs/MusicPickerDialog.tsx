'use client'

import { useEffect, useMemo, useState } from 'react'
import { Pause, Play, X } from 'lucide-react'
import {
  formatTrackDuration,
  getTracksByCategory,
  getTracksByMood,
  loadMusicLibrary,
  MUSIC_CATEGORIES,
  searchTracks,
  trackPublicUrl,
  type MusicTrack,
} from '@/features/music/library'
import { pausePreview, previewPaused, previewTrack, stopPreview } from '@/features/music/preview'
import { cn } from '@/lib/utils'

export function MusicPickerDialog({
  selectedId,
  onSelect,
  onClose,
}: {
  selectedId?: string | null
  onSelect: (track: MusicTrack) => void
  onClose: () => void
}) {
  const [tracks, setTracks] = useState<MusicTrack[] | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All')
  const [mood, setMood] = useState('')
  const [playingId, setPlayingId] = useState<string | null>(null)

  useEffect(() => {
    void loadMusicLibrary().then(setTracks)
    return () => stopPreview()
  }, [])

  const moods = useMemo(() => {
    const set = new Set((tracks ?? []).map((t) => t.mood).filter(Boolean) as string[])
    return [...set].sort()
  }, [tracks])

  const visible = useMemo(() => {
    if (!tracks) return []
    return searchTracks(getTracksByMood(getTracksByCategory(tracks, category), mood), query)
  }, [tracks, category, mood, query])

  const togglePlay = (track: MusicTrack) => {
    if (playingId === track.id && !previewPaused()) {
      pausePreview()
      setPlayingId(null)
      return
    }
    previewTrack(trackPublicUrl(track), track.id)
    setPlayingId(track.id)
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        data-testid="music-picker"
        className="w-[520px] max-h-[85vh] flex flex-col rounded-xl bg-popover border border-border shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold">Music</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X size={16} />
          </button>
        </div>
        <div className="px-4 py-2 space-y-2 border-b border-border">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, mood, composer…"
            aria-label="Search music"
            className="w-full bg-input rounded px-2 py-1.5 text-xs border border-border"
          />
          <div className="flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setCategory('All')}
              className={cn('px-2 py-0.5 text-[10px] rounded-md', category === 'All' ? 'bg-accent' : 'bg-secondary')}
            >
              All
            </button>
            {MUSIC_CATEGORIES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={cn('px-2 py-0.5 text-[10px] rounded-md', category === c ? 'bg-accent' : 'bg-secondary')}
              >
                {c}
              </button>
            ))}
          </div>
          {moods.length > 0 && (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => setMood('')}
                className={cn('px-2 py-0.5 text-[10px] rounded-md', !mood ? 'bg-accent' : 'bg-secondary')}
              >
                Any mood
              </button>
              {moods.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood(m)}
                  className={cn('px-2 py-0.5 text-[10px] rounded-md', mood === m ? 'bg-accent' : 'bg-secondary')}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {tracks === null && <p className="text-xs text-muted-foreground px-2 py-4">Loading music…</p>}
          {tracks && tracks.length === 0 && (
            <p data-testid="music-unavailable" className="text-xs text-muted-foreground px-2 py-4">
              Music unavailable. Editing still works.
            </p>
          )}
          {visible.map((track) => {
            const selected = track.id === selectedId
            const playing = playingId === track.id
            return (
              <div
                key={track.id}
                data-testid={`music-row-${track.id}`}
                className={cn(
                  'flex items-center gap-2 px-2 py-1.5 rounded-md mb-0.5',
                  selected ? 'bg-accent/60' : 'hover:bg-secondary/70',
                )}
              >
                <button
                  type="button"
                  aria-label={playing ? `Pause ${track.title}` : `Preview ${track.title}`}
                  onClick={() => togglePlay(track)}
                  className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-secondary"
                >
                  {playing ? <Pause size={12} /> : <Play size={12} />}
                </button>
                <button type="button" className="flex-1 min-w-0 text-left" onClick={() => onSelect(track)}>
                  <div className="text-xs font-medium truncate">{track.title}</div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {track.composer} · {track.category} · {track.mood} · {formatTrackDuration(track.duration_ms)} · {track.license}
                  </div>
                </button>
              </div>
            )
          })}
        </div>
        <div className="px-4 py-2 border-t border-border flex justify-between items-center">
          <button type="button" className="text-[10px] text-muted-foreground" onClick={() => pausePreview()}>
            Stop preview
          </button>
          <p className="text-[10px] text-muted-foreground">CC0 — commercial use, no attribution required.</p>
        </div>
      </div>
    </div>
  )
}
