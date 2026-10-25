import { GitFileBackend } from './git'
import { getMockFileBackend } from './mock'
import type { BackendKind, FileBackend } from './types'

export * from './types'
export { GitFileBackend } from './git'
export {
  getMockFileBackend,
  resetMockFileBackend,
  dumpMockBackend,
} from './mock'

/**
 * Which backend should serve requests.
 *
 * - An explicit `FILE_BACKEND=mock` selects the mock backend. This is reserved
 *   for the automated test suite (Playwright sets it) and is never chosen
 *   automatically.
 * - Everywhere else — local development, production and Vercel previews — the
 *   real GitHub backend is used.
 */
export function getBackendKind(): BackendKind {
  const configured = process.env.FILE_BACKEND?.trim().toLowerCase()
  if (configured === 'mock') return 'mock'
  return 'git'
}

export function isMockBackend(): boolean {
  return getBackendKind() === 'mock'
}

/**
 * Create the active backend. The git backend needs the signed-in user's
 * OAuth token; the mock backend ignores it.
 */
export function createFileBackend(accessToken?: string): FileBackend {
  if (isMockBackend()) {
    return getMockFileBackend()
  }
  if (!accessToken) {
    throw new Error('An access token is required for the git backend')
  }
  return new GitFileBackend(accessToken)
}
