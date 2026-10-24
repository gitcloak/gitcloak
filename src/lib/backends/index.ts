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
 * Which backend should serve requests. Defaults to the real GitHub backend;
 * set `FILE_BACKEND=mock` (see `.env.example`) to run against the in-memory
 * test backend.
 */
export function getBackendKind(): BackendKind {
  return process.env.FILE_BACKEND === 'mock' ? 'mock' : 'git'
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
