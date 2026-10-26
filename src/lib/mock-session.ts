import type { AppSession } from '@/lib/session'

/**
 * Session used when the mock backend is active. Tests never perform the real
 * GitHub OAuth dance, so we hand back a deterministic signed-in user.
 *
 * Test-only: loaded with a dynamic import behind `NEXT_PUBLIC_MOCK_BACKEND`
 * so production builds do not contain it.
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
