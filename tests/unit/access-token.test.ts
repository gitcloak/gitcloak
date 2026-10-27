import { describe, expect, it } from 'vitest'
import { encode } from 'next-auth/jwt'
import type { Session } from 'next-auth'
import { readAccessToken } from '@/lib/access-token'
import { applyJwt, toClientSession } from '@/lib/auth-callbacks'

const SECRET = 'unit-test-secret-unit-test-secret'
const COOKIE = 'authjs.session-token'

async function headersWithJwt(
  claims: Record<string, unknown>,
  secret = SECRET,
  cookieName = COOKIE
) {
  const jwt = await encode({ token: claims, secret, salt: cookieName })
  return new Headers({ cookie: `${cookieName}=${jwt}` })
}

describe('readAccessToken', () => {
  it('reads the GitHub token from the encrypted session cookie', async () => {
    const headers = await headersWithJwt({ accessToken: 'gho_secret', login: 'octo' })
    expect(await readAccessToken(headers, SECRET)).toBe('gho_secret')
  })

  it('reads the __Secure- cookie used over HTTPS (Vercel production and previews)', async () => {
    const headers = await headersWithJwt(
      { accessToken: 'gho_secure' },
      SECRET,
      '__Secure-authjs.session-token'
    )
    expect(await readAccessToken(headers, SECRET)).toBe('gho_secure')
  })

  it('ignores a bearer token in the Authorization header', async () => {
    const jwt = await encode({ token: { accessToken: 'gho_bearer' }, secret: SECRET, salt: COOKIE })
    const headers = new Headers({ authorization: `Bearer ${jwt}` })
    expect(await readAccessToken(headers, SECRET)).toBeUndefined()
  })

  it('returns undefined without a cookie, with a wrong secret, or without AUTH_SECRET', async () => {
    expect(await readAccessToken(new Headers(), SECRET)).toBeUndefined()

    const headers = await headersWithJwt({ accessToken: 'gho_secret' })
    expect(await readAccessToken(headers, 'a-different-secret-entirely-xxxxx')).toBeUndefined()
    expect(await readAccessToken(headers, '')).toBeUndefined()
  })

  it('returns undefined when the session has no token', async () => {
    const headers = await headersWithJwt({ login: 'octo' })
    expect(await readAccessToken(headers, SECRET)).toBeUndefined()
  })
})

describe('session callbacks', () => {
  it('stores tokens in the JWT only', () => {
    const token = applyJwt(
      {},
      { access_token: 'a', refresh_token: 'r', expires_at: 1 },
      { login: 'octo' }
    )
    expect(token).toMatchObject({ accessToken: 'a', refreshToken: 'r', expiresAt: 1, login: 'octo' })
  })

  it('never puts a token on the session sent to the browser', () => {
    const token = applyJwt({}, { access_token: 'a', refresh_token: 'r' }, { login: 'octo' })
    const session = toClientSession(
      { user: { id: '1', name: 'n' }, expires: 'x' } as unknown as Session,
      token
    )
    const serialized = JSON.stringify(session)
    expect(serialized).not.toContain('accessToken')
    expect(serialized).not.toContain('refreshToken')
    expect(serialized).not.toMatch(/"a"|"r"/)
    expect(session.user.login).toBe('octo')
  })
})
