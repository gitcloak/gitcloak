import { encryptWithPassword, decryptWithPassword } from './encryption'
import { filenameKeyFromSecret, generateFilenameSecret, type FilenameKey } from './filenames'

/**
 * The verification string that will be encrypted and stored in .gitcloak
 * This is used to verify if the entered password is correct
 */
const VERIFICATION_STRING = 'gitcloak-password-verification-v1'

/**
 * Create the .gitcloak file content: an encrypted verification string and,
 * since version 1.1, the random secret for encrypted file names, wrapped with
 * the same password. Version 1.0 files have no `nameKey` and keep plain names.
 */
export async function createGitCloakFile(password: string): Promise<string> {
  const encryptedVerification = await encryptWithPassword(VERIFICATION_STRING, password)
  const encryptedNameKey = await encryptWithPassword(generateFilenameSecret(), password)

  const gitcloakContent = {
    version: '1.1',
    verification: encryptedVerification,
    nameKey: encryptedNameKey,
    createdAt: new Date().toISOString(),
  }

  return JSON.stringify(gitcloakContent, null, 2)
}

/**
 * Verify if a password is correct by attempting to decrypt the .gitcloak file
 */
export async function verifyPassword(gitcloakContent: string, password: string): Promise<boolean> {
  try {
    const gitcloak = JSON.parse(gitcloakContent)
    const decrypted = await decryptWithPassword(gitcloak.verification, password)
    return decrypted === VERIFICATION_STRING
  } catch {
    // If decryption fails, password is incorrect
    return false
  }
}

/**
 * Bring a version 1.0 `.gitcloak` up to 1.1 by adding a wrapped name key. The
 * verification and the creation time are kept, so the password stays valid.
 */
export async function addNameKeyToGitCloakFile(
  gitcloakContent: string,
  password: string
): Promise<string> {
  const parsed = JSON.parse(gitcloakContent) as Record<string, unknown>
  const nameKey = await encryptWithPassword(generateFilenameSecret(), password)

  return JSON.stringify({ ...parsed, version: '1.1', nameKey }, null, 2)
}

/**
 * Unwrap the repository's file-name key with the password. Returns null when
 * the password is wrong or the repository predates encrypted names; callers
 * then keep the names as they are stored.
 */
export async function openFilenameKey(
  gitcloakContent: string,
  password: string
): Promise<FilenameKey | null> {
  try {
    const { nameKey } = JSON.parse(gitcloakContent) as { nameKey?: unknown }
    if (typeof nameKey !== 'string') return null
    const secret = await decryptWithPassword(nameKey, password)
    return await filenameKeyFromSecret(secret)
  } catch {
    return null
  }
}

/**
 * Check if .gitcloak file exists in a repository
 */
export async function checkGitCloakExists(owner: string, repo: string): Promise<{ exists: boolean; content?: string; sha?: string }> {
  try {
    const response = await fetch(
      `/api/repos/${owner}/${repo}/contents?path=${encodeURIComponent('.gitcloak')}`
    )

    if (!response.ok) {
      return { exists: false }
    }

    const data = await response.json()

    if (data.content && data.encoding === 'base64') {
      const content = atob(data.content)
      return {
        exists: true,
        content,
        sha: data.sha,
      }
    }

    return { exists: false }
  } catch {
    return { exists: false }
  }
}
