import { describe, expect, it } from 'vitest'
import catalog from '@/features/music/catalogue.json'
import {
  getTrackById,
  getTracksByCategory,
  parseManifest,
  searchTracks,
} from '@/features/music/library'

describe('CC0 music catalogue', () => {
  it('lists 20–30 original CC0 tracks with unique ids', () => {
    expect(catalog.license).toBe('CC0-1.0')
    expect(catalog.tracks.length).toBeGreaterThanOrEqual(20)
    expect(catalog.tracks.length).toBeLessThanOrEqual(30)
    const ids = catalog.tracks.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(catalog.tracks.every((t) => t.title && t.category)).toBe(true)
  })
})

describe('music library parse', () => {
  it('drops invalid rows and searches by title', () => {
    const tracks = parseManifest({
      tracks: [
        { id: 'a', title: 'Horizon Road', file: 'tracks/a.wav', license: 'CC0-1.0', category: 'Travel' },
        { id: '', title: 'bad', file: 'x', license: 'CC0-1.0' },
        { title: 'no-id', file: 'x', license: 'CC0-1.0' },
      ],
    })
    expect(tracks).toHaveLength(1)
    expect(searchTracks(tracks, 'horizon')[0]?.id).toBe('a')
    expect(getTracksByCategory(tracks, 'Travel')).toHaveLength(1)
    expect(getTrackById(tracks, 'missing')).toBeNull()
  })
})
