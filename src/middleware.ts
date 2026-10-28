import { NextResponse, type NextRequest } from "next/server"

import { refreshSessionIfExpiring } from "@/lib/session-refresh"

/**
 * Refreshes the GitHub access token before it expires, on the routes that call
 * GitHub. Middleware is the only place that can both read the session and set
 * its cookie before the route runs; server components cannot set cookies.
 */
export async function middleware(request: NextRequest) {
  const refreshed = await refreshSessionIfExpiring(request.headers)
  if (!refreshed) return NextResponse.next()

  const headers = new Headers(request.headers)
  headers.set("cookie", refreshed.cookieHeader)

  const response = NextResponse.next({ request: { headers } })
  response.cookies.set(refreshed.cookieName, refreshed.cookieValue, {
    httpOnly: true,
    sameSite: "lax",
    secure: refreshed.secure,
    path: "/",
    maxAge: refreshed.maxAge,
  })
  return response
}

export const config = {
  matcher: ["/app/:path*", "/api/repos/:path*"],
}
