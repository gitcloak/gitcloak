import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { encode } from 'next-auth/jwt'
import { readAccessToken, readSessionToken, SESSION_COOKIE } from '@/lib/access-token'
import { refreshSessionIfExpiring } from '@/lib/session-refresh'
import { needsRefresh, refreshGitHubToken, REFRESH_WINDOW_SECONDS } from '@/lib/token-refresh'

const SECRET = 'unit-test-secret-unit-test-secret'
// Real time, because the JWT's own `exp` is checked against the wall clock.
const NOW = Math.floor(Date.now() / 1000)

function jsonFetch(body: unknown, status = 200) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as
    typeof fetch & ReturnType<typeof vi.fn>
}

async function sessionHeaders(claims: Record<string, unknown>, extraCookie = '') {
  const maxAge = 30 * 24 * 60 * 60
  const jwt = await encode({ token: claims, secret: SECRET, salt: SESSION_COOKIE, maxAge })
  const cookie = [`${SESSION_COOKIE}=${jwt}`, extraCookie].filter(Boolean).join('; ')
  return new Headers({ cookie })
}

beforeEach(() => {
  vi.stubEnv('GITHUB_CLIENT_ID', 'Iv1.test-client')
  vi.stubEnv('GITHUB_CLIENT_SECRET', 'test-client-secret')
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('needsRefresh', () => {
  it('is false without a refresh token or an expiry', () => {
    expect(needsRefresh({ expiresAt: NOW + 10 }, NOW)).toBe(false)
    expect(needsRefresh({ refreshToken: 'ghr_1' }, NOW)).toBe(false)
  })

  it('is false while the access token is comfortably valid', () => {
    expect(
      needsRefresh({ refreshToken: 'ghr_1', expiresAt: NOW + REFRESH_WINDOW_SECONDS + 1 }, NOW)
    ).toBe(false)
  })

  it('is true inside the refresh window and after expiry', () => {
    expect(
      needsRefresh({ refreshToken: 'ghr_1', expiresAt: NOW + REFRESH_WINDOW_SECONDS }, NOW)
    ).toBe(true)
    expect(needsRefresh({ refreshToken: 'ghr_1', expiresAt: NOW - 1 }, NOW)).toBe(true)
  })
})

describe('refreshGitHubToken', () => {
  it('exchanges the refresh token and returns the rotated pair', async () => {
    const fetchImpl = jsonFetch({
      access_token: 'gho_new',
      refresh_token: 'ghr_new',
      expires_in: 28800,
    })

    const tokens = await refreshGitHubToken('ghr_old', { fetchImpl, now: NOW })

    expect(tokens).toEqual({
      accessToken: 'gho_new',
      refreshToken: 'ghr_new',
      expiresAt: NOW + 28800,
    })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://github.com/login/oauth/access_token')
    const form = new URLSearchParams(init.body as string)
    expect(form.get('grant_type')).toBe('refresh_token')
    expect(form.get('refresh_token')).toBe('ghr_old')
    expect(form.get('client_id')).toBe('Iv1.test-client')
    expect(form.get('client_secret')).toBe('test-client-secret')
  })

  it('returns null when GitHub rejects the refresh token in a 200 body', async () => {
    const fetchImpl = jsonFetch({ error: 'bad_refresh_token' })
    expect(await refreshGitHubToken('ghr_old', { fetchImpl, now: NOW })).toBeNull()
  })

  it('returns null on an HTTP error or a network failure', async () => {
    expect(await refreshGitHubToken('ghr_old', { fetchImpl: jsonFetch({}, 500), now: NOW })).toBeNull()

    const failing = vi.fn(async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    expect(await refreshGitHubToken('ghr_old', { fetchImpl: failing, now: NOW })).toBeNull()
  })

  it('returns null without OAuth credentials', async () => {
    vi.stubEnv('GITHUB_CLIENT_SECRET', '')
    const fetchImpl = jsonFetch({ access_token: 'a', refresh_token: 'r' })
    expect(await refreshGitHubToken('ghr_old', { fetchImpl, now: NOW })).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('refreshSessionIfExpiring', () => {
  it('re-encrypts the session with the rotated tokens and keeps the other cookies', async () => {
    const headers = await sessionHeaders(
      {
        accessToken: 'gho_old',
        refreshToken: 'ghr_old',
        expiresAt: NOW + 60,
        login: 'octo',
      },
      'theme=dark'
    )
    const fetchImpl = jsonFetch({
      access_token: 'gho_new',
      refresh_token: 'ghr_new',
      expires_in: 28800,
    })

    const refreshed = await refreshSessionIfExpiring(headers, {
      secret: SECRET,
      fetchImpl,
      now: NOW,
    })

    expect(refreshed).not.toBeNull()
    expect(refreshed?.cookieName).toBe(SESSION_COOKIE)
    expect(refreshed?.secure).toBe(false)
    expect(refreshed?.cookieHeader).toContain('theme=dark')
    expect(refreshed?.cookieHeader).toContain(`${SESSION_COOKIE}=${refreshed?.cookieValue}`)

    const next = new Headers({ cookie: refreshed?.cookieHeader ?? '' })
    expect(await readAccessToken(next, SECRET)).toBe('gho_new')
    const token = await readSessionToken(next, SECRET)
    expect(token).toMatchObject({
      refreshToken: 'ghr_new',
      expiresAt: NOW + 28800,
      login: 'octo',
    })
  })

  it('leaves a token that is still valid alone and makes no GitHub call', async () => {
    const headers = await sessionHeaders({
      accessToken: 'gho_fresh',
      refreshToken: 'ghr_fresh',
      expiresAt: NOW + 3600,
    })
    const fetchImpl = jsonFetch({ access_token: 'x', refresh_token: 'y' })

    expect(
      await refreshSessionIfExpiring(headers, { secret: SECRET, fetchImpl, now: NOW })
    ).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('returns null when the refresh fails, so the stored cookie is not replaced', async () => {
    const headers = await sessionHeaders({
      accessToken: 'gho_old',
      refreshToken: 'ghr_old',
      expiresAt: NOW - 1,
    })
    const fetchImpl = jsonFetch({ error: 'bad_refresh_token' })

    expect(
      await refreshSessionIfExpiring(headers, { secret: SECRET, fetchImpl, now: NOW })
    ).toBeNull()
  })

  it('does nothing without a session cookie', async () => {
    const fetchImpl = jsonFetch({ access_token: 'x', refresh_token: 'y' })
    expect(
      await refreshSessionIfExpiring(new Headers(), { secret: SECRET, fetchImpl, now: NOW })
    ).toBeNull()
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
