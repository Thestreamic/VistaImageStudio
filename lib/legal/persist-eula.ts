import {
  createEulaAcceptance,
  hasAcceptedCurrentEula,
  isEulaAccepted,
  parseEulaAcceptance,
  type EulaAcceptanceRecord,
  writeEulaAcceptanceToStorage,
} from '@/lib/legal/acceptance'
import { EULA_VERSION } from '@/lib/legal/eula'
import { getBridge } from '@/lib/platform/bridge'

export async function hydrateEulaAcceptance(): Promise<boolean> {
  if (hasAcceptedCurrentEula()) return true
  const remote = parseEulaAcceptance(await getBridge().getEulaAcceptance?.())
  if (!isEulaAccepted(remote) || !remote) return false
  writeEulaAcceptanceToStorage(remote)
  return true
}

export async function acceptCurrentEula(): Promise<EulaAcceptanceRecord> {
  const record = createEulaAcceptance(
    EULA_VERSION,
    new Date(),
    typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  )
  writeEulaAcceptanceToStorage(record)
  await getBridge().setEulaAcceptance?.(record)
  return record
}

export async function declineEulaAndExit(): Promise<'quit' | 'blocked'> {
  const bridge = getBridge()
  if (typeof window !== 'undefined' && window.lumen) {
    try {
      await bridge.allowQuit()
      bridge.close?.()
      return 'quit'
    } catch {
      return 'blocked'
    }
  }
  return 'blocked'
}
