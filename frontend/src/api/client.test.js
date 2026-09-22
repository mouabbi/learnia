import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiClient } from './client'

// fetch is replaced by a fake, so no real network call is ever made.
function mockFetch(status, body) {
  const fake = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  })
  vi.stubGlobal('fetch', fake)
  return fake
}

afterEach(() => vi.unstubAllGlobals())

describe('apiClient', () => {
  it('returns parsed JSON on success', async () => {
    const fake = mockFetch(200, { id: 1, email: 'a@b.com' })
    const data = await apiClient.get('/auth/me')
    expect(data).toEqual({ id: 1, email: 'a@b.com' })
    expect(fake.mock.calls[0][0]).toBe('/api/v1/auth/me')
  })

  it('sends POST data as a JSON body', async () => {
    const fake = mockFetch(200, {})
    await apiClient.post('/auth/login/password', { email: 'a@b.com', password: 'x' })
    const options = fake.mock.calls[0][1]
    expect(options.method).toBe('POST')
    expect(JSON.parse(options.body)).toEqual({ email: 'a@b.com', password: 'x' })
  })

  it('returns null for 204 No Content', async () => {
    mockFetch(204)
    expect(await apiClient.post('/auth/logout')).toBeNull()
  })

  it('throws ApiError carrying the backend error code and message', async () => {
    mockFetch(401, { error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } })
    const error = await apiClient.get('/auth/me').catch((e) => e)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(401)
    expect(error.code).toBe('UNAUTHORIZED')
    expect(error.message).toBe('Invalid email or password')
  })

  it('falls back to a generic error when the body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 500, json: () => Promise.reject(new Error()) }),
    )
    const error = await apiClient.get('/x').catch((e) => e)
    expect(error.code).toBe('UNKNOWN_ERROR')
  })
})
