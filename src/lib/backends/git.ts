import 'server-only'

import { Octokit } from '@octokit/rest'
import {
  BackendConflictError,
  BackendNotFoundError,
  type BackendKind,
  type ContentsResult,
  type DirectoryEntry,
  type FileBackend,
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

  async listRepositories(): Promise<RepositorySummary[]> {
    // Only list repositories that belong to this GitHub App installation,
    // so the user only ever sees repos they explicitly granted access to.
    const { data: installations } =
      await this.octokit.apps.listInstallationsForAuthenticatedUser({
        per_page: 100,
      })

    const appId = Number(process.env.GITHUB_APP_ID)
    const installation = installations.installations.find(
      (candidate) => candidate.app_id === appId
    )

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

    const repositories = (data.repositories ?? []).map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      owner: repo.owner.login,
      private: repo.private,
      description: repo.description ?? null,
      updatedAt: repo.updated_at ?? new Date().toISOString(),
    }))

    // Newest activity first, matching the previous server component behaviour.
    return repositories.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    )
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
