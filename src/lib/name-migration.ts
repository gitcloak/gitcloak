/**
 * Brings a repository up to encrypted file names once its password is known.
 *
 * Two things can still be plain: a repository at `.gitcloak` version 1.0 has
 * no name key, and `.age` files saved before encrypted names keep their plain
 * names. Both are fixed here, and the work is repeated until nothing is left,
 * so an interrupted run simply continues on the next unlock.
 *
 * Only `.age` files are renamed. Their content is copied byte for byte, so no
 * file is decrypted or re-encrypted and files with other passwords keep theirs.
 * Folders and plain (non-`.age`) files keep their names.
 *
 * Browser-side: only the client can derive the new encrypted names.
 */

import { decryptEntryName, encryptEntryName, type FilenameKey } from './filenames'
import { addNameKeyToGitCloakFile, openFilenameKey } from './gitcloak'

interface RepoEntry {
  name: string
  path: string
  type: 'file' | 'dir'
  sha: string
}

export interface NameMigration {
  /** The repository's name key. */
  key: FilenameKey
  /** Whether `.gitcloak` gained a name key during this run. */
  upgradedGitCloak: boolean
  /** Renamed files: old stored path to new stored path and blob sha. */
  renamed: Record<string, { path: string; sha: string }>
  /** Files that could not be renamed. They keep their old names and are retried next time. */
  failed: number
}

/**
 * Make sure the repository has a name key and rename its plain `.age` files.
 * Must only be called after the password has been verified against `.gitcloak`.
 * Throws when the name key cannot be set up; individual rename failures are
 * counted instead, so one bad file does not stop the rest.
 */
export async function migrateRepositoryNames(
  owner: string,
  repo: string,
  gitcloak: { content: string; sha: string },
  password: string
): Promise<NameMigration> {
  let key = await openFilenameKey(gitcloak.content, password)
  let upgradedGitCloak = false

  if (key === null) {
    const content = await addNameKeyToGitCloakFile(gitcloak.content, password)
    await saveRepoFile(owner, repo, {
      path: '.gitcloak',
      content,
      sha: gitcloak.sha,
      message: 'Add encrypted file names',
    })
    key = await openFilenameKey(content, password)
    if (key === null) {
      throw new Error('The repository could not be given a file name key.')
    }
    upgradedGitCloak = true
  }

  const migration: NameMigration = { key, upgradedGitCloak, renamed: {}, failed: 0 }

  for (const file of await listAgeFiles(owner, repo)) {
    // Names this key produces decrypt to something else; anything else is plain.
    const plain = await decryptEntryName(file.name, 'file', key)
    if (plain !== file.name) continue

    const folder = file.path.slice(0, file.path.length - file.name.length)
    const to = `${folder}${await encryptEntryName(file.name.slice(0, -'.age'.length), key)}.age`

    try {
      const moved = await moveRepoFile(owner, repo, { from: file.path, to, fromSha: file.sha })
      migration.renamed[file.path] = { path: to, sha: moved.sha }
    } catch {
      migration.failed += 1
    }
  }

  return migration
}

/** Every `.age` file in the repository, at any depth. */
async function listAgeFiles(owner: string, repo: string, folder = ''): Promise<RepoEntry[]> {
  const response = await fetch(
    `/api/repos/${owner}/${repo}/contents?path=${encodeURIComponent(folder)}`
  )
  if (!response.ok) {
    throw new Error('Failed to list repository contents')
  }
  const entries = (await response.json()) as RepoEntry[]

  const files: RepoEntry[] = []
  for (const entry of entries) {
    if (entry.type === 'dir') {
      files.push(...(await listAgeFiles(owner, repo, entry.path)))
    } else if (entry.name.endsWith('.age')) {
      files.push(entry)
    }
  }
  return files
}

async function saveRepoFile(
  owner: string,
  repo: string,
  body: { path: string; content: string; sha: string; message: string }
): Promise<void> {
  const response = await fetch(`/api/repos/${owner}/${repo}/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(error.error || 'Failed to save .gitcloak')
  }
}

async function moveRepoFile(
  owner: string,
  repo: string,
  body: { from: string; to: string; fromSha: string }
): Promise<{ sha: string }> {
  const response = await fetch(`/api/repos/${owner}/${repo}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: string }
    throw new Error(error.error || 'Failed to rename file')
  }
  return (await response.json()) as { sha: string }
}
