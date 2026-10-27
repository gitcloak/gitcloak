import { beforeEach, describe, expect, it } from 'vitest'
import {
  addNameKeyToGitCloakFile,
  createGitCloakFile,
  openFilenameKey,
  verifyPassword,
} from '@/lib/gitcloak'
import { encryptEntryName } from '@/lib/filenames'

const PASSWORD = 'repo-password'
const WRONG_PASSWORD = 'not-the-password'

// Matches the string that `createGitCloakFile` encrypts and `verifyPassword`
// checks against (kept in sync with src/lib/gitcloak.ts).
const VERIFICATION_STRING = 'gitcloak-password-verification-v1'

describe('createGitCloakFile', () => {
  it('returns parseable JSON with a version, timestamp and armored verification blob', async () => {
    const raw = await createGitCloakFile(PASSWORD)
    const parsed = JSON.parse(raw) as Record<string, unknown>

    expect(parsed.version).toBe('1.1')
    expect(typeof parsed.createdAt).toBe('string')
    expect(Number.isNaN(Date.parse(parsed.createdAt as string))).toBe(false)
    expect(parsed.verification).toContain('-----BEGIN AGE ENCRYPTED FILE-----')
    // The verification string must never be stored in the clear.
    expect(raw).not.toContain(VERIFICATION_STRING)
    // The file-name secret is wrapped with the password, like the verification.
    expect(parsed.nameKey).toContain('-----BEGIN AGE ENCRYPTED FILE-----')
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

describe('openFilenameKey', () => {
  let gitcloakFile: string

  beforeEach(async () => {
    gitcloakFile = await createGitCloakFile(PASSWORD)
  })

  it('opens the same key every time for the right password', async () => {
    const first = await openFilenameKey(gitcloakFile, PASSWORD)
    const second = await openFilenameKey(gitcloakFile, PASSWORD)

    expect(first).not.toBeNull()
    expect(await encryptEntryName('file.md', first!)).toBe(
      await encryptEntryName('file.md', second!)
    )
  })

  it('returns null for a wrong password', async () => {
    expect(await openFilenameKey(gitcloakFile, WRONG_PASSWORD)).toBeNull()
  })

  it('returns null for repositories created before encrypted names', async () => {
    const legacy = JSON.stringify({
      version: '1.0',
      verification: JSON.parse(gitcloakFile).verification,
    })

    expect(await openFilenameKey(legacy, PASSWORD)).toBeNull()
  })
})

describe('addNameKeyToGitCloakFile', () => {
  it('upgrades a version 1.0 file in place and keeps the password valid', async () => {
    const v1 = await createGitCloakFile(PASSWORD)
    const legacy = JSON.stringify({ ...JSON.parse(v1), version: '1.0', nameKey: undefined })

    expect(await openFilenameKey(legacy, PASSWORD)).toBeNull()

    const upgraded = await addNameKeyToGitCloakFile(legacy, PASSWORD)
    const parsed = JSON.parse(upgraded) as Record<string, unknown>

    expect(parsed.version).toBe('1.1')
    expect(parsed.verification).toBe(JSON.parse(v1).verification)
    expect(await verifyPassword(upgraded, PASSWORD)).toBe(true)
    expect(await openFilenameKey(upgraded, PASSWORD)).not.toBeNull()
  })
})
