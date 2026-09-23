// Performance smoke checks (19-performance-accessibility, concept 4:
// "bundle size hygiene ... code splitting per route, especially the heavy
// exam/CMS views").
//
// GAP CONFIRMED: frontend/src/App.jsx imports every route eagerly —
//   import { WorkspacePage } from './pages/WorkspacePage'
//   import { ExamPage } from './features/exam/ExamPage'
// with no `React.lazy`/`Suspense` anywhere in App.jsx (grepped: zero
// matches for "lazy(" or "Suspense" in App.jsx as of this writing). That
// means the CMS workspace (heavy: block editors, AI import modal, asset
// picker, theming) and the exam view (heavy: motion/confetti/exam-sound)
// both ship in the same JS chunk as the rest of the app instead of their
// own route-level chunk.
//
// This can't be verified without a real Vite build (`vite build` produces
// the chunk manifest), which this task explicitly must not run. Instead,
// this is written as a network-level smoke test: after `vite build`, a
// lazy-loaded route requests an additional JS chunk only once that route
// is visited, distinct from the chunk(s) loaded for the home route. Until
// App.jsx uses React.lazy for /cms/:slug and /courses/:slug/exam, this
// test will fail (no extra chunk request ever fires — everything was
// already in the initial bundle).
import { test, expect } from '@playwright/test'

function uniqueEmail() {
  return `perf-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
}

async function registerAndLogIn(page) {
  await page.goto('/register')
  await page.getByLabel(/email/i).fill(uniqueEmail())
  await page.getByLabel(/^password$/i).fill('password123456')
  await page.getByRole('button', { name: /register|sign up|create account/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/register'), { timeout: 10_000 })
}

async function collectScriptRequests(page, action) {
  const requests = new Set()
  const listener = (req) => {
    if (req.resourceType() === 'script' || /\.[jt]sx?$/.test(new URL(req.url()).pathname)) {
      requests.add(req.url())
    }
  }
  page.on('request', listener)
  await action()
  page.off('request', listener)
  return requests
}

test.describe('Route-level code splitting', () => {
  test('the CMS workspace route loads an additional JS chunk beyond the initial bundle', async ({
    page,
  }) => {
    await registerAndLogIn(page);

    // Baseline: scripts already fetched once the home/courses view is idle.
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');
    const baseline = await collectScriptRequests(page, async () => {
      await page.waitForTimeout(200);
    });

    const firstCmsLink = page.locator('a[href*="/cms/"]').first();
    if (!(await firstCmsLink.count())) {
      test.skip(true, 'No course available to open the CMS workspace with.');
      return;
    }

    const duringNav = await collectScriptRequests(page, async () => {
      await firstCmsLink.click();
      await page.waitForLoadState('networkidle');
    });

    const newChunks = [...duringNav].filter((url) => !baseline.has(url));
    // Expect at least one route-specific chunk request that did not already
    // fire for the home/courses view — i.e. WorkspacePage (and its heavy
    // CMS children) is its own React.lazy()-loaded chunk.
    expect(
      newChunks.length,
      `Expected a lazy-loaded chunk for the CMS workspace route; saw no new script requests. ` +
        `This fails until App.jsx wraps WorkspacePage in React.lazy(). New requests seen: ${JSON.stringify([...duringNav])}`,
    ).toBeGreaterThan(0);
  });

  test('the exam route loads an additional JS chunk beyond the initial bundle', async ({ page }) => {
    await registerAndLogIn(page);
    await page.goto('/courses');
    await page.waitForLoadState('networkidle');
    const baseline = await collectScriptRequests(page, async () => {
      await page.waitForTimeout(200);
    });

    const firstExamLink = page.locator('a[href*="/exam"]').first();
    if (!(await firstExamLink.count())) {
      test.skip(true, 'No course with a final exam available in this environment.');
      return;
    }

    const duringNav = await collectScriptRequests(page, async () => {
      await firstExamLink.click();
      await page.waitForLoadState('networkidle');
    });

    const newChunks = [...duringNav].filter((url) => !baseline.has(url));
    expect(
      newChunks.length,
      `Expected a lazy-loaded chunk for the exam route; saw no new script requests. This fails ` +
        `until App.jsx wraps ExamPage in React.lazy(). New requests seen: ${JSON.stringify([...duringNav])}`,
    ).toBeGreaterThan(0);
  });
});
