import { test, expect } from '@playwright/test'
import { login } from './helpers/auth.js'

// 16-theming: ThemeEditor.jsx, embedded in the CMS workspace's Settings
// tab (SettingsTab.jsx). Every color is a native <input type="color">
// swatch (aria-label = the field label); contrast warnings come straight
// from the backend (routers/theme.py + utils/contrast.py) after a save.
const COURSE_SLUG = process.env.E2E_COURSE_SLUG || 'e2e-course'

test.describe('Theming: edit colors, see contrast warnings, save', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`/cms/${COURSE_SLUG}`)
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('heading', { name: 'Brand colors' })).toBeVisible()
  })

  test('editing the accent color updates the live preview button', async ({ page }) => {
    const accentInput = page.getByLabel('Accent')
    await accentInput.fill('#ff00aa')

    await expect(page.locator('.theme-editor-preview-button').first()).toHaveCSS(
      'background-color',
      'rgb(255, 0, 170)',
    )
  })

  test('a low-contrast text/background pair produces a contrast warning', async ({ page }) => {
    // Light-mode text and background set to nearly the same color — well
    // below WCAG AA — should surface a warning from the backend's
    // computed `warnings` array after saving.
    await page.getByLabel('Background').first().fill('#ffffff')
    await page.getByLabel('Text').first().fill('#fefefe')

    await page.getByRole('button', { name: /save theme/i }).click()

    await expect(page.locator('.theme-editor-warning').first()).toBeVisible({ timeout: 10_000 })
  })

  test('saving a theme persists across a reload', async ({ page }) => {
    const accentInput = page.getByLabel('Accent')
    await accentInput.fill('#3366ff')

    await page.getByRole('button', { name: /save theme/i }).click()
    await expect(page.getByRole('button', { name: /saving/i })).toHaveCount(0)

    await page.reload()
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByLabel('Accent')).toHaveValue('#3366ff')
  })
})
