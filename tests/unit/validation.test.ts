import { describe, expect, it } from 'vitest'
import { createGitCloakFile } from '@/lib/gitcloak'
import {
  isSameOrigin,
  validateOwnerRepo,
  validatePath,
  validateSavePayload,
} from '@/lib/validation'

const ARMOR = '-----BEGIN AGE ENCRYPTED FILE-----\nabc\n-----END AGE ENCRYPTED FILE-----'
const SHA = 'a'.repeat(40)

describe('validateOwnerRepo', () => {
  it('accepts normal GitHub names', () => {
    expect(() => validateOwnerRepo('octo-cat', 'my.repo_1')).not.toThrow()
  })

  it.each([
    ['../x', 'repo'],
    ['owner', '..'],
    ['owner', 'a/b'],
    ['-owner', 'repo'],
    ['owner', ''],
    ['own er', 'repo'],
  ])('rejects %s/%s', (owner, repo) => {
    expect(() => validateOwnerRepo(owner, repo)).toThrow()
  })
})

describe('validatePath', () => {
  it('accepts nested paths and the root for reads', () => {
    expect(validatePath('notes/a.md.age')).toBe('notes/a.md.age')
    expect(validatePath('', { allowRoot: true })).toBe('')
  })

  it.each(['', '/abs', 'a//b', 'a/../b', '../b', './a', 'a\\b', '.git/config', 'x/.GIT/y', 'a\nb'])(
    'rejects %j',
    (path) => {
      expect(() => validatePath(path)).toThrow()
    }
  )

  it('rejects non-strings', () => {
    expect(() => validatePath(undefined)).toThrow()
    expect(() => validatePath(['a'])).toThrow()
  })
})

describe('validateSavePayload', () => {
  it('accepts age ciphertext for a .age path', () => {
    const result = validateSavePayload({ path: 'a.md.age', content: ARMOR, sha: SHA, message: 'Update a' })
    expect(result).toMatchObject({ path: 'a.md.age', sha: SHA, message: 'Update a' })
  })

  it('accepts a real .gitcloak file', async () => {
    const content = await createGitCloakFile('pw')
    expect(() => validateSavePayload({ path: '.gitcloak', content })).not.toThrow()
  })

  it('refuses plaintext', () => {
    expect(() => validateSavePayload({ path: 'a.md.age', content: 'secret' })).toThrow(/not age-encrypted/)
  })

  it('refuses non-.age paths and workflow files', () => {
    expect(() => validateSavePayload({ path: 'a.md', content: ARMOR })).toThrow()
    expect(() => validateSavePayload({ path: '.github/workflows/x.yml.age', content: ARMOR })).toThrow()
    expect(() => validateSavePayload({ path: '.GitHub/x.age', content: ARMOR })).toThrow()
  })

  it('refuses a malformed .gitcloak', () => {
    expect(() => validateSavePayload({ path: '.gitcloak', content: 'nope' })).toThrow()
    expect(() => validateSavePayload({ path: '.gitcloak', content: '{"verification":"x"}' })).toThrow()
  })

  it('validates sha and message', () => {
    expect(() => validateSavePayload({ path: 'a.age', content: ARMOR, sha: 'xyz' })).toThrow()
    expect(() => validateSavePayload({ path: 'a.age', content: ARMOR, message: 'a\nb' })).toThrow()
    expect(() => validateSavePayload({ path: 'a.age', content: ARMOR, message: 'x'.repeat(201) })).toThrow()
    expect(() => validateSavePayload({ path: 'a.age', content: ARMOR, sha: '', message: '' })).not.toThrow()
  })

  it('refuses non-object bodies', () => {
    expect(() => validateSavePayload(null)).toThrow()
    expect(() => validateSavePayload([])).toThrow()
  })
})

describe('isSameOrigin', () => {
  const req = (headers: Record<string, string>) => new Request('https://x.test/api', { headers })

  it('allows requests without an Origin header', () => {
    expect(isSameOrigin(req({ host: 'app.test' }))).toBe(true)
  })

  it('matches Origin against the forwarded host (Vercel proxy)', () => {
    expect(isSameOrigin(req({ origin: 'https://pr-1.vercel.app', 'x-forwarded-host': 'pr-1.vercel.app', host: 'internal' }))).toBe(true)
  })

  it('rejects a different origin', () => {
    expect(isSameOrigin(req({ origin: 'https://evil.test', host: 'app.test' }))).toBe(false)
    expect(isSameOrigin(req({ origin: 'not a url', host: 'app.test' }))).toBe(false)
  })
})
