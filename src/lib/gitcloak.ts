import { encryptWithPassword, decryptWithPassword } from './encryption'

/**
 * The verification string that will be encrypted and stored in .gitcloak
 * This is used to verify if the entered password is correct
 */
const VERIFICATION_STRING = 'gitcloak-password-verification-v1'

/**
 * Create the .gitcloak file content with encrypted verification string
 */
export async function createGitCloakFile(password: string): Promise<string> {
  const encryptedVerification = await encryptWithPassword(VERIFICATION_STRING, password)

  const gitcloakContent = {
    version: '1.0',
    verification: encryptedVerification,
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
  } catch (error) {
    // If decryption fails, password is incorrect
    return false
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
  } catch (error) {
    return { exists: false }
  }
}
