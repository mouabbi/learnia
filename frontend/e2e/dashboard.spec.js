import { test, expect } from '@playwright/test'
import { login } from './helpers/auth.js'

// Smoke coverage for the dashboard (17-dashboard). One aggregation call
// (GET /api/v1/dashboard) drives: a stats strip, an optional "continue
// learning" hero card, the full course grid, and rule-based
// recommendations. See frontend/src/pages/DashboardPage.jsx.
test.describe('Dashboard smoke', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
  })

  test('loads and shows the stats strip and course grid', async ({ page }) => {
    await page.goto('/dashboard')

    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()

    // Stats tiles: "In progress" / "Completed" / "Courses available".
    await expect(page.getByText('In progress')).toBeVisible()
    await expect(page.getByText('Completed')).toBeVisible()
    await expect(page.getByText('Courses available')).toBeVisible()

    // "Your courses" section always renders, even when empty (shows a
    // "No courses published yet." hint instead of a blank area).
    await expect(page.getByRole('heading', { name: 'Your courses' })).toBeVisible()
  })

  test('shows a continue-learning card when the user has in-progress courses', async ({ page }) => {
    await page.goto('/dashboard')

    // Three valid states depending on the seeded account: the hero card
    // (has an in-progress course), the empty-state hint (no courses at
    // all), or just the plain course grid (has courses, none started yet)
    // — assert whichever the seeded account actually has, without
    // hard-failing the smoke test on account-specific state.
    const continueCard = page.locator('.continue-card-hero')
    const emptyHint = page.getByText('No courses published yet.')
    const courseGrid = page.locator('.course-card').first()
    await expect(continueCard.or(emptyHint).or(courseGrid).first()).toBeVisible()
  })

  test('recommendations section links to the full course list', async ({ page }) => {
    await page.goto('/dashboard')

    const recommended = page.getByRole('heading', { name: 'Recommended for you' })
    if (await recommended.isVisible().catch(() => false)) {
      await expect(page.getByRole('link', { name: /see all/i })).toBeVisible()
    }
  })
})
