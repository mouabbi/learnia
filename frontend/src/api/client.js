/**
 * Shared API client — every feature's API calls go through this, instead of
 * calling `fetch` directly everywhere. Centralizes the base URL, JSON
 * handling, and error handling so features don't each reinvent it.
 *
 * Base URL comes from VITE_API_BASE_URL (see .env.development /
 * .env.production), not hardcoded — that's what lets dev (proxied through
 * Vite to localhost:8000) and a later production build (real API domain)
 * use different values without touching this code. `import.meta.env` is
 * Vite's replacement for Node's `process.env` in browser code; only
 * variables prefixed VITE_ are exposed to the client bundle.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL

/**
 * Custom error class so callers can distinguish "the API returned an error
 * response" from a network failure, and read the structured error code
 * the backend sends (see backend/exceptions.py for the matching shape).
 */
export class ApiError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    const error = body?.error
    throw new ApiError(
      response.status,
      error?.code ?? 'UNKNOWN_ERROR',
      error?.message ?? 'Something went wrong',
    )
  }

  // No content (e.g. 204 on delete) — nothing to parse.
  if (response.status === 204) return null

  return response.json()
}

export const apiClient = {
  get: (path) => request(path),
  post: (path, data) => request(path, { method: 'POST', body: JSON.stringify(data) }),
  patch: (path, data) => request(path, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (path) => request(path, { method: 'DELETE' }),
}
