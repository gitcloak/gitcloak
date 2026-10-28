/**
 * Refresh for the GitHub App user access token.
 *
 * GitHub App user tokens expire after about 8 hours, and every refresh returns
 * a new refresh token that replaces the old one. Callers must store the
 * rotated pair, or the next refresh fails.
 */

/** Refresh this long before the access token expires, to absorb clock skew. */
export const REFRESH_WINDOW_SECONDS = 5 * 60

export interface GitHubTokens {
  accessToken: string
  refreshToken: string
  /** Seconds since the epoch, the same unit Auth.js uses. */
  expiresAt?: number
}

export function nowInSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

/** True when the stored token has a refresh token and is close to expiry. */
export function needsRefresh(
  token: { refreshToken?: unknown; expiresAt?: unknown },
  now = nowInSeconds()
): boolean {
  if (typeof token.refreshToken !== "string" || !token.refreshToken) return false
  if (typeof token.expiresAt !== "number") return false
  return token.expiresAt - now <= REFRESH_WINDOW_SECONDS
}

interface RefreshResponse {
  access_token?: unknown
  refresh_token?: unknown
  expires_in?: unknown
}

/**
 * Exchange a refresh token for a new access token and refresh token.
 *
 * Returns `null` on any failure: a rejected refresh token, a network error or
 * missing OAuth credentials. GitHub reports a rejected refresh token with a
 * 200 response and an `error` field, so that case is checked explicitly.
 */
export async function refreshGitHubToken(
  refreshToken: string,
  { fetchImpl = fetch, now = nowInSeconds() } = {}
): Promise<GitHubTokens | null> {
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  let response: Response
  try {
    response = await fetchImpl("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    })
  } catch {
    return null
  }
  if (!response.ok) return null

  const body = (await response.json().catch(() => null)) as RefreshResponse | null
  if (
    typeof body?.access_token !== "string" ||
    typeof body.refresh_token !== "string"
  ) {
    return null
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt:
      typeof body.expires_in === "number" ? now + body.expires_in : undefined,
  }
}
