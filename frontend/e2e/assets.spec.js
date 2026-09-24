import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from '@playwright/test'
import { login } from './helpers/auth.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// 15-assets: AssetUploader (drag/click upload) + AssetPicker (grid,
// click-to-select) both exist and work standalone (frontend/src/features/
// assets/AssetUploader.jsx, AssetPicker.jsx), but as of this writing
// neither is mounted into any route yet — BlockEditors.jsx's ImageEditor
// still has a `// TODO: swap in AssetPicker` in place of a real picker,
// and no CMS "Assets" tab exists. There is currently no way to reach this
// journey through the real UI.
//
// These specs are written against the intended integration (an Assets
// area reachable from the workspace, an ImageEditor block offering "Choose
// asset" backed by AssetPicker) so they're ready to un-skip the moment
// that wiring lands — per TEST-AUTOMATION-GUIDE.md's rule to test
// behavior, not implementation, there is deliberately no test here that
// pokes AssetUploader/AssetPicker in isolation outside a real page (that's
// component-test territory, not E2E).
const COURSE_SLUG = process.env.E2E_COURSE_SLUG || 'e2e-course'

test.describe('Assets: upload, pick, and use in a block', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test.fixme(
    'upload an image asset and see it appear in the picker',
    async ({ page }) => {
      await page.goto(`/cms/${COURSE_SLUG}`)
      // Hypothetical future entry point once an "Assets" tab/section exists.
      await page.getByRole('button', { name: /assets/i }).click()

      const fixture = path.join(__dirname, 'fixtures', 'sample-image.png')
      await page.setInputFiles('.asset-uploader-input', fixture)

      await expect(page.locator('.asset-uploader-row-done')).toBeVisible({ timeout: 10_000 })
      await expect(page.locator('.asset-picker-grid')).toContainText('sample-image.png')
    },
  )

  test.fixme(
    'select an uploaded asset into an image block from the Content tab',
    async ({ page }) => {
      await page.goto(`/cms/${COURSE_SLUG}`)
      await page.getByRole('button', { name: 'Structure' }).click()
      await page.locator('.cms-tree-toggle').first().click()
      await page.locator('.cms-tree-indent .cms-tree-toggle').first().click()
      await page.locator('.cms-tree-page-btn').first().click()

      // Add an image block, then use its (future) "Choose asset" trigger
      // instead of the current free-text "Image URL / asset id" field.
      await page.getByRole('button', { name: /add block: image/i }).click()
      await page.getByRole('button', { name: /choose asset/i }).click()

      const firstTile = page.locator('.asset-picker-tile').first()
      await expect(firstTile).toBeVisible()
      await firstTile.click()

      await expect(page.locator('.asset-picker-tile-selected')).toHaveCount(1)
    },
  )
})
