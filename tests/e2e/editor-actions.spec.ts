import { test, expect, type Page } from '@playwright/test'
import { seedLegalAcceptance } from './legal-init'

test.beforeEach(async ({ page }) => {
  await seedLegalAcceptance(page)
})

/** Imports a small multi-tone photo by dropping it on the shell. */
// 'dim' is dark and muted, so Low Light / Vibrance are not skipped by the
// scene gate (features/ai/algorithms/scene-gate.ts skips photos that already
// look fine: median luma >= 72, or mean saturation > 48).
const PALETTES = {
  default: ['#7a5c3e', '#3e6a7a', '#9aa07f'],
  dim: ['#2b2723', '#262d30', '#34322b'],
} as const

async function importPhoto(page: Page, palette: keyof typeof PALETTES = 'default') {
  await page.goto('/')
  await expect(page.getByTestId('editor-shell')).toHaveAttribute('data-ready', 'true')
  const dataTransfer = await page.evaluateHandle(async ([base, topLeft, bottomRight]) => {
    const c = document.createElement('canvas')
    c.width = 16
    c.height = 16
    const ctx = c.getContext('2d')!
    ctx.fillStyle = base
    ctx.fillRect(0, 0, 16, 16)
    ctx.fillStyle = topLeft
    ctx.fillRect(0, 0, 8, 8)
    ctx.fillStyle = bottomRight
    ctx.fillRect(8, 8, 8, 8)
    const blob = await new Promise<Blob>((r) => c.toBlob((b) => r(b!), 'image/png'))
    const file = new File([blob], 'photo.png', { type: 'image/png' })
    const transfer = new DataTransfer()
    transfer.items.add(file)
    return transfer
  }, PALETTES[palette])
  const shell = page.getByTestId('editor-shell')
  await shell.dispatchEvent('dragenter', { dataTransfer })
  await shell.dispatchEvent('dragover', { dataTransfer })
  await shell.dispatchEvent('drop', { dataTransfer })
  await expect(page.locator('canvas').first()).toBeVisible()
}

function stagePixels(page: Page) {
  return page.evaluate(() => {
    const canvas = Array.from(document.querySelectorAll('canvas')).find((c) => c.width === 16)
    if (!canvas) throw new Error('stage canvas not found')
    const data = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data
    return Array.from(data).join(',')
  })
}

test('applying a filter preset changes the composited pixels', async ({ page }) => {
  await importPhoto(page)
  const before = await stagePixels(page)

  await page.getByRole('button', { name: 'Filters' }).click()
  await page.getByRole('button', { name: 'Warm', exact: true }).click()

  await expect.poll(() => stagePixels(page)).not.toBe(before)
})

test('a filter still reaches the photo when a text layer is selected', async ({ page }) => {
  await importPhoto(page)

  await page.getByRole('button', { name: 'Text' }).click()
  await page.getByRole('button', { name: /Bold Headline/i }).click()
  const before = await stagePixels(page)

  await page.getByRole('button', { name: 'Filters' }).click()
  await page.getByRole('button', { name: 'Warm', exact: true }).click()

  await expect.poll(() => stagePixels(page)).not.toBe(before)
})

test('Remove Background one-click completes and edits the image', async ({ page }) => {
  await importPhoto(page)
  const before = await stagePixels(page)

  await page.getByRole('button', { name: 'Remove Background' }).click()

  // First run loads the ~25MB MODNet model, which is slow on a busy runner.
  await expect(page.getByText(/Remove Background complete/i)).toBeVisible({ timeout: 30_000 })
  await expect.poll(() => stagePixels(page)).not.toBe(before)
})

test('Magic Eraser asks for a selection before filling', async ({ page }) => {
  await importPhoto(page)
  await page.getByTestId('magic-eraser').click()
  await expect(page.getByText(/Click the object to select it/i)).toBeVisible()
})

function paneSample(page: Page, testId: string) {
  return page.evaluate((id) => {
    const pane = document.querySelector(`[data-testid="${id}"]`)
    const canvas = pane?.querySelector('canvas')
    if (!canvas) throw new Error(`${id} canvas missing`)
    const { data } = canvas.getContext('2d')!.getImageData(2, 2, 1, 1)
    const r = data[0]
    const g = data[1]
    const b = data[2]
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    return { r, g, b, chroma }
  }, testId)
}

test('compare BEFORE is the original and AFTER is the edit', async ({ page }) => {
  await importPhoto(page)
  await page.getByRole('button', { name: 'Filters' }).click()
  await page.getByRole('button', { name: 'Warm', exact: true }).click()

  await page.getByRole('button', { name: 'Compare' }).click()
  await page.getByTestId('compare-original').click()
  await expect(page.getByTestId('compare-before')).toBeVisible()

  // Sampled pixel sits in the #3e6a7a (62, 106, 122) quadrant of the test photo.
  await expect.poll(async () => {
    const before = await paneSample(page, 'compare-before')
    const after = await paneSample(page, 'compare-after')
    const beforeIsOriginal = Math.abs(before.r - 62) + Math.abs(before.g - 106) + Math.abs(before.b - 122) <= 12
    const afterChanged = Math.abs(after.r - before.r) + Math.abs(after.g - before.g) + Math.abs(after.b - before.b) > 10
    return beforeIsOriginal && afterChanged
  }).toBe(true)
})

test('an AI one-click reaches the photo when a text layer is selected', async ({ page }) => {
  await importPhoto(page, 'dim')

  await page.getByRole('button', { name: 'Text' }).click()
  await page.getByRole('button', { name: /Bold Headline/i }).click()
  const before = await stagePixels(page)

  await page.getByRole('button', { name: 'AI' }).click()
  await page.getByRole('button', { name: 'Vibrance' }).click()

  await expect(page.getByText(/Vibrance complete/i)).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => stagePixels(page)).not.toBe(before)
})

test('Low Light one-click changes the image', async ({ page }) => {
  await importPhoto(page, 'dim')
  const before = await stagePixels(page)

  await page.getByRole('button', { name: 'Low Light' }).click()

  await expect(page.getByText(/Low Light complete/i)).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => stagePixels(page)).not.toBe(before)
})

test('Vibrance one-click changes the image', async ({ page }) => {
  await importPhoto(page, 'dim')
  const before = await stagePixels(page)

  await page.getByRole('button', { name: 'Vibrance' }).click()

  await expect(page.getByText(/Vibrance complete/i)).toBeVisible({ timeout: 15_000 })
  await expect.poll(() => stagePixels(page)).not.toBe(before)
})

test('export dialog offers a creator pack, watermark, and carousel split', async ({ page }) => {
  await importPhoto(page)
  await page.getByRole('button', { name: 'Export' }).click()
  await expect(page.getByRole('heading', { name: 'Export for social' })).toBeVisible()
  await page.getByRole('button', { name: 'Creator pack' }).click()
  await expect(page.getByText('YouTube Thumbnail', { exact: true })).toBeVisible()
  await expect(page.getByTestId('yt-squeeze-note')).toBeVisible()
  await expect(page.getByText('Pinterest Pin')).toBeVisible()
  await page.getByText('Watermark handle on every export').click()
  await expect(page.getByPlaceholder('@yourhandle')).toBeVisible()
  await expect(page.getByText('Also split a wide photo into Instagram carousel tiles')).toBeVisible()
})
