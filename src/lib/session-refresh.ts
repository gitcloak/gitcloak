import { encode, type JWT } from "next-auth/jwt"

import {
  isSecureSession,
  readSessionToken,
  sessionCookieName,
} from "@/lib/access-token"
import {
  needsRefresh,
  nowInSeconds,
  refreshGitHubToken,
} from "@/lib/token-refresh"

/** Auth.js's default session lifetime, used when the cookie has no `exp`. */
const DEFAULT_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export interface RefreshedSession {
  cookieName: string
  cookieValue: string
  maxAge: number
  secure: boolean
  /** The request's `Cookie` header with the session cookie replaced. */
  cookieHeader: string
}

/**
 * If the GitHub token is about to expire, refresh it and re-encrypt the Auth.js
 * session cookie with the rotated tokens.
 *
 * Returns `null` when no refresh is needed or the refresh failed. A failed
 * refresh leaves the cookie alone; the next GitHub call then returns 401 and
 * the session is ended (see `app/api/session/end`).
 *
 * The cookie is returned rather than set here so the middleware can also pass
 * the new value to the route in the same request. Without that, the route would
 * read the expired token and fail.
 */
export async function refreshSessionIfExpiring(
  headers: Headers,
  {
    secret = process.env.AUTH_SECRET,
    fetchImpl = fetch,
    now = nowInSeconds(),
  }: { secret?: string; fetchImpl?: typeof fetch; now?: number } = {}
): Promise<RefreshedSession | null> {
  if (!secret) return null

  const token = await readSessionToken(headers, secret)
  if (!token || !needsRefresh(token, now)) return null
  if (typeof token.refreshToken !== "string") return null

  const tokens = await refreshGitHubToken(token.refreshToken, {
    fetchImpl,
    now,
  })
  if (!tokens) return null

  // `encode` sets `iat`, `exp` and `jti` itself. Keep the original expiry so
  // that refreshing does not extend the session past its sign-in lifetime.
  const claims: JWT = { ...token }
  delete claims.iat
  delete claims.exp
  delete claims.jti

  const maxAge =
    typeof token.exp === "number"
      ? Math.max(token.exp - now, 1)
      : DEFAULT_MAX_AGE_SECONDS

  const cookieName = sessionCookieName(headers)
  const cookieValue = await encode({
    token: {
      ...claims,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
    },
    secret,
    salt: cookieName,
    maxAge,
  })

  return {
    cookieName,
    cookieValue,
    maxAge,
    secure: isSecureSession(headers),
    cookieHeader: replaceCookie(
      headers.get("cookie") ?? "",
      cookieName,
      cookieValue
    ),
  }
}

function replaceCookie(header: string, name: string, value: string): string {
  const others = header
    .split(";")
    .map((pair) => pair.trim())
    .filter((pair) => pair && !pair.startsWith(`${name}=`))
  return [...others, `${name}=${value}`].join("; ")
}
