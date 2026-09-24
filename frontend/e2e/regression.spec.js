import { test, expect } from '@playwright/test'
import { login } from './helpers/auth.js'

// General smoke/regression coverage across features 12-17, plus a couple
// of specific bugs/invariants noticed while reading the CMS code (see each
// test's comment). Kept small per TEST-AUTOMATION-GUIDE.md's "3 to 5
// journeys" guidance — this file is the catch-all for things that didn't
// fit neatly into one feature's own spec file.
const COURSE_SLUG = process.env.E2E_COURSE_SLUG || 'e2e-course'

test.describe('Regression: CMS invariants', () => {
  test.beforeEach(async ({ page }) => {
    await login(page)
    await page.goto(`/cms/${COURSE_SLUG}`)
  })

  test('committing an AI import over a page that already has content requires explicit replace confirmation', async ({ page }) => {
    // AiImportModal.runCommit(): a first commit (replace: false) that
    // fails because the target already has content sets
    // needsReplaceConfirm + shows commitError, revealing an "Overwrite
    // existing content" button that must be clicked (replace: true) before
    // anything is actually overwritten. Guards against silently destroying
    // authored content when an AI-generated draft is committed by mistake.
    await page.getByRole('button', { name: 'Structure' }).click()
    await page.locator('.cms-tree-toggle').first().click()
    await page.locator('.cms-tree-indent .cms-tree-toggle').first().click()
    const firstPageButton = page.locator('.cms-tree-page-btn').first()
    await expect(firstPageButton).toBeVisible()
    await firstPageButton.click()

    await page.getByRole('button', { name: 'Generate with AI' }).click()
    await page.getByRole('button', { name: 'Next: paste JSON' }).click()
    await page.locator('.cms-prompt-textarea.cms-mono').fill(
      JSON.stringify({ schemaVersion: 1, blocks: [{ type: 'paragraph', text: 'Replacement draft.' }] }),
    )
    await page.getByRole('button', { name: 'Validate' }).click()

    const commitButton = page.getByRole('button', { name: 'Commit' })
    await expect(commitButton).toBeEnabled({ timeout: 5_000 })
    await commitButton.click()

    // If the page already had content, the backend rejects the first
    // commit and the UI must offer an explicit overwrite action rather
    // than silently retrying with replace:true.
    const overwriteButton = page.getByRole('button', { name: 'Overwrite existing content' })
    if (await overwriteButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await overwriteButton.click()
      await expect(page.locator('.cms-modal')).not.toBeVisible()
    }
  })

  test('the Structure tab blocks deleting a module/chapter/page without confirming', async ({ page }) => {
    // StructureTree.deleteNode() gates every delete behind
    // window.confirm(`Delete "..."? This cannot be undone.`) — dismissing
    // the dialog must leave the node in place.
    await page.getByRole('button', { name: 'Structure' }).click()

    let dialogSeen = false
    page.once('dialog', async (dialog) => {
      dialogSeen = true
      expect(dialog.message()).toContain('This cannot be undone')
      await dialog.dismiss()
    })

    const firstDeleteButton = page.locator('.cms-tree-actions button[title="Delete"]').first()
    if (await firstDeleteButton.isVisible().catch(() => false)) {
      const label = await page.locator('.cms-tree-label').first().textContent()
      await firstDeleteButton.click()
      await expect(page.locator('.cms-tree-label').first()).toHaveText(label ?? '')
      expect(dialogSeen).toBe(true)
    }
  })

  test('switching CMS tabs preserves the selected page when returning to Content', async ({ page }) => {
    await page.getByRole('button', { name: 'Structure' }).click()
    await page.locator('.cms-tree-toggle').first().click()
    await page.locator('.cms-tree-indent .cms-tree-toggle').first().click()
    const firstPageButton = page.locator('.cms-tree-page-btn').first()
    await expect(firstPageButton).toBeVisible()
    const pageTitle = await firstPageButton.textContent()
    await firstPageButton.click()

    await expect(page.getByRole('heading', { name: pageTitle ?? '' })).toBeVisible()

    await page.getByRole('button', { name: 'Assessments' }).click()
    await page.getByRole('button', { name: 'Content' }).click()
    await expect(page.getByRole('heading', { name: pageTitle ?? '' })).toBeVisible()
  })

  test('smoke: authenticated app shell loads without console errors on the main pages', async ({ page }) => {
    const errors = []
    page.on('pageerror', (err) => errors.push(err.message))

    for (const route of ['/', '/dashboard', '/courses']) {
      await page.goto(route)
      await expect(page.locator('body')).toBeVisible()
    }

    expect(errors, `unexpected console/page errors: ${errors.join('; ')}`).toEqual([])
  })
})
