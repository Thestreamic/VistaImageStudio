import { test, expect } from '@playwright/test'
import { seedLegalAcceptance } from './legal-init'

test('editor shell works with the browser marked offline', async ({ page, context }) => {
  await seedLegalAcceptance(page)
  await page.goto('/')
  await expect(page.getByTestId('editor-shell')).toHaveAttribute('data-ready', 'true')
  await context.setOffline(true)
  await expect(page.getByText('Drag & drop a photo')).toBeVisible()
  await page.getByRole('button', { name: 'Privacy Centre' }).click()
  await expect(page.getByText(/Analytics/)).toBeVisible()
})
