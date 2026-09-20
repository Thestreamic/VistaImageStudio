export interface RecentProject {
  name: string
  path: string
  openedAt: number
}

const KEY = 'vista-recents'
const MAX = 8

function read(): RecentProject[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as RecentProject[]
    return Array.isArray(parsed) ? parsed.filter((r) => r && typeof r.name === 'string') : []
  } catch {
    return []
  }
}

function write(list: RecentProject[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)))
  } catch {
    /* quota */
  }
}

export function listRecents(): RecentProject[] {
  return read().sort((a, b) => b.openedAt - a.openedAt).slice(0, MAX)
}

export function addRecent(name: string, path: string) {
  const next = listRecents().filter((r) => r.path !== path)
  next.unshift({ name, path, openedAt: Date.now() })
  write(next)
}

export function clearRecents() {
  write([])
}
