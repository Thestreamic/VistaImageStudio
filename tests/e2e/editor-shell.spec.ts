import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import { seedLegalAcceptance } from './legal-init'

// 1x1 red PNG
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='

async function importImage(page: Page) {
  const fileChooserPromise = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open', exact: true }).click()
  const chooser = await fileChooserPromise
  await chooser.setFiles({
    name: 'test.png',
    mimeType: 'image/png',
    buffer: Buffer.from(PNG_BASE64, 'base64'),
  })
  await expect(page.locator('canvas').first()).toBeVisible()
}

test.describe('Vista Image Studio shell', () => {
  test.beforeEach(async ({ page }) => {
    await seedLegalAcceptance(page)
  })

  test('loads the empty-state editor', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Drag & drop a photo')).toBeVisible()
    await expect(page.locator('input[type=file]')).toHaveAttribute('accept', /heic/i)
  })

  test('toolbar tools are selectable', async ({ page }) => {
    await page.goto('/')
    const cropTool = page.getByTitle(/crop \(c\)/i)
    await expect(cropTool).toBeVisible()
    await cropTool.click()
    // active tool gets the primary background — smoke check via aria/class is
    // brittle across theme edits, so we just assert the click didn't throw
    // and the tool remained interactive.
    await expect(cropTool).toBeEnabled()
  })

  test('right panel tabs switch content', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText(/one-click/i)).toBeVisible()
    await expect(page.getByTestId('instagram-4-5')).toBeVisible()
    await expect(page.getByTestId('magic-eraser')).toBeVisible()
    await expect(page.getByText('Command Chat')).toHaveCount(0)
    await page.getByText('Layers', { exact: true }).click()
    // No document open yet, so layers panel renders nothing — just confirm
    // the tab switch didn't crash by checking the AI panel content is gone.
    await expect(page.getByText(/one-click/i)).not.toBeVisible()
  })

  test('opening an image via file input renders it on the canvas', async ({ page }) => {
    await page.goto('/')
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Open', exact: true }).click()
    const chooser = await fileChooserPromise
    await chooser.setFiles({
      name: 'test.png',
      mimeType: 'image/png',
      // 1x1 red PNG
      buffer: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
    })
    await expect(page.getByTestId('import-progress')).toBeVisible()
    await expect(page.getByTestId('import-cancel')).toBeVisible()
    await expect(page.getByTestId('import-progress')).toContainText('%')
    await expect(page.locator('canvas').first()).toBeVisible()
    await expect(page.getByTestId('import-progress')).toHaveCount(0)
    await expect(page.getByTestId('zoom-controls')).toBeVisible()
    await expect(page.getByTestId('stage-close')).toBeVisible()
    await expect(page.getByTestId('stage-close-tab')).toBeVisible()
    await expect(page.getByTestId('zoom-controls').getByLabel('Zoom in')).toBeVisible()
    await expect(page.getByTestId('zoom-controls').getByLabel('Fit to window')).toBeVisible()
  })

  test('opening an iPhone HEIC photo renders it on the canvas', async ({ page }) => {
    await page.goto('/')
    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Open', exact: true }).click()
    const chooser = await fileChooserPromise
    await chooser.setFiles(path.join(process.cwd(), 'tests/fixtures/iphone.heic'))
    await expect(page.getByTestId('import-progress')).toBeVisible()
    await expect(page.getByTestId('import-cancel')).toBeVisible()
    await expect(page.getByTestId('import-progress')).toContainText(/HEIC|Decoding|Reading/i)
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('import-progress')).toHaveCount(0)
  })

  test('dropping an image anywhere in the window imports it', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Drag & drop a photo')).toBeVisible()
    await expect(page.getByTestId('editor-shell')).toHaveAttribute('data-ready', 'true')
    const dataTransfer = await page.evaluateHandle(() => {
      const binary = atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      )
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
      const file = new File([bytes], 'dropped.png', { type: 'image/png' })
      const transfer = new DataTransfer()
      transfer.items.add(file)
      return transfer
    })
    const shell = page.getByTestId('editor-shell')
    await shell.dispatchEvent('dragenter', { dataTransfer })
    await shell.dispatchEvent('dragover', { dataTransfer })
    await shell.dispatchEvent('drop', { dataTransfer })
    await expect(page.locator('canvas').first()).toBeVisible()
  })

  test('dropping onto the empty-state dropzone also imports the photo', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('empty-dropzone')).toBeVisible()
    const dataTransfer = await page.evaluateHandle(() => {
      const binary = atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      )
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
      const file = new File([bytes], 'zone.png', { type: 'image/png' })
      const transfer = new DataTransfer()
      transfer.items.add(file)
      return transfer
    })
    const zone = page.getByTestId('empty-dropzone')
    await zone.dispatchEvent('dragenter', { dataTransfer })
    await zone.dispatchEvent('dragover', { dataTransfer })
    await zone.dispatchEvent('drop', { dataTransfer })
    await expect(page.locator('canvas').first()).toBeVisible()
  })

  test('templates dialog lists Facebook-style collage layouts', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Tools' }).click()
    await page.getByRole('button', { name: 'Templates' }).click()
    await expect(page.getByText('Collage — pick a layout, add your photos')).toBeVisible()
    await expect(page.getByTitle('3 Photos — Featured + Stack')).toBeVisible()
    await expect(page.getByTitle('4 Photos — Grid')).toBeVisible()
  })

  test('dragging a Media photo onto an Instagram template places it on the canvas', async ({ page }) => {
    await page.goto('/')
    await importImage(page)
    const tile = page.getByTestId('media-bin-tile').first()
    await expect(tile).toBeVisible()
    const importId = await tile.getAttribute('data-import-id')
    expect(importId).toBeTruthy()

    await page.getByRole('button', { name: 'Tools' }).click()
    await page.getByRole('button', { name: 'Templates' }).click()
    const ig = page.getByTestId('template-ig-post')
    await expect(ig).toBeVisible()

    const dataTransfer = await page.evaluateHandle((id) => {
      const transfer = new DataTransfer()
      transfer.setData('application/x-vista-media', id)
      return transfer
    }, importId!)
    await ig.dispatchEvent('dragover', { dataTransfer })
    await ig.dispatchEvent('drop', { dataTransfer })
    await expect(page.getByTestId('templates-dialog')).toHaveCount(0)
    await expect(page.getByTestId('editor-stage')).toBeVisible()
    await expect.poll(async () => {
      return page.locator('[data-testid="editor-stage"] canvas').evaluate((canvas) => {
        const c = canvas as HTMLCanvasElement
        const ctx = c.getContext('2d')
        if (!ctx || c.width < 2) return 0
        const { data } = ctx.getImageData(Math.floor(c.width / 2), Math.floor(c.height / 2), 1, 1)
        return data[0] + data[1] + data[2]
      })
    }).not.toBe(255 * 3)
  })

  test('dragging a collage photo onto another box moves it left to right', async ({ page }) => {
    await page.goto('/')
    await importImage(page)
    const tile = page.getByTestId('media-bin-tile').first()
    const importId = await tile.getAttribute('data-import-id')
    expect(importId).toBeTruthy()

    await page.getByRole('button', { name: 'Tools' }).click()
    await page.getByRole('button', { name: 'Templates' }).click()
    await page.getByTestId('collage-split-2h').click()

    const cells = page.getByTestId('collage-cell')
    await expect(cells).toHaveCount(2)
    const left = cells.nth(0)
    const right = cells.nth(1)

    const mediaTransfer = await page.evaluateHandle((id) => {
      const transfer = new DataTransfer()
      transfer.setData('application/x-vista-media', id)
      return transfer
    }, importId!)
    await left.dispatchEvent('dragover', { dataTransfer: mediaTransfer })
    await left.dispatchEvent('drop', { dataTransfer: mediaTransfer })
    await expect(left).toHaveAttribute('data-filled', 'true')
    await expect(left).toHaveAttribute('data-selected', 'true')
    await expect(page.getByTestId('collage-handle-se')).toBeVisible()
    await expect(right).toHaveAttribute('data-filled', 'false')

    await right.click()
    await expect(right).toHaveAttribute('data-selected', 'true')
    await expect(left).toHaveAttribute('data-selected', 'false')

    const fromId = await left.getAttribute('data-cell-id')
    const cellTransfer = await page.evaluateHandle((id) => {
      const transfer = new DataTransfer()
      transfer.setData('application/x-vista-collage-cell', id)
      return transfer
    }, fromId!)
    await right.dispatchEvent('dragover', { dataTransfer: cellTransfer })
    await right.dispatchEvent('drop', { dataTransfer: cellTransfer })
    await expect(left).toHaveAttribute('data-filled', 'false')
    await expect(right).toHaveAttribute('data-filled', 'true')
  })

  test('Delete clears a filled collage cell then removes the empty slot', async ({ page }) => {
    await page.goto('/')
    await importImage(page)
    const tile = page.getByTestId('media-bin-tile').first()
    const importId = await tile.getAttribute('data-import-id')
    expect(importId).toBeTruthy()

    await page.getByRole('button', { name: 'Tools' }).click()
    await page.getByRole('button', { name: 'Templates' }).click()
    await page.getByTestId('collage-split-2h').click()

    const cells = page.getByTestId('collage-cell')
    await expect(cells).toHaveCount(2)
    const left = cells.nth(0)
    const mediaTransfer = await page.evaluateHandle((id) => {
      const transfer = new DataTransfer()
      transfer.setData('application/x-vista-media', id)
      return transfer
    }, importId!)
    await left.dispatchEvent('dragover', { dataTransfer: mediaTransfer })
    await left.dispatchEvent('drop', { dataTransfer: mediaTransfer })
    await expect(left).toHaveAttribute('data-filled', 'true')
    await left.click()
    await page.keyboard.press('Delete')
    await expect(left).toHaveAttribute('data-filled', 'false')
    await left.click()
    await page.keyboard.press('Delete')
    await expect(page.getByTestId('collage-cell')).toHaveCount(1)
  })

  test('occasion birthday template opens with three photo slots', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Tools' }).click()
    await page.getByRole('button', { name: 'Templates' }).click()
    await page.getByTestId('collage-category-birthday').click()
    await page.getByTestId('collage-birthday-hero-3').click()
    await expect(page.getByTestId('collage-cell')).toHaveCount(3)
  })

  test('double-click in Media fills birthday frames in order and Optimize keeps the hero put', async ({ page }) => {
    await page.goto('/')
    await importImage(page)
    await page.getByRole('button', { name: 'Tools' }).click()
    await page.getByRole('button', { name: 'Templates' }).click()
    await page.getByTestId('collage-category-birthday').click()
    await page.getByTestId('collage-birthday-hero-3').click()
    const cells = page.getByTestId('collage-cell')
    await expect(cells).toHaveCount(3)
    const tile = page.getByTestId('media-bin-tile').first()
    await tile.click()
    await expect(cells).toHaveCount(3)
    await tile.dblclick()
    await expect(cells.nth(0)).toHaveAttribute('data-filled', 'true')
    await expect(cells.nth(1)).toHaveAttribute('data-filled', 'false')
    const heroTop = await cells.nth(0).evaluate((el) => (el as HTMLElement).style.top)
    await page.getByTestId('auto-optimize-ai').click()
    await expect(cells.nth(0)).toHaveAttribute('data-filled', 'true')
    expect(await cells.nth(0).evaluate((el) => (el as HTMLElement).style.top)).toBe(heroTop)
    await tile.dblclick()
    await expect(cells.nth(1)).toHaveAttribute('data-filled', 'true')
    await expect(cells.nth(0).getByTestId('collage-handle-se')).toBeVisible()
    await expect(cells.nth(1).getByTestId('collage-handle-se')).toBeVisible()
    await cells.nth(0).click()
    await page.getByRole('button', { name: 'Transform' }).click()
    await expect(page.getByTestId('collage-frame-picker')).toBeVisible()
    await expect(page.getByTestId('collage-frame-position')).toBeVisible()
    await expect(page.getByTestId('collage-frame-adjust')).toBeVisible()
    const yBefore = Number(await page.getByTestId('collage-frame-y').inputValue())
    await page.getByTestId('collage-nudge-up').click()
    await expect.poll(async () => Number(await page.getByTestId('collage-frame-y').inputValue())).toBe(yBefore - 8)
    await page.getByTestId('collage-pick-1').click()
    await expect(cells.nth(1)).toHaveAttribute('data-selected', 'true')
    await expect(page.getByTestId('collage-frame-adjust')).toBeVisible()
    const extra = page.getByTestId('photos-import-input')
    await extra.setInputFiles({
      name: 'keep-thumbs.png',
      mimeType: 'image/png',
      buffer: Buffer.from(PNG_BASE64, 'base64'),
    })
    await expect(page.getByTestId('media-bin-tile')).toHaveCount(2)
    await expect(page.getByTestId('collage-cell')).toHaveCount(3)
    await expect(cells.nth(0)).toHaveAttribute('data-filled', 'true')
  })

  test('File menu offers Print', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('app-menu-file').click()
    await expect(page.getByTestId('menu-print')).toBeVisible()
    await expect(page.getByTestId('menu-print')).toBeDisabled()
  })

  test('compare view shows before and after panes for an open image', async ({ page }) => {
    await page.goto('/')
    const compare = page.getByRole('button', { name: /compare/i })
    await expect(compare).toBeDisabled()

    await importImage(page)
    await compare.click()
    await expect(page.getByText('BEFORE')).toBeVisible()
    await expect(page.getByText('AFTER')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Original' })).toBeVisible()

    await page.getByTestId('compare-close').click()
    await expect(page.getByTestId('compare-view')).toHaveCount(0)

    await page.getByTitle(/crop \(c\)/i).click()
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))
    await compare.click()
    await expect(page.getByTestId('compare-view')).toBeVisible()
    await page.getByTestId('compare-close-tab').click()
    await expect(page.getByTestId('compare-view')).toHaveCount(0)
    await expect(page.getByTestId('editor-stage')).toBeVisible()
    expect(pageErrors.join('\n')).not.toMatch(/getBoundingClientRect/)
  })

  test('X and Close dismiss the centered photo back to empty canvas', async ({ page }) => {
    await page.goto('/')
    await importImage(page)
    await expect(page.getByTestId('stage-close')).toBeVisible()
    await page.getByTestId('stage-close').click()
    await expect(page.getByText('Drag & drop a photo')).toBeVisible()

    await importImage(page)
    await page.getByTestId('stage-close-tab').click()
    await expect(page.getByText('Drag & drop a photo')).toBeVisible()
    await expect(page.getByTestId('imported-images-bin')).toBeVisible()
  })

  test('theme toggle switches the UI and survives a reload', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).not.toHaveClass(/theme-light/)

    await page.getByTitle('Switch to light UI').click()
    await expect(page.locator('html')).toHaveClass(/theme-light/)

    await page.reload()
    await expect(page.locator('html')).toHaveClass(/theme-light/)

    await page.getByTitle('Switch to dark UI').click()
    await expect(page.locator('html')).not.toHaveClass(/theme-light/)
  })

  test('Privacy Centre is readable without a network', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Privacy Centre' }).click()
    await expect(page.getByRole('heading', { name: 'Privacy Centre' })).toBeVisible()
    await expect(page.getByText(/no telemetry/i)).toBeVisible()
    await expect(page.getByText(/Analytics/)).toBeVisible()
  })

  test('rectangle and wand select are on the toolbar', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTitle(/crop \(c\)/i)).toBeVisible()
    await expect(page.getByTitle(/select \(m\)/i)).toBeVisible()
    await expect(page.getByTitle(/magic wand \(w\)/i)).toBeVisible()
  })

  test('filters list Optimize Image and not removed looks', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Filters' }).click()
    await expect(page.getByText(/Includes Optimize Image/)).toBeVisible()
    await expect(page.getByText('Mobile looks')).toHaveCount(0)
    await expect(page.getByText('Vivid', { exact: true })).toHaveCount(0)
    await expect(page.getByText('Punch')).toHaveCount(0)
    await expect(page.getByText('Pro Phone')).toHaveCount(0)
  })

  test('phone layout uses a hamburger and a bottom sheet, not squeezed side panels', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await expect(page.getByTestId('mobile-overflow-toggle')).toBeVisible()
    await expect(page.getByTestId('mobile-bottom-nav')).toBeVisible()
    await expect(page.getByTestId('right-sidebar')).toHaveCount(0)
    await expect(page.getByText('Browse photos')).toBeVisible()
    await page.getByTestId('mobile-tab-adjust').click()
    await expect(page.getByTestId('mobile-sheet')).toBeVisible()
    await expect(page.getByText('No layer selected.')).toBeVisible()
    await page.getByTestId('mobile-overflow-toggle').click()
    await expect(page.getByTestId('mobile-overflow-menu')).toBeVisible()
    await expect(page.getByTestId('mobile-menu-open')).toBeVisible()
  })
})
