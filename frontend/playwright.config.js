import { defineConfig, devices } from '@playwright/test'

// Playwright config (feature 18-testing / step 4 of TEST-AUTOMATION-GUIDE.md:
// "a few E2E tests ... Keep this to about 3 to 5 journeys" per feature area).
// baseURL points at the Vite dev server (frontend/vite.config.js proxies
// /api to the backend on :8002), overridable so CI/local runs can target a
// different host without editing this file.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    // AiImportModal's "Copy to clipboard" button uses navigator.clipboard,
    // which silently no-ops without this permission granted up front.
    permissions: ['clipboard-read', 'clipboard-write'],
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // Only starts a dev server automatically when nothing is already running
  // at baseURL (reuseExistingServer) — this file is written, not run, so
  // this never executes as part of writing the suite.
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
