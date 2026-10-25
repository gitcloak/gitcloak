import { test, expect } from './helpers'

/**
 * These endpoints are what break on a Vercel preview when the production-scoped
 * GitHub/Auth environment variables are missing. In mock mode they must answer
 * with a simulated, already-signed-in session instead of letting Auth.js throw
 * `MissingSecret` and render the "server configuration" error page.
 */
test.describe('Mock authentication', () => {
  test('serves a signed-in session without any GitHub credentials', async ({
    request,
  }) => {
    const response = await request.get('/api/auth/session')
    expect(response.status()).toBe(200)

    const session = await response.json()
    expect(session.user.login).toBe('mockuser')
    expect(session.user.email).toBe('mock@example.com')
    expect(session.accessToken).toBe('mock-access-token')
    expect(session.expires).toBeTruthy()
  })

  test('advertises the GitHub provider and CSRF token for the client library', async ({
    request,
  }) => {
    const providers = await request.get('/api/auth/providers')
    expect(providers.status()).toBe(200)
    expect((await providers.json()).github.type).toBe('oauth')

    const csrf = await request.get('/api/auth/csrf')
    expect(csrf.status()).toBe(200)
    expect((await csrf.json()).csrfToken).toBe('mock-csrf-token')
  })

  test('redirects the configuration error page to the app instead of erroring', async ({
    request,
  }) => {
    const response = await request.get('/api/auth/error', { maxRedirects: 0 })
    expect(response.status()).toBe(302)
    expect(response.headers()['location']).toContain('/app')
  })
})
