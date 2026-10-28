import 'server-only'

import { Octokit } from '@octokit/rest'
import { installationSettingsUrl } from '../github-urls'
import {
  BackendConflictError,
  BackendNotFoundError,
  type BackendKind,
  type ContentsResult,
  type DirectoryEntry,
  type FileBackend,
  type InstallationSummary,
  type MoveFileParams,
  type RepositoryAccess,
  type RepositorySummary,
  type SaveFileParams,
  type SaveResult,
} from './types'

function basename(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

/**
 * GitHub-backed implementation. This is the production backend: it talks to
 * the GitHub REST API using the OAuth token stored in the user's session.
 */
export class GitFileBackend implements FileBackend {
  readonly kind: BackendKind = 'git'

  private readonly octokit: Octokit

  constructor(accessToken: string) {
    this.octokit = new Octokit({ auth: accessToken })
  }

  /**
   * The GitHub App installation for the signed-in user, or null when the app
   * is not installed. Pinned to `GITHUB_APP_ID` so another app's installation
   * is never mistaken for ours.
   */
  private async getInstallation() {
    const { data: installations } =
      await this.octokit.apps.listInstallationsForAuthenticatedUser({
        per_page: 100,
      })

    const appId = Number(process.env.GITHUB_APP_ID)
    return (
      installations.installations.find(
        (candidate) => candidate.app_id === appId
      ) ?? null
    )
  }

  async listRepositories(): Promise<RepositorySummary[]> {
    // Only list repositories that belong to this GitHub App installation,
    // so the user only ever sees repos they explicitly granted access to.
    const installation = await this.getInstallation()

    if (!installation) {
      throw new Error(
        'GitHub App not installed. Please authorize the app and select repositories.'
      )
    }

    const { data } =
      await this.octokit.apps.listInstallationReposForAuthenticatedUser({
        installation_id: installation.id,
        per_page: 100,
      })

    const repositories = (data.repositories ?? []).map(toRepositorySummary)

    // Newest activity first, matching the previous server component behaviour.
    return repositories.sort(byUpdatedDesc)
  }

  async listRepositoryAccess(): Promise<RepositoryAccess> {
    const installation = await this.getInstallation()
    if (!installation) {
      return { installation: null, selectable: [] }
    }

    const account = installation.account as {
      login?: string
      type?: string
    } | null
    const summary: InstallationSummary = {
      id: installation.id,
      accountLogin: account?.login ?? '',
      accountType: account?.type ?? '',
      repositorySelection:
        installation.repository_selection === 'all' ? 'all' : 'selected',
      manageUrl: installationSettingsUrl(
        account?.type ?? '',
        account?.login ?? '',
        installation.id
      ),
    }

    // With an "all repositories" installation there is nothing left to add.
    if (summary.repositorySelection === 'all') {
      return { installation: summary, selectable: [] }
    }

    const { data: granted } =
      await this.octokit.apps.listInstallationReposForAuthenticatedUser({
        installation_id: installation.id,
        per_page: 100,
      })
    const grantedIds = new Set(
      (granted.repositories ?? []).map((repo) => repo.id)
    )

    // Candidates are the user's own/collaborated repositories that the
    // installation does not cover yet. A user access token can only see the
    // repositories both the user and the app can access, so this may come back
    // empty for private repositories — the dialog then falls back to
    // GitHub's installation settings page, which is always authoritative.
    const { data: candidates } =
      await this.octokit.repos.listForAuthenticatedUser({
        per_page: 100,
        sort: 'updated',
        affiliation: 'owner,collaborator,organization_member',
      })

    const selectable = candidates
      .filter((repo) => !grantedIds.has(repo.id))
      // Adding a repository requires admin access to it. Keep repos whose
      // permissions are simply unreported and let GitHub be the judge.
      .filter((repo) => repo.permissions?.admin !== false)
      .map(toRepositorySummary)
      .sort(byUpdatedDesc)

    return { installation: summary, selectable }
  }

  async addRepositoryToInstallation(
    owner: string,
    repo: string
  ): Promise<void> {
    const installation = await this.getInstallation()
    if (!installation) {
      throw new Error(
        'GitHub App not installed. Please authorize the app and select repositories.'
      )
    }

    // The install endpoint needs the numeric repository id. GitHub will reject
    // the call when the user is not an admin on the repository.
    const repositoryId = await this.getRepositoryId(owner, repo)

    await this.octokit.apps.addRepoToInstallationForAuthenticatedUser({
      installation_id: installation.id,
      repository_id: repositoryId,
    })
  }

  /** Numeric id of a repository, or `BackendNotFoundError` when it is hidden. */
  private async getRepositoryId(owner: string, repo: string): Promise<number> {
    try {
      const { data } = await this.octokit.repos.get({ owner, repo })
      return data.id
    } catch (error) {
      if (isNotFound(error)) {
        throw new BackendNotFoundError(`${owner}/${repo}`)
      }
      throw error
    }
  }

  async getContents(
    owner: string,
    repo: string,
    path: string
  ): Promise<ContentsResult> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      })

      if (Array.isArray(data)) {
        return { type: 'dir', entries: data.map(toDirectoryEntry) }
      }

      if (data.type !== 'file' || !('content' in data)) {
        throw new BackendNotFoundError(`${path} is not a file`)
      }

      return {
        type: 'file',
        file: {
          name: data.name,
          path: data.path,
          sha: data.sha,
          size: data.size,
          content: Buffer.from(data.content, 'base64').toString('utf-8'),
        },
      }
    } catch (error) {
      if (isNotFound(error)) {
        throw new BackendNotFoundError(path)
      }
      throw error
    }
  }

  async saveFile({
    owner,
    repo,
    path,
    content,
    message,
    sha,
  }: SaveFileParams): Promise<SaveResult> {
    try {
      const { data } = await this.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: Buffer.from(content, 'utf-8').toString('base64'),
        ...(sha ? { sha } : {}),
      })

      return {
        sha: data.content?.sha ?? '',
        path: data.content?.path ?? path,
        name: data.content?.name ?? basename(path),
      }
    } catch (error) {
      if (isConflict(error)) {
        throw new BackendConflictError(
          'The file changed on GitHub since it was opened. Reload and try again.'
        )
      }
      throw error
    }
  }

  async moveFile({
    owner,
    repo,
    from,
    to,
    fromSha,
    message,
  }: MoveFileParams): Promise<SaveResult> {
    const source = await this.readBlob(owner, repo, from)
    if (!source) {
      throw new BackendNotFoundError(from)
    }
    if (source.sha !== fromSha) {
      throw new BackendConflictError(
        'The file changed on GitHub since it was opened. Reload and try again.'
      )
    }

    // Identical bytes already at `to` mean an earlier attempt was interrupted
    // after the write. Different bytes are someone else's file: stop.
    const target = await this.readBlob(owner, repo, to)
    let newSha = source.sha
    if (target) {
      if (!target.content.equals(source.content)) {
        throw new BackendConflictError('A file with the new name already exists.')
      }
      newSha = target.sha
    } else {
      try {
        const { data } = await this.octokit.repos.createOrUpdateFileContents({
          owner,
          repo,
          path: to,
          message,
          content: source.content.toString('base64'),
        })
        newSha = data.content?.sha ?? newSha
      } catch (error) {
        if (isConflict(error)) {
          throw new BackendConflictError('A file with the new name already exists.')
        }
        throw error
      }
    }

    await this.octokit.repos.deleteFile({ owner, repo, path: from, message, sha: fromSha })

    return { sha: newSha, path: to, name: basename(to) }
  }

  /** Raw bytes and blob sha of a file, or null when it does not exist. */
  private async readBlob(
    owner: string,
    repo: string,
    path: string
  ): Promise<{ sha: string; content: Buffer } | null> {
    try {
      const { data } = await this.octokit.repos.getContent({ owner, repo, path })
      if (Array.isArray(data) || data.type !== 'file' || !('content' in data)) {
        return null
      }
      return { sha: data.sha, content: Buffer.from(data.content, 'base64') }
    } catch (error) {
      if (isNotFound(error)) {
        return null
      }
      throw error
    }
  }
}

function toRepositorySummary(repo: {
  id: number
  name: string
  full_name: string
  owner: { login: string }
  private: boolean
  description?: string | null
  updated_at?: string | null
}): RepositorySummary {
  return {
    id: repo.id,
    name: repo.name,
    fullName: repo.full_name,
    owner: repo.owner.login,
    private: repo.private,
    description: repo.description ?? null,
    updatedAt: repo.updated_at ?? new Date().toISOString(),
  }
}

function byUpdatedDesc(a: RepositorySummary, b: RepositorySummary): number {
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
}

function toDirectoryEntry(item: {
  name: string
  path: string
  type: string
  sha: string
  size?: number
}): DirectoryEntry {
  return {
    name: item.name,
    path: item.path,
    type: item.type === 'dir' ? 'dir' : 'file',
    sha: item.sha,
    size: item.size,
  }
}

function isNotFound(error: unknown): boolean {
  return (error as { status?: number })?.status === 404
}

function isConflict(error: unknown): boolean {
  const status = (error as { status?: number })?.status
  return status === 409 || status === 422
}
