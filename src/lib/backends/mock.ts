import { createHash } from 'crypto'
import { encryptWithPassword } from '../encryption'
import { createGitCloakFile } from '../gitcloak'
import {
  BackendNotFoundError,
  type BackendKind,
  type ContentsResult,
  type DirectoryEntry,
  type FileBackend,
  type RepositorySummary,
  type SaveFileParams,
  type SaveResult,
} from './types'

/**
 * In-memory backend used for end-to-end tests (and local demos).
 *
 * It exposes a small, deterministic set of repositories seeded with real
 * age-encrypted content, so the browser-side unlock/decrypt flows can be
 * exercised without talking to GitHub. All state lives in memory and can be
 * reset through the test-only `/api/test/reset` route.
 */

/** Plaintext or password-encrypted seed content for a single file. */
type SeedContent =
  | { kind: 'plain'; content: string }
  | { kind: 'encrypted'; plaintext: string; password: string }
  | { kind: 'gitcloak'; password: string }

interface MockRepoSeed {
  summary: RepositorySummary
  files: Record<string, SeedContent>
}

interface MockRepoState {
  summary: RepositorySummary
  /** path -> current file content (already encrypted where applicable). */
  files: Map<string, string>
}

const PASSWORD_REPO = 'demo-password'
const ALT_PASSWORD = 'different-password'

const REPO_SEEDS: MockRepoSeed[] = [
  {
    summary: {
      id: 1001,
      name: 'demo-notes',
      fullName: 'mockuser/demo-notes',
      owner: 'mockuser',
      private: true,
      description: 'Seeded repository with encrypted notes',
      updatedAt: '2024-05-01T12:00:00.000Z',
    },
    files: {
      '.gitcloak': { kind: 'gitcloak', password: PASSWORD_REPO },
      'README.md': {
        kind: 'plain',
        content:
          '# Demo Notes\n\nThis is a plain markdown file.\n\n- one\n- two\n',
      },
      'welcome.md.age': {
        kind: 'encrypted',
        password: PASSWORD_REPO,
        plaintext:
          '# Welcome\n\nThis file is encrypted with the repository password.\n',
      },
      'notes/secret.md.age': {
        kind: 'encrypted',
        password: ALT_PASSWORD,
        plaintext:
          '# Secret Notes\n\nThis file is encrypted with a different password.\n',
      },
      'notes/todo.md': {
        kind: 'plain',
        content: '- [ ] write tests\n- [x] ship backend abstraction\n',
      },
    },
  },
  {
    summary: {
      id: 1002,
      name: 'scratch',
      fullName: 'mockuser/scratch',
      owner: 'mockuser',
      private: false,
      description: 'Public scratch repository without encryption',
      updatedAt: '2024-04-01T09:30:00.000Z',
    },
    files: {
      'notes.md': {
        kind: 'plain',
        content: '# Scratch\n\nNothing secret here yet.\n',
      },
    },
  },
  {
    summary: {
      id: 1003,
      name: 'empty',
      fullName: 'mockuser/empty',
      owner: 'mockuser',
      private: true,
      description: 'Empty repository',
      updatedAt: '2024-03-01T09:30:00.000Z',
    },
    files: {},
  },
]

function sha1(content: string): string {
  return createHash('sha1').update(content, 'utf-8').digest('hex')
}

function basename(path: string): string {
  const parts = path.split('/')
  return parts[parts.length - 1] || path
}

class MockFileBackend implements FileBackend {
  readonly kind: BackendKind = 'mock'

  private repos: MockRepoState[] | null = null
  /** Materialized seed contents, computed once (age encryption is expensive). */
  private snapshot: { summary: RepositorySummary; files: Map<string, string> }[] | null = null

  private async ensureSnapshot() {
    if (!this.snapshot) {
      const materialized: { summary: RepositorySummary; files: Map<string, string> }[] = []
      for (const repo of REPO_SEEDS) {
        const files = new Map<string, string>()
        for (const [path, seed] of Object.entries(repo.files)) {
          files.set(path, await materialize(seed))
        }
        materialized.push({ summary: { ...repo.summary }, files })
      }
      this.snapshot = materialized
    }
    return this.snapshot
  }

  private async ensureSeeded(): Promise<MockRepoState[]> {
    if (this.repos) return this.repos

    const snapshot = await this.ensureSnapshot()
    this.repos = snapshot.map((repo) => ({
      summary: { ...repo.summary },
      files: new Map(repo.files),
    }))
    return this.repos
  }

  async reset(): Promise<void> {
    this.repos = null
  }

  async listRepositories(): Promise<RepositorySummary[]> {
    const repos = await this.ensureSeeded()
    return repos
      .map((repo) => ({ ...repo.summary }))
      .sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )
  }

  async getContents(
    owner: string,
    repo: string,
    path: string
  ): Promise<ContentsResult> {
    const state = await this.findRepo(owner, repo)
    const file = state.files.get(path)

    if (file !== undefined) {
      return {
        type: 'file',
        file: {
          name: basename(path),
          path,
          sha: sha1(file),
          size: file.length,
          content: file,
        },
      }
    }

    const entries = listEntries(state.files, path)
    if (entries.length === 0 && path !== '') {
      throw new BackendNotFoundError(path)
    }

    return { type: 'dir', entries }
  }

  async saveFile({
    owner,
    repo,
    path,
    content,
  }: SaveFileParams): Promise<SaveResult> {
    const state = await this.findRepo(owner, repo)
    state.files.set(path, content)

    // Touch the repository so ordering in the UI reflects the change.
    state.summary.updatedAt = new Date().toISOString()

    return { sha: sha1(content), path, name: basename(path) }
  }

  /** Snapshot of every file so the test harness can assert stored content. */
  async dump(): Promise<Record<string, Record<string, string>>> {
    const repos = await this.ensureSeeded()
    const out: Record<string, Record<string, string>> = {}
    for (const repo of repos) {
      out[repo.summary.fullName] = Object.fromEntries(repo.files)
    }
    return out
  }

  private async findRepo(owner: string, repo: string): Promise<MockRepoState> {
    const repos = await this.ensureSeeded()
    const fullName = `${owner}/${repo}`
    const found = repos.find((candidate) => candidate.summary.fullName === fullName)
    if (!found) {
      throw new BackendNotFoundError(`Repository ${fullName} not found`)
    }
    return found
  }
}

async function materialize(seed: SeedContent): Promise<string> {
  switch (seed.kind) {
    case 'plain':
      return seed.content
    case 'encrypted':
      return encryptWithPassword(seed.plaintext, seed.password)
    case 'gitcloak':
      return createGitCloakFile(seed.password)
  }
}

/**
 * Build the immediate children of `basePath` from the flat path->content map.
 * Directories are synthesised from path prefixes and sorted before files,
 * mirroring the GitHub API ordering the UI expects.
 */
function listEntries(
  files: Map<string, string>,
  basePath: string
): DirectoryEntry[] {
  const prefix = basePath ? `${basePath}/` : ''
  const dirs = new Set<string>()
  const fileEntries: DirectoryEntry[] = []

  for (const [path, content] of files) {
    if (!path.startsWith(prefix)) continue
    const rest = path.slice(prefix.length)
    if (!rest) continue

    if (rest.includes('/')) {
      dirs.add(rest.split('/')[0])
    } else {
      fileEntries.push({
        name: rest,
        path,
        type: 'file',
        sha: sha1(content),
        size: content.length,
      })
    }
  }

  const dirEntries: DirectoryEntry[] = [...dirs]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({
      name,
      path: `${prefix}${name}`,
      type: 'dir' as const,
      sha: `dir-${sha1(`${prefix}${name}`)}`,
    }))

  fileEntries.sort((a, b) => a.name.localeCompare(b.name))
  return [...dirEntries, ...fileEntries]
}

/**
 * The mock backend keeps its state in a module-level singleton so that it
 * survives hot reloads and is shared across requests within a single server
 * process (tests rely on this to observe writes).
 */
const globalForMock = globalThis as unknown as {
  __gitcloakMockBackend?: MockFileBackend
}

export function getMockFileBackend(): MockFileBackend {
  if (!globalForMock.__gitcloakMockBackend) {
    globalForMock.__gitcloakMockBackend = new MockFileBackend()
  }
  return globalForMock.__gitcloakMockBackend
}

export async function resetMockFileBackend(): Promise<void> {
  await getMockFileBackend().reset()
}

export async function dumpMockBackend(): Promise<
  Record<string, Record<string, string>>
> {
  return getMockFileBackend().dump()
}
