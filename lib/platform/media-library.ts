/** Local media-bin library. Thumbnails + blobs stay on this device (IndexedDB). */

export const MEDIA_LIBRARY_DB = 'vista-media-library'
export const MEDIA_LIBRARY_STORE = 'imports'

export type StoredMedia = {
  id: string
  name: string
  thumbnailDataUrl: string
  blob: Blob
  addedAt: number
}

function openDb(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(MEDIA_LIBRARY_DB, 1)
      req.onupgradeneeded = () => {
        const db = req.result
        if (!db.objectStoreNames.contains(MEDIA_LIBRARY_STORE)) {
          db.createObjectStore(MEDIA_LIBRARY_STORE, { keyPath: 'id' })
        }
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => resolve(null)
    } catch {
      resolve(null)
    }
  })
}

export async function putMediaItem(item: StoredMedia): Promise<void> {
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(MEDIA_LIBRARY_STORE, 'readwrite')
    tx.objectStore(MEDIA_LIBRARY_STORE).put(item)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
    tx.onabort = () => resolve()
  })
  db.close()
}

export async function deleteMediaItems(ids: string[]): Promise<void> {
  if (!ids.length) return
  const db = await openDb()
  if (!db) return
  await new Promise<void>((resolve) => {
    const tx = db.transaction(MEDIA_LIBRARY_STORE, 'readwrite')
    const store = tx.objectStore(MEDIA_LIBRARY_STORE)
    for (const id of ids) store.delete(id)
    tx.oncomplete = () => resolve()
    tx.onerror = () => resolve()
    tx.onabort = () => resolve()
  })
  db.close()
}

export async function loadMediaLibrary(): Promise<StoredMedia[]> {
  const db = await openDb()
  if (!db) return []
  const items = await new Promise<StoredMedia[]>((resolve) => {
    const tx = db.transaction(MEDIA_LIBRARY_STORE, 'readonly')
    const req = tx.objectStore(MEDIA_LIBRARY_STORE).getAll()
    req.onsuccess = () => {
      const rows = Array.isArray(req.result) ? (req.result as StoredMedia[]) : []
      resolve(rows.filter((row) => row && typeof row.id === 'string' && row.blob && row.thumbnailDataUrl))
    }
    req.onerror = () => resolve([])
  })
  db.close()
  return items.sort((a, b) => (b.addedAt ?? 0) - (a.addedAt ?? 0))
}
