// Shared login helper for E2E specs.
//
// There is no test-only "create user" API, so this logs in via the real
// /login form and, if that account doesn't exist yet, falls back to
// registering it via the real /register form (same pattern already used
// by e2e/accessibility.spec.js and e2e/performance.spec.js for their own
// per-run throwaway users) — so the very first run creates the account and
// every run after that just logs in.
//
// Override via env vars so CI (or you) can point at a different account
// without editing this file:
//   E2E_USER_EMAIL / E2E_USER_PASSWORD
export const E2E_USER_EMAIL = process.env.E2E_USER_EMAIL || 'medousouabbi@gmail.com'
export const E2E_USER_PASSWORD = process.env.E2E_USER_PASSWORD || 'AZERTYUI'

/**
 * Logs in via the real /login form (LoginPage.jsx) and waits for the
 * redirect away from /login, i.e. AuthContext's `user` is set. If the
 * account doesn't exist yet, registers it via /register first, then retries
 * login. Does not handle the MFA challenge step — this account is expected
 * to have MFA disabled, same assumption the rest of these specs make.
 */
export async function login(page, email = E2E_USER_EMAIL, password = E2E_USER_PASSWORD) {
  await page.goto('/login')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/^password$/i).fill(password)
  await page.getByRole('button', { name: /log in/i }).click()

  const loggedIn = await page
    .waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 5_000 })
    .then(() => true)
    .catch(() => false)

  if (loggedIn) return

  // Account doesn't exist yet (or password mismatch) — register it, then
  // registration itself logs the new user in (see AuthContext.register).
  await page.goto('/register')
  await page.getByLabel(/email/i).fill(email)
  await page.getByLabel(/^password$/i).fill(password)
  await page.getByRole('button', { name: /register|sign up|create account/i }).click()
  await page.waitForURL((url) => !url.pathname.startsWith('/register'), { timeout: 10_000 })
}
