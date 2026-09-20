import { afterEach, describe, expect, it } from 'vitest'
import {
  clearEulaAcceptanceFromStorage,
  createEulaAcceptance,
  hasAcceptedCurrentEula,
  isEulaAccepted,
  parseEulaAcceptance,
  readEulaAcceptanceFromStorage,
  writeEulaAcceptanceToStorage,
} from '@/lib/legal/acceptance'
import { EULA_STORAGE_KEY, EULA_VERSION } from '@/lib/legal/eula'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial }
  return {
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value
    },
    removeItem: (key: string) => {
      delete data[key]
    },
    data,
  }
}

describe('EULA acceptance storage', () => {
  afterEach(() => {
    clearEulaAcceptanceFromStorage()
  })

  it('rejects missing or corrupt records', () => {
    expect(parseEulaAcceptance(null)).toBeNull()
    expect(parseEulaAcceptance('')).toBeNull()
    expect(parseEulaAcceptance('{')).toBeNull()
    expect(parseEulaAcceptance({ timestamp: 'nope', eulaVersion: EULA_VERSION })).toBeNull()
    expect(parseEulaAcceptance({ timestamp: '2026-09-20T00:00:00.000Z' })).toBeNull()
    expect(isEulaAccepted(null)).toBe(false)
  })

  it('accepts a valid record for the current version', () => {
    const record = createEulaAcceptance(EULA_VERSION, new Date('2026-09-20T12:00:00.000Z'), 'test-agent')
    expect(record.timestamp).toBe('2026-09-20T12:00:00.000Z')
    expect(record.eulaVersion).toBe(EULA_VERSION)
    expect(record.userAgent).toBe('test-agent')
    expect(isEulaAccepted(record)).toBe(true)
  })

  it('requires re-acceptance when the EULA version increments', () => {
    const previous = createEulaAcceptance('2026-01-01', new Date('2026-01-01T00:00:00.000Z'))
    expect(isEulaAccepted(previous, EULA_VERSION)).toBe(false)
    expect(isEulaAccepted(previous, '2026-01-01')).toBe(true)
  })

  it('round-trips through storage', () => {
    const storage = memoryStorage()
    expect(hasAcceptedCurrentEula(storage)).toBe(false)
    const record = createEulaAcceptance()
    expect(writeEulaAcceptanceToStorage(record, storage)).toBe(true)
    expect(storage.data[EULA_STORAGE_KEY]).toContain(EULA_VERSION)
    expect(hasAcceptedCurrentEula(storage)).toBe(true)
    expect(readEulaAcceptanceFromStorage(storage)?.eulaVersion).toBe(EULA_VERSION)
    clearEulaAcceptanceFromStorage(storage)
    expect(hasAcceptedCurrentEula(storage)).toBe(false)
  })
})
