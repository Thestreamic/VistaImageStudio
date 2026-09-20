import {
  EULA_STORAGE_KEY,
  EULA_VERSION,
} from '@/lib/legal/eula'

export type EulaAcceptanceRecord = {
  timestamp: string
  eulaVersion: string
  userAgent?: string
}

export function parseEulaAcceptance(raw: unknown): EulaAcceptanceRecord | null {
  if (raw == null || raw === '') return null
  let value: unknown = raw
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw)
    } catch {
      return null
    }
  }
  if (!value || typeof value !== 'object') return null
  const rec = value as Record<string, unknown>
  if (typeof rec.timestamp !== 'string' || !rec.timestamp.trim()) return null
  if (typeof rec.eulaVersion !== 'string' || !rec.eulaVersion.trim()) return null
  if (Number.isNaN(Date.parse(rec.timestamp))) return null
  const out: EulaAcceptanceRecord = {
    timestamp: rec.timestamp,
    eulaVersion: rec.eulaVersion.trim(),
  }
  if (typeof rec.userAgent === 'string' && rec.userAgent.trim()) {
    out.userAgent = rec.userAgent
  }
  return out
}

export function isEulaAccepted(
  record: EulaAcceptanceRecord | null | undefined,
  currentVersion: string = EULA_VERSION,
): boolean {
  return Boolean(record && record.eulaVersion === currentVersion)
}

export function createEulaAcceptance(
  currentVersion: string = EULA_VERSION,
  now: Date = new Date(),
  userAgent?: string,
): EulaAcceptanceRecord {
  const record: EulaAcceptanceRecord = {
    timestamp: now.toISOString(),
    eulaVersion: currentVersion,
  }
  if (userAgent) record.userAgent = userAgent
  return record
}

export function serializeEulaAcceptance(record: EulaAcceptanceRecord): string {
  return JSON.stringify(record)
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function browserStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

export function readEulaAcceptanceFromStorage(
  storage: StorageLike | null = browserStorage(),
): EulaAcceptanceRecord | null {
  if (!storage) return null
  try {
    return parseEulaAcceptance(storage.getItem(EULA_STORAGE_KEY))
  } catch {
    return null
  }
}

export function writeEulaAcceptanceToStorage(
  record: EulaAcceptanceRecord,
  storage: StorageLike | null = browserStorage(),
): boolean {
  if (!storage) return false
  try {
    storage.setItem(EULA_STORAGE_KEY, serializeEulaAcceptance(record))
    return true
  } catch {
    return false
  }
}

export function clearEulaAcceptanceFromStorage(
  storage: StorageLike | null = browserStorage(),
): void {
  if (!storage) return
  try {
    storage.removeItem(EULA_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function hasAcceptedCurrentEula(
  storage: StorageLike | null = browserStorage(),
  currentVersion: string = EULA_VERSION,
): boolean {
  return isEulaAccepted(readEulaAcceptanceFromStorage(storage), currentVersion)
}
