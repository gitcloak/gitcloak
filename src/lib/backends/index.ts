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
 * Vercel preview deployments never have the production-scoped GitHub OAuth
 * credentials, and their hostnames change on every deploy so they cannot be
 * registered as OAuth callback URLs. Without a `secret` Auth.js refuses to
 * start and the app shows the "problem with the server configuration" error,
 * so previews fall back to the self-contained mock backend instead.
 */
function isVercelPreview(): boolean {
  return process.env.VERCEL_ENV === 'preview'
}

/**
 * Which backend should serve requests.
 *
 * - An explicit `FILE_BACKEND` (`git` or `mock`) always wins.
 * - Otherwise Vercel preview deployments use the mock backend.
 * - Everything else (local dev / production) uses the real GitHub backend.
 */
export function getBackendKind(): BackendKind {
  const configured = process.env.FILE_BACKEND?.trim().toLowerCase()
  if (configured === 'mock') return 'mock'
  if (configured === 'git') return 'git'
  if (isVercelPreview()) return 'mock'
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
