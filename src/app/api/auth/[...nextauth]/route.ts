import type { NextRequest } from "next/server"

import { handlers } from "@/auth"
import { isMockBackend } from "@/lib/backends"
import { MOCK_SESSION } from "@/lib/session"

/**
 * In mock mode (end-to-end tests and Vercel preview deployments) there are no
 * GitHub OAuth credentials and no `AUTH_SECRET`, so Auth.js must not run at
 * all. Instead we answer the handful of endpoints the UI touches with a
 * deterministic, already-signed-in session.
 */
function mockSession() {
  return {
    user: {
      id: MOCK_SESSION.user.id,
      name: MOCK_SESSION.user.name,
      email: MOCK_SESSION.user.email,
      login: MOCK_SESSION.user.login,
    },
    accessToken: MOCK_SESSION.accessToken,
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  }
}

async function handleMock(request: NextRequest): Promise<Response> {
  const action = new URL(request.url).pathname.replace(/^\/api\/auth\/?/, "")

  if (action === "session") {
    return Response.json(mockSession())
  }
  if (action === "providers") {
    return Response.json({
      github: {
        id: "github",
        name: "GitHub",
        type: "oauth",
        signinUrl: "/api/auth/signin/github",
        callbackUrl: "/api/auth/callback/github",
      },
    })
  }
  if (action === "csrf") {
    return Response.json({ csrfToken: "mock-csrf-token" })
  }
  if (action.startsWith("signout")) {
    return Response.json({ url: "/" })
  }
  if (action.startsWith("signin")) {
    return Response.json({ url: "/app" })
  }
  if (action.startsWith("error")) {
    return Response.redirect(new URL("/app", request.url), 302)
  }
  return Response.json({})
}

export async function GET(request: NextRequest) {
  if (isMockBackend()) {
    return handleMock(request)
  }
  return handlers.GET(request)
}

export async function POST(request: NextRequest) {
  if (isMockBackend()) {
    return handleMock(request)
  }
  return handlers.POST(request)
}
