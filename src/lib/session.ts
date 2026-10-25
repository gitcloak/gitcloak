import { auth } from '@/auth'
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
 * Session used when the mock backend is active. Tests never perform the real
 * GitHub OAuth dance, so we hand back a deterministic signed-in user.
 */
export const MOCK_SESSION: AppSession = {
  user: {
    id: 'mock-user',
    login: 'mockuser',
    name: 'Mock User',
    email: 'mock@example.com',
    image: null,
  },
  accessToken: 'mock-access-token',
}

/**
 * Resolve the current session.
 *
 * When `FILE_BACKEND=mock` the real Auth.js session is bypassed entirely —
 * this is what lets the end-to-end tests drive an authenticated app without
 * GitHub credentials. In all other cases this is a thin wrapper around
 * `auth()` that ensures an access token is present.
 */
export async function getSession(): Promise<AppSession | null> {
  if (isMockBackend()) {
    return MOCK_SESSION
  }

  const session = await auth()
  if (!session?.user || !session.accessToken) {
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
    accessToken: session.accessToken,
  }
}
