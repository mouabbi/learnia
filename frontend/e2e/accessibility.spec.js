// Accessibility audit sweep (19-performance-accessibility) across the
// learner view, the CMS workspace, and theming (Settings tab, which hosts
// ThemeEditor — see frontend/src/features/cms/SettingsTab.jsx).
//
// ASSUMED DEPENDENCY: `@axe-core/playwright` is not yet in
// frontend/package.json (checked: no @axe-core/* or axe-core devDependency
// today). This spec assumes it will be added alongside @playwright/test.
// Until installed, `import AxeBuilder from '@axe-core/playwright'` fails
// to resolve and every test in this file fails at import time.
//
// Auth: reuses the same register-through-the-UI approach the rest of this
// suite's E2E journeys use (per TEST-AUTOMATION-GUIDE.md step 4) — a
// fresh, unique email per test run so registration always succeeds against
// a real (not mocked) backend.
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

function uniqueEmail() {
  return `a11y-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

async function registerAndLogIn(page) {
  await page.goto('/register')
  await page.getByLabel(/email/i).fill(uniqueEmail())
  await page.getByLabel(/^password$/i).fill('password123456')
  await page.getByRole('button', { name: /register|sign up|create account/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/register'), { timeout: 10_000 })
}

// Only the WCAG 2.x A/AA rule set — matches the AA thresholds already
// enforced server-side by backend/src/learnia_backend/utils/contrast.py
// (AA_NORMAL_TEXT_RATIO = 4.5, AA_LARGE_TEXT_RATIO = 3.0), so a violation
// here and a contrast warning there are checking the same bar from two
// angles (this scans real rendered CSS; contrast.py validates the theme's
// stored hex values before they're ever painted).
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

test.describe('Accessibility audit', () => {
  test('learner course-catalog view has no axe violations', async ({ page }) => {
    await registerAndLogIn(page)
    await page.goto('/courses')
    await expect(page.getByRole('heading').first()).toBeVisible()

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })

  test('course reader (learner content view) has no axe violations', async ({ page }) => {
    await registerAndLogIn(page)
    await page.goto('/courses')
    // Opens the reader for whichever course is first in the catalog — the
    // reader is a docs-style shell rendered outside AppLayout (see
    // App.jsx), so this just needs any published course to exist.
    const firstCourseLink = page.locator('a[href*="/learn"]').first()
    if (await firstCourseLink.count()) {
      const [readerPage] = await Promise.all([
        page.context().waitForEvent('page').catch(() => null),
        firstCourseLink.click(),
      ])
      const target = readerPage ?? page
      await target.waitForLoadState('networkidle')
      const results = await new AxeBuilder({ page: target }).withTags(WCAG_TAGS).analyze()
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
    } else {
      test.skip(true, 'No published course in this environment to open the reader with.')
    }
  })

  test('CMS workspace (Structure/Content tabs) has no axe violations', async ({ page }) => {
    await registerAndLogIn(page)
    await page.goto('/courses')
    const firstCmsLink = page.locator('a[href*="/cms/"]').first()
    if (await firstCmsLink.count()) {
      await firstCmsLink.click()
      await page.waitForLoadState('networkidle')
      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
      expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
    } else {
      test.skip(true, 'No course available to open the CMS workspace with.')
    }
  })

  test('theming page (CMS Settings tab, ThemeEditor) has no axe violations', async ({ page }) => {
    await registerAndLogIn(page)
    await page.goto('/courses')
    const firstCmsLink = page.locator('a[href*="/cms/"]').first()
    if (!(await firstCmsLink.count())) {
      test.skip(true, 'No course available to open the CMS workspace with.')
      return
    }
    await firstCmsLink.click()
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByText('Brand colors')).toBeVisible()

    const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })

  test('theming page: every rendered color pairing meets WCAG AA contrast (ties to contrast.py)', async ({
    page,
  }) => {
    await registerAndLogIn(page)
    await page.goto('/courses')
    const firstCmsLink = page.locator('a[href*="/cms/"]').first()
    if (!(await firstCmsLink.count())) {
      test.skip(true, 'No course available to open the CMS workspace with.')
      return
    }
    await firstCmsLink.click()
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByText('Brand colors')).toBeVisible()

    // axe-core's 'color-contrast' rule directly maps onto the backend's
    // AA thresholds; scoping the scan to just that rule keeps this test
    // fast and its intent obvious relative to the broader sweeps above.
    const results = await new AxeBuilder({ page })
      .include('.theme-editor')
      .withRules(['color-contrast'])
      .analyze()
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])

    // If the backend already flagged a contrast problem for this course's
    // theme (theme.py's `warnings`, built by utils/contrast.py), that
    // should be visibly surfaced in the UI too — not just caught by axe.
    const warningItems = page.locator('.theme-editor-warning')
    const warningCount = await warningItems.count()
    if (warningCount > 0) {
      await expect(warningItems.first()).toContainText(/fails AA/)
    }
  })
})
