import type { JWT } from "next-auth/jwt"
import type { Session } from "next-auth"

/**
 * Auth.js callbacks, kept free of provider wiring so they can be unit tested.
 *
 * The GitHub tokens live only in the encrypted, httpOnly JWT cookie. The
 * `session` object is what `GET /api/auth/session` returns to the browser, so
 * it must never carry them; server code reads the token with
 * `readAccessToken` (see `lib/access-token.ts`).
 */

/**
 * `profile` is typed as the generic `Profile`; the GitHub provider's payload is
 * a `GitHubProfile`, which carries `login`.
 */
function githubLogin(profile: unknown): string | undefined {
  const login = (profile as { login?: unknown })?.login
  return typeof login === "string" ? login : undefined
}

export function applyJwt(
  token: JWT,
  account?: {
    access_token?: string
    refresh_token?: string
    expires_at?: number
  } | null,
  profile?: unknown
): JWT {
  if (account) {
    token.accessToken = account.access_token
    token.refreshToken = account.refresh_token
    token.expiresAt = account.expires_at
  }
  if (profile) {
    token.login = githubLogin(profile)
  }
  return token
}

export function toClientSession(session: Session, token: JWT): Session {
  session.user.login = token.login as string
  return session
}
