import { NextResponse, type NextRequest } from "next/server"

import { SECURE_SESSION_COOKIE, SESSION_COOKIE } from "@/lib/access-token"

/**
 * Ends a session whose GitHub token GitHub has rejected. It clears the Auth.js
 * session cookie and returns to the landing page, which offers sign-in. This
 * skips Auth.js's sign-out confirmation page, which is not the right screen
 * when the user did not ask to sign out.
 */
export function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/", request.url), 302)

  for (const name of [SESSION_COOKIE, SECURE_SESSION_COOKIE]) {
    response.cookies.set(name, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: name === SECURE_SESSION_COOKIE,
      path: "/",
      maxAge: 0,
    })
  }
  return response
}
