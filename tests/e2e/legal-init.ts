import type { Page } from '@playwright/test'
import { EULA_STORAGE_KEY, EULA_VERSION } from '../../lib/legal/eula'

/** Skip the EULA gate and first-run tour so editor e2e can reach the canvas. */
export async function seedLegalAcceptance(page: Page) {
  await page.addInitScript(
    ({ key, version }) => {
      localStorage.setItem('vista-onboarded', '1')
      localStorage.setItem(
        key,
        JSON.stringify({
          timestamp: '2026-09-20T00:00:00.000Z',
          eulaVersion: version,
          userAgent: 'playwright',
        }),
      )
    },
    { key: EULA_STORAGE_KEY, version: EULA_VERSION },
  )
}

export function eulaAcceptanceFilePayload() {
  return {
    timestamp: '2026-09-20T00:00:00.000Z',
    eulaVersion: EULA_VERSION,
    userAgent: 'playwright-electron',
  }
}
