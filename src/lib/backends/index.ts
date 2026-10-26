import { GitFileBackend } from './git'
import type { BackendKind, FileBackend } from './types'

export * from './types'
export { GitFileBackend } from './git'

/**
 * Which backend should serve requests.
 *
 * - An explicit `FILE_BACKEND=mock` selects the mock backend. It replaces
 *   authentication with a fixed signed-in user, so it is reserved for the
 *   automated test suite (Playwright sets it) and is never chosen
 *   automatically.
 * - Everywhere else — local development, production and Vercel previews — the
 *   real GitHub backend is used.
 * - In a production runtime, mock mode is refused unless the bundle was built
 *   for it (`next.config.ts` sets `NEXT_PUBLIC_MOCK_BACKEND` only for an
 *   explicitly allowed mock build) and never on Vercel. A stray
 *   `FILE_BACKEND=mock` therefore fails closed with an error instead of
 *   opening the app without login.
 */
export function getBackendKind(): BackendKind {
  const requestedMock =
    process.env.FILE_BACKEND?.trim().toLowerCase() === 'mock'
  if (!requestedMock) return 'git'

  if (
    process.env.NODE_ENV === 'production' &&
    (process.env.VERCEL || process.env.NEXT_PUBLIC_MOCK_BACKEND !== '1')
  ) {
    throw new Error(
      'FILE_BACKEND=mock is not allowed in a production deployment. ' +
        'Unset FILE_BACKEND.'
    )
  }
  return 'mock'
}

export function isMockBackend(): boolean {
  return getBackendKind() === 'mock'
}

/**
 * Create the active backend. The git backend needs the signed-in user's
 * OAuth token; the mock backend ignores it.
 *
 * The mock backend is loaded with a dynamic import behind a build-time
 * constant (`NEXT_PUBLIC_MOCK_BACKEND`), so a normal production build does not
 * contain the mock code at all and no runtime setting can switch it on.
 */
export async function createFileBackend(
  accessToken?: string
): Promise<FileBackend> {
  if (process.env.NEXT_PUBLIC_MOCK_BACKEND === '1' && isMockBackend()) {
    const { getMockFileBackend } = await import('./mock')
    return getMockFileBackend()
  }
  if (!accessToken) {
    throw new Error('An access token is required for the git backend')
  }
  return new GitFileBackend(accessToken)
}
