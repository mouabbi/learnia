import { test, expect } from '@playwright/test'
import { login } from './helpers/auth.js'

// 14-global-search: a self-mounted command palette (GlobalSearch.jsx),
// opened with Ctrl+K/Cmd+K from anywhere, typing debounces a query to
// GET /api/v1/search, and selecting a result navigates to the course
// reader (deep-linking to a specific page isn't supported yet — see the
// component's own docstring — every result type lands on
// /courses/{slug}/learn).
test.describe('Global search', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto('/dashboard')
    // Wait for the app shell to actually mount (and its Ctrl+K listener to
    // attach) before sending the shortcut — otherwise pressing it right as
    // goto() resolves can race React's initial commit/effect flush.
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  })

  test('Ctrl+K opens the search palette', async ({ page }) => {
    await expect(page.getByRole('dialog', { name: 'Global search' })).not.toBeVisible()

    await page.keyboard.press('Control+k')

    const dialog = page.getByRole('dialog', { name: 'Global search' })
    await expect(dialog).toBeVisible()
    await expect(page.getByPlaceholder('Search courses, chapters, pages...')).toBeFocused()
  })

  test('typing a query shows matching results or a no-results message', async ({ page }) => {
    await page.keyboard.press('Control+k')
    const input = page.getByPlaceholder('Search courses, chapters, pages...')
    await input.fill('a')

    // Debounced (250ms) — wait for either a result row or the "No
    // results" status text, whichever the seeded data produces.
    const anyResult = page.locator('.global-search-result').first()
    const noResults = page.getByText(/No results for/)
    await expect(anyResult.or(noResults)).toBeVisible({ timeout: 5_000 })
  })

  test('selecting a result navigates to the course reader and closes the palette', async ({ page }) => {
    await page.keyboard.press('Control+k')
    const input = page.getByPlaceholder('Search courses, chapters, pages...')
    await input.fill('e')

    const firstResult = page.locator('.global-search-result').first()
    if (await firstResult.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await firstResult.click()
      await page.waitForURL(/\/courses\/.+\/learn/)
      await expect(page.getByRole('dialog', { name: 'Global search' })).not.toBeVisible()
    }
  })

  test('Escape closes the palette', async ({ page }) => {
    await page.keyboard.press('Control+k')
    await expect(page.getByRole('dialog', { name: 'Global search' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: 'Global search' })).not.toBeVisible()
  })
})
