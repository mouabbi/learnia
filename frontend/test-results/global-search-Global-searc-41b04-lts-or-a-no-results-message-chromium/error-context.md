# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: global-search.spec.js >> Global search >> typing a query shows matching results or a no-results message
- Location: e2e\global-search.spec.js:30:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.global-search-result').first().or(getByText(/No results for/))
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('.global-search-result').first().or(getByText(/No results for/)) with timeout 5000ms
  - waiting for locator('.global-search-result').first().or(getByText(/No results for/))

```

```yaml
- dialog "Global search":
  - textbox "Search":
    - /placeholder: Search courses, chapters, pages...
    - text: a
  - button "Close search"
  - paragraph: Searching…
- banner:
  - button "Close menu" [expanded]
  - link "Learnia":
    - /url: /
  - button "Switch to dark mode"
- navigation "Main menu":
  - button "Collapse sidebar"
  - paragraph: medousouabbi
  - paragraph: medousouabbi@gmail.com
  - list:
    - listitem:
      - link "Home":
        - /url: /
    - listitem:
      - link "Courses":
        - /url: /courses
    - listitem:
      - link "Settings":
        - /url: /account
  - button "Log out"
- main:
  - heading "Dashboard" [level=1]
  - paragraph: Your courses, progress, and what to learn next.
  - heading "Your courses" [level=2]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | import { login } from './helpers/auth.js'
  3  | 
  4  | // 14-global-search: a self-mounted command palette (GlobalSearch.jsx),
  5  | // opened with Ctrl+K/Cmd+K from anywhere, typing debounces a query to
  6  | // GET /api/v1/search, and selecting a result navigates to the course
  7  | // reader (deep-linking to a specific page isn't supported yet — see the
  8  | // component's own docstring — every result type lands on
  9  | // /courses/{slug}/learn).
  10 | test.describe('Global search', () => {
  11 |   test.beforeEach(async ({ page }) => {
  12 |     await login(page)
  13 |     await page.goto('/dashboard')
  14 |     // Wait for the app shell to actually mount (and its Ctrl+K listener to
  15 |     // attach) before sending the shortcut — otherwise pressing it right as
  16 |     // goto() resolves can race React's initial commit/effect flush.
  17 |     await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible()
  18 |   })
  19 | 
  20 |   test('Ctrl+K opens the search palette', async ({ page }) => {
  21 |     await expect(page.getByRole('dialog', { name: 'Global search' })).not.toBeVisible()
  22 | 
  23 |     await page.keyboard.press('Control+k')
  24 | 
  25 |     const dialog = page.getByRole('dialog', { name: 'Global search' })
  26 |     await expect(dialog).toBeVisible()
  27 |     await expect(page.getByPlaceholder('Search courses, chapters, pages...')).toBeFocused()
  28 |   })
  29 | 
  30 |   test('typing a query shows matching results or a no-results message', async ({ page }) => {
  31 |     await page.keyboard.press('Control+k')
  32 |     const input = page.getByPlaceholder('Search courses, chapters, pages...')
  33 |     await input.fill('a')
  34 | 
  35 |     // Debounced (250ms) — wait for either a result row or the "No
  36 |     // results" status text, whichever the seeded data produces.
  37 |     const anyResult = page.locator('.global-search-result').first()
  38 |     const noResults = page.getByText(/No results for/)
> 39 |     await expect(anyResult.or(noResults)).toBeVisible({ timeout: 5_000 })
     |                                           ^ Error: expect(locator).toBeVisible() failed
  40 |   })
  41 | 
  42 |   test('selecting a result navigates to the course reader and closes the palette', async ({ page }) => {
  43 |     await page.keyboard.press('Control+k')
  44 |     const input = page.getByPlaceholder('Search courses, chapters, pages...')
  45 |     await input.fill('e')
  46 | 
  47 |     const firstResult = page.locator('.global-search-result').first()
  48 |     if (await firstResult.isVisible({ timeout: 5_000 }).catch(() => false)) {
  49 |       await firstResult.click()
  50 |       await page.waitForURL(/\/courses\/.+\/learn/)
  51 |       await expect(page.getByRole('dialog', { name: 'Global search' })).not.toBeVisible()
  52 |     }
  53 |   })
  54 | 
  55 |   test('Escape closes the palette', async ({ page }) => {
  56 |     await page.keyboard.press('Control+k')
  57 |     await expect(page.getByRole('dialog', { name: 'Global search' })).toBeVisible()
  58 |     await page.keyboard.press('Escape')
  59 |     await expect(page.getByRole('dialog', { name: 'Global search' })).not.toBeVisible()
  60 |   })
  61 | })
  62 | 
```