import { describe, expect, it } from 'vitest'
import { createGitCloakFile } from '@/lib/gitcloak'
import {
  isSameOrigin,
  validateAddRepositoryPayload,
  validateMovePayload,
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

describe('validateMovePayload', () => {
  it('accepts renaming a .age file to another .age path', () => {
    expect(
      validateMovePayload({ from: 'welcome.md.age', to: 'k3ql2w7ue6cx.age', fromSha: SHA })
    ).toEqual({ from: 'welcome.md.age', to: 'k3ql2w7ue6cx.age', fromSha: SHA })
  })

  it('rejects moving anything that is not an .age file, including .gitcloak', () => {
    expect(() => validateMovePayload({ from: 'README.md', to: 'x.age', fromSha: SHA })).toThrow(
      'Only .age files can be renamed'
    )
    expect(() => validateMovePayload({ from: '.gitcloak', to: 'x.age', fromSha: SHA })).toThrow(
      'Only .age files can be renamed'
    )
  })

  it('rejects targets that are not encrypted files or live under .github', () => {
    expect(() => validateMovePayload({ from: 'a.age', to: 'plain.md', fromSha: SHA })).toThrow(
      'Only .age files can be renamed'
    )
    expect(() => validateMovePayload({ from: 'a.age', to: '.gitcloak', fromSha: SHA })).toThrow()
    expect(() =>
      validateMovePayload({ from: 'a.age', to: '.github/x.age', fromSha: SHA })
    ).toThrow('Writing to .github is not allowed')
  })

  it('rejects traversal, a missing sha and a no-op rename', () => {
    expect(() => validateMovePayload({ from: '../a.age', to: 'b.age', fromSha: SHA })).toThrow()
    expect(() => validateMovePayload({ from: 'a.age', to: 'b.age', fromSha: 'nope' })).toThrow(
      'Invalid sha'
    )
    expect(() => validateMovePayload({ from: 'a.age', to: 'a.age', fromSha: SHA })).toThrow(
      'must differ'
    )
  })
})

describe('validateAddRepositoryPayload', () => {
  it('accepts a well-formed owner/repo pair', () => {
    expect(validateAddRepositoryPayload({ owner: 'octo-cat', repo: 'my.repo' })).toEqual({
      owner: 'octo-cat',
      repo: 'my.repo',
    })
  })

  it.each([
    [null],
    [[]],
    [{ owner: 'octocat' }],
    [{ owner: 'octocat', repo: 7 }],
    [{ owner: '../x', repo: 'repo' }],
    [{ owner: 'owner', repo: 'a/b' }],
  ])('rejects %j', (body) => {
    expect(() => validateAddRepositoryPayload(body)).toThrow()
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
