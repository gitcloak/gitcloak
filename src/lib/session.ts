import 'server-only'

import { headers } from 'next/headers'
import { auth } from '@/auth'
import { readAccessToken } from '@/lib/access-token'
import { isMockBackend } from '@/lib/backends'

/**
 * The subset of the Auth.js session the server side of the app depends on.
 * `accessToken` is always present for a usable session.
 */
export interface AppSession {
  user: {
    id: string
    login: string
    name?: string | null
    email?: string | null
    image?: string | null
  }
  accessToken: string
}

/**
 * Resolve the current session.
 *
 * When `FILE_BACKEND=mock` the real Auth.js session is bypassed entirely —
 * this is what lets the end-to-end tests drive an authenticated app without
 * GitHub credentials. In all other cases this is a thin wrapper around
 * `auth()` that also reads the GitHub access token from the session cookie
 * (it is intentionally absent from the browser-visible session object).
 */
export async function getSession(): Promise<AppSession | null> {
  // The build-time constant lets production builds drop the mock code.
  if (process.env.NEXT_PUBLIC_MOCK_BACKEND === '1' && isMockBackend()) {
    const { MOCK_SESSION } = await import('@/lib/mock-session')
    return MOCK_SESSION
  }

  const session = await auth()
  if (!session?.user) {
    return null
  }

  const accessToken = await readAccessToken(await headers())
  if (!accessToken) {
    return null
  }

  return {
    user: {
      id: session.user.id,
      login: session.user.login,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
    },
    accessToken,
  }
}
