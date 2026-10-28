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

/**
 * How a GitHub App installation decides which repositories the app may use:
 * either every repository the account owns, or an explicit selection.
 */
export type RepositorySelection = 'all' | 'selected'

/** The GitHub App installation that currently scopes repository access. */
export interface InstallationSummary {
  id: number
  accountLogin: string
  accountType: string
  repositorySelection: RepositorySelection
  /** GitHub page where the account owner can change the selection. */
  manageUrl: string
}

/**
 * Everything the "Add repositories" flow needs: the installation in effect and
 * the repositories the user could still add to it.
 */
export interface RepositoryAccess {
  /** null when the app is not installed for the signed-in user. */
  installation: InstallationSummary | null
  /** Repositories the user may add to the current selection. */
  selectable: RepositorySummary[]
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

export interface MoveFileParams {
  owner: string
  repo: string
  /** Current path of the file. */
  from: string
  /** New path. The file's content is kept byte for byte. */
  to: string
  /** Blob sha of `from` as the caller last saw it (optimistic concurrency). */
  fromSha: string
  message: string
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

  /**
   * The installation that grants repository access plus the repositories that
   * could be added to it. Used by the "Add repositories" dialog to let a user
   * extend the selection after the app was installed.
   */
  listRepositoryAccess(): Promise<RepositoryAccess>

  /**
   * Add a repository the user administers to the app installation, so it shows
   * up in `listRepositories()` from then on. Throws `BackendNotFoundError`
   * when the repository cannot be found.
   */
  addRepositoryToInstallation(owner: string, repo: string): Promise<void>

  /** Read a file or list a directory at `path` (empty string = repository root). */
  getContents(owner: string, repo: string, path: string): Promise<ContentsResult>

  /** Create or update a file, returning the new blob metadata. */
  saveFile(params: SaveFileParams): Promise<SaveResult>

  /**
   * Rename a file without changing its content: write the same bytes at `to`,
   * then remove `from`. If `to` already holds identical bytes the write is
   * skipped, so an interrupted rename can be retried. A different file at `to`
   * is a conflict and nothing is removed.
   */
  moveFile(params: MoveFileParams): Promise<SaveResult>
}
