'use client'

import { SessionProvider } from "next-auth/react"
import type { Session } from "next-auth"

// Preview deployments and end-to-end tests run against the mock backend,
// which has no real OAuth. Seed the provider with a signed-in session so the
// UI renders without ever calling Auth.js.
const MOCK_MODE = process.env.NEXT_PUBLIC_MOCK_BACKEND === "1"

const mockSession = MOCK_MODE
  ? ({
      user: {
        id: "mock-user",
        name: "Mock User",
        email: "mock@example.com",
      },
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    } as Session)
  : undefined

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider session={mockSession}>{children}</SessionProvider>
}
