import { publicUrl } from '@/lib/public-url'

export const MUSIC_CATEGORIES = [
  'Travel',
  'Cinematic',
  'Chill',
  'Ambient',
  'Happy',
  'Upbeat',
  'Emotional',
  'Romantic',
  'Lifestyle',
  'Technology',
  'Inspirational',
  'Minimal',
] as const

export type MusicCategory = (typeof MUSIC_CATEGORIES)[number]

export type MusicTrack = {
  id: string
  title: string
  file: string
  license: string
  license_url?: string
  source_url?: string
  verified_date?: string
  composer?: string
  category?: string
  mood?: string
  duration_ms?: number
}

function isTrack(row: unknown): row is MusicTrack {
  if (!row || typeof row !== 'object') return false
  const t = row as Record<string, unknown>
  return (
    typeof t.id === 'string' &&
    typeof t.title === 'string' &&
    typeof t.file === 'string' &&
    typeof t.license === 'string' &&
    t.id.length > 0 &&
    t.file.length > 0
  )
}

export function parseManifest(raw: unknown): MusicTrack[] {
  if (!raw || typeof raw !== 'object') return []
  const obj = raw as { tracks?: unknown }
  const rows = Array.isArray(raw) ? raw : obj.tracks
  if (!Array.isArray(rows)) return []
  return rows.filter(isTrack)
}

export function getTrackById(tracks: MusicTrack[], id: string): MusicTrack | null {
  return tracks.find((t) => t.id === id) ?? null
}

export function getTracksByCategory(tracks: MusicTrack[], category: string): MusicTrack[] {
  if (!category || category === 'All') return tracks
  return tracks.filter((t) => t.category === category)
}

export function getTracksByMood(tracks: MusicTrack[], mood: string): MusicTrack[] {
  if (!mood) return tracks
  return tracks.filter((t) => (t.mood ?? '').toLowerCase() === mood.toLowerCase())
}

export function searchTracks(tracks: MusicTrack[], query: string): MusicTrack[] {
  const q = query.trim().toLowerCase()
  if (!q) return tracks
  return tracks.filter((t) =>
    [t.title, t.composer, t.category, t.mood, t.id].some((v) => (v ?? '').toLowerCase().includes(q)),
  )
}

export function formatTrackDuration(ms?: number): string {
  if (!ms || ms < 0) return '0:00'
  const s = Math.round(ms / 1000)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

export function trackPublicUrl(track: MusicTrack): string {
  const rel = track.file.replace(/^\/+/, '')
  return publicUrl(rel.startsWith('music/') ? `/${rel}` : `/music/${rel}`)
}

export async function loadMusicLibrary(): Promise<MusicTrack[]> {
  try {
    const res = await fetch(publicUrl('/music/manifest.json'), { cache: 'no-store' })
    if (!res.ok) return []
    return parseManifest(await res.json())
  } catch {
    return []
  }
}
