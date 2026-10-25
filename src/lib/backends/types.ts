/**
 * Storage backend abstraction used by the server side of the application.
 *
 * The application was originally hard-wired to GitHub. A `FileBackend`
 * encapsulates every storage operation the UI needs (listing repositories,
 * reading/lising directory contents and writing files) so that alternative
 * backends — most importantly an in-memory mock used by the end-to-end tests —
 * can be dropped in without touching the UI.
 *
 * Backends return *normalized* data (UTF-8 file contents, plain directory
 * entries). Serialization to the GitHub-compatible JSON shape the browser code
 * consumes happens in the API routes, not in the backends.
 */

export type BackendKind = 'git' | 'mock'

export interface RepositorySummary {
  id: number
  name: string
  fullName: string
  owner: string
  private: boolean
  description: string | null
  updatedAt: string
}

export interface DirectoryEntry {
  name: string
  path: string
  type: 'file' | 'dir'
  sha: string
  size?: number
}

export interface FileContents {
  name: string
  path: string
  sha: string
  size: number
  /** Raw UTF-8 content — not base64 encoded. */
  content: string
}

export type ContentsResult =
  | { type: 'file'; file: FileContents }
  | { type: 'dir'; entries: DirectoryEntry[] }

export interface SaveFileParams {
  owner: string
  repo: string
  path: string
  /** Raw UTF-8 content — backends encode it for their transport. */
  content: string
  message: string
  /** Existing blob sha when updating a file (used for optimistic concurrency). */
  sha?: string
}

export interface SaveResult {
  sha: string
  path: string
  name: string
}

/** Thrown when a requested path does not exist in the backend. */
export class BackendNotFoundError extends Error {
  constructor(message = 'Not found') {
    super(message)
    this.name = 'BackendNotFoundError'
  }
}

/** Thrown when a write conflicts with the current remote state. */
export class BackendConflictError extends Error {
  constructor(message = 'Conflict') {
    super(message)
    this.name = 'BackendConflictError'
  }
}

/**
 * Duck-typed error checks. Next.js may load the backend module in a separate
 * bundle from the route, which makes `instanceof` unreliable across that
 * boundary, so match on `name` as well as the prototype.
 */
export function isBackendNotFound(
  error: unknown
): error is BackendNotFoundError {
  return (
    error instanceof BackendNotFoundError ||
    (error as { name?: string })?.name === 'BackendNotFoundError'
  )
}

export function isBackendConflict(
  error: unknown
): error is BackendConflictError {
  return (
    error instanceof BackendConflictError ||
    (error as { name?: string })?.name === 'BackendConflictError'
  )
}

export interface FileBackend {
  /** Stable identifier for the active backend implementation. */
  readonly kind: BackendKind

  /** Repositories the signed-in user can access. */
  listRepositories(): Promise<RepositorySummary[]>

  /** Read a file or list a directory at `path` (empty string = repository root). */
  getContents(owner: string, repo: string, path: string): Promise<ContentsResult>

  /** Create or update a file, returning the new blob metadata. */
  saveFile(params: SaveFileParams): Promise<SaveResult>
}
