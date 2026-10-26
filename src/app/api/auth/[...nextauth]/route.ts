import type { NextRequest } from "next/server"

import { handlers } from "@/auth"
import { isMockBackend } from "@/lib/backends"

/**
 * In mock mode (the automated end-to-end test suite) Auth.js does not run;
 * `handleMock` answers the endpoints the UI touches with a signed-in session.
 * It is loaded behind a build-time constant so production builds omit it.
 */
async function mockResponse(request: NextRequest): Promise<Response | null> {
  if (process.env.NEXT_PUBLIC_MOCK_BACKEND === "1" && isMockBackend()) {
    const { handleMock } = await import("@/lib/mock-auth-handler")
    return handleMock(request)
  }
  return null
}

export async function GET(request: NextRequest) {
  return (await mockResponse(request)) ?? handlers.GET(request)
}

export async function POST(request: NextRequest) {
  return (await mockResponse(request)) ?? handlers.POST(request)
}
