import { getToken, type JWT } from "next-auth/jwt"

/**
 * Auth.js names the session cookie `__Secure-authjs.session-token` over HTTPS
 * (Vercel production and previews) and `authjs.session-token` over plain HTTP.
 * The name is also the encryption salt, so both sides must agree on it.
 */
export const SESSION_COOKIE = "authjs.session-token"
export const SECURE_SESSION_COOKIE = "__Secure-authjs.session-token"

export function isSecureSession(headers: Headers): boolean {
  return (headers.get("cookie") ?? "").includes(SECURE_SESSION_COOKIE)
}

export function sessionCookieName(headers: Headers): string {
  return isSecureSession(headers) ? SECURE_SESSION_COOKIE : SESSION_COOKIE
}

/**
 * Decrypt the Auth.js session JWT from the cookie. The JWT carries the GitHub
 * tokens, so callers must not pass it on to the browser.
 */
export async function readSessionToken(
  headers: Headers,
  secret = process.env.AUTH_SECRET
): Promise<JWT | undefined> {
  if (!secret) return undefined

  // Only the cookie is considered (not an `Authorization: Bearer` header).
  const cookie = headers.get("cookie") ?? ""

  const token = await getToken({
    req: { headers: new Headers({ cookie }) },
    secret,
    secureCookie: isSecureSession(headers),
  })
  return token ?? undefined
}

/**
 * Read the GitHub access token from the Auth.js session cookie.
 *
 * The token is deliberately not part of the `Session` object (that is sent to
 * the browser by `/api/auth/session`), so server code decrypts it straight from
 * the JWT cookie. Returns `undefined` when there is no valid session.
 */
export async function readAccessToken(
  headers: Headers,
  secret = process.env.AUTH_SECRET
): Promise<string | undefined> {
  const token = await readSessionToken(headers, secret)
  return typeof token?.accessToken === "string" ? token.accessToken : undefined
}
