import { test, expect } from '@playwright/test'
import { seedLegalAcceptance } from './legal-init'

test('first launch shows a blocking EULA until Agree is checked', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('vista-eula-accepted')
      localStorage.removeItem('vista-onboarded')
    } catch {
      /* ignore */
    }
  })
  await page.goto('/')
  await expect(page.getByTestId('eula-gate')).toBeVisible()
  await expect(page.getByText('Drag & drop a photo')).toHaveCount(0)
  const agree = page.getByTestId('eula-accept')
  await expect(agree).toBeDisabled()
  await page.getByTestId('eula-agree').check()
  await expect(agree).toBeEnabled()
  await agree.click()
  await expect(page.getByTestId('eula-gate')).toHaveCount(0)
  await expect(page.getByTestId('editor-shell')).toHaveAttribute('data-eula-accepted', 'true')
})

test('Decline on the web shows a dead-end instead of the editor', async ({ page }) => {
  await page.addInitScript(() => {
    try {
      localStorage.removeItem('vista-eula-accepted')
    } catch {
      /* ignore */
    }
  })
  await page.goto('/')
  await expect(page.getByTestId('eula-gate')).toBeVisible()
  await page.getByTestId('eula-decline').click()
  await expect(page.getByTestId('eula-blocked')).toBeVisible()
  await expect(page.getByText('Drag & drop a photo')).toHaveCount(0)
})

test('Help → About shows EULA, Privacy, and third-party notices', async ({ page }) => {
  await seedLegalAcceptance(page)
  await page.goto('/')
  await expect(page.getByTestId('editor-shell')).toHaveAttribute('data-eula-accepted', 'true')
  await page.getByTestId('app-menu-help').click()
  await page.getByTestId('menu-about').click()
  await expect(page.getByTestId('about-dialog')).toBeVisible()
  await expect(page.getByText(/The Streamic/)).toBeVisible()
  await page.getByTestId('about-eula').click()
  await expect(page.getByTestId('legal-viewer-eula')).toBeVisible()
  await expect(page.getByText(/END-USER LICENSE AGREEMENT/)).toBeVisible()
  await page.getByTestId('legal-viewer-eula').getByRole('button', { name: 'Close' }).click()
  await expect(page.getByTestId('about-dialog')).toBeVisible()
})

test('static /eula and /privacy pages render canonical text', async ({ page }) => {
  await page.goto('/eula')
  await expect(page.getByRole('heading', { name: /End-User License Agreement/i })).toBeVisible()
  await expect(page.getByText(/laws of Ireland/)).toBeVisible()
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: 'Privacy Policy' })).toBeVisible()
  await expect(page.getByText(/no telemetry by default/i)).toBeVisible()
})
