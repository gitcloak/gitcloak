import { getToken } from "next-auth/jwt"

const SECURE_COOKIE = "__Secure-authjs.session-token"

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
  if (!secret) return undefined

  // Only the cookie is considered (not an `Authorization: Bearer` header).
  const cookie = headers.get("cookie") ?? ""

  // Auth.js names the cookie `__Secure-authjs.session-token` over HTTPS (Vercel
  // production and previews) and `authjs.session-token` over plain HTTP, and
  // uses that name as the encryption salt, so pick the one actually present.
  const secureCookie = cookie.includes(SECURE_COOKIE)

  const token = await getToken({
    req: { headers: new Headers({ cookie }) },
    secret,
    secureCookie,
  })
  return typeof token?.accessToken === "string" ? token.accessToken : undefined
}
