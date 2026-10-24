import { beforeEach, describe, expect, it } from 'vitest'
import {
  createGitCloakFile,
  verifyPassword,
} from '@/lib/gitcloak'

const PASSWORD = 'repo-password'
const WRONG_PASSWORD = 'not-the-password'

// Matches the string that `createGitCloakFile` encrypts and `verifyPassword`
// checks against (kept in sync with src/lib/gitcloak.ts).
const VERIFICATION_STRING = 'gitcloak-password-verification-v1'

describe('createGitCloakFile', () => {
  it('returns parseable JSON with a version, timestamp and armored verification blob', async () => {
    const raw = await createGitCloakFile(PASSWORD)
    const parsed = JSON.parse(raw) as Record<string, unknown>

    expect(parsed.version).toBe('1.0')
    expect(typeof parsed.createdAt).toBe('string')
    expect(Number.isNaN(Date.parse(parsed.createdAt as string))).toBe(false)
    expect(parsed.verification).toContain('-----BEGIN AGE ENCRYPTED FILE-----')
    // The verification string must never be stored in the clear.
    expect(raw).not.toContain(VERIFICATION_STRING)
  })
})

describe('verifyPassword', () => {
  let gitcloakFile: string

  beforeEach(async () => {
    gitcloakFile = await createGitCloakFile(PASSWORD)
  })

  it('accepts the password the file was created with', async () => {
    expect(await verifyPassword(gitcloakFile, PASSWORD)).toBe(true)
  })

  it('rejects an incorrect password', async () => {
    expect(await verifyPassword(gitcloakFile, WRONG_PASSWORD)).toBe(false)
  })

  it('returns false (never throws) for malformed .gitcloak content', async () => {
    expect(await verifyPassword('not valid json', PASSWORD)).toBe(false)
    expect(await verifyPassword('{}', PASSWORD)).toBe(false)
    expect(
      await verifyPassword(JSON.stringify({ verification: 'garbage' }), PASSWORD)
    ).toBe(false)
  })
})
