import { describe, expect, it } from 'vitest'
import { createGitCloakFile } from '@/lib/gitcloak'
import {
  isSameOrigin,
  validateDeletePayload,
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

  it('stores plain text when the request declares the file as plain', () => {
    const result = validateSavePayload({ path: 'notes.md', content: '# Notes', encrypted: false })
    expect(result).toMatchObject({ path: 'notes.md', content: '# Notes', encrypted: false })
  })

  it('defaults to encrypted, so an undeclared plain save is still refused', () => {
    expect(validateSavePayload({ path: 'a.md.age', content: ARMOR }).encrypted).toBe(true)
    expect(() => validateSavePayload({ path: 'notes.md', content: '# Notes' })).toThrow()
  })

  it('keeps the .age extension meaning "encrypted" in both directions', () => {
    expect(() =>
      validateSavePayload({ path: 'notes.md.age', content: '# Notes', encrypted: false })
    ).toThrow(/\.age extension/)
    expect(() => validateSavePayload({ path: 'notes.md', content: ARMOR, encrypted: true })).toThrow()
    expect(() =>
      validateSavePayload({ path: '.github/x.md', content: '# Notes', encrypted: false })
    ).toThrow('Writing to .github is not allowed')
  })

  it('rejects a non-boolean encrypted flag', () => {
    expect(() => validateSavePayload({ path: 'notes.md', content: 'x', encrypted: 'yes' })).toThrow(
      /encrypted flag/
    )
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
  it('accepts renaming an encrypted file to another encrypted path', () => {
    expect(
      validateMovePayload({ from: 'welcome.md.age', to: 'k3ql2w7ue6cx.age', fromSha: SHA })
    ).toEqual({ from: 'welcome.md.age', to: 'k3ql2w7ue6cx.age', fromSha: SHA, message: undefined })
  })

  it('accepts renaming a plain file to another plain path', () => {
    expect(
      validateMovePayload({ from: 'notes/todo.md', to: 'notes/backlog.md', fromSha: SHA })
    ).toEqual({
      from: 'notes/todo.md',
      to: 'notes/backlog.md',
      fromSha: SHA,
      message: undefined,
    })
  })

  it('rejects a rename that changes whether a file is encrypted', () => {
    // The `.age` extension is what marks a file as encrypted, so it must stay.
    expect(() => validateMovePayload({ from: 'README.md', to: 'x.age', fromSha: SHA })).toThrow(
      'cannot change whether a file is encrypted'
    )
    expect(() => validateMovePayload({ from: 'a.age', to: 'plain.md', fromSha: SHA })).toThrow(
      'cannot change whether a file is encrypted'
    )
  })

  it('rejects renaming .gitcloak or a folder placeholder', () => {
    expect(() => validateMovePayload({ from: '.gitcloak', to: 'x.age', fromSha: SHA })).toThrow(
      'Only files can be renamed'
    )
    expect(() => validateMovePayload({ from: 'a.age', to: '.gitcloak', fromSha: SHA })).toThrow(
      'Only files can be renamed'
    )
    expect(() =>
      validateMovePayload({ from: 'notes/.gitkeep', to: 'notes/x.md', fromSha: SHA })
    ).toThrow('Only files can be renamed')
    expect(() => validateMovePayload({ from: 'a.md', to: '.gitkeep', fromSha: SHA })).toThrow(
      'Only files can be renamed'
    )
  })

  it('rejects targets that live under .github', () => {
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

  it('carries an optional commit message and rejects a bad one', () => {
    expect(
      validateMovePayload({
        from: 'a.age',
        to: 'b.age',
        fromSha: SHA,
        message: 'Rename a.age',
      }).message
    ).toBe('Rename a.age')
    // An empty message is treated as absent, not as an error.
    expect(
      validateMovePayload({ from: 'a.age', to: 'b.age', fromSha: SHA, message: '' }).message
    ).toBeUndefined()
    expect(() =>
      validateMovePayload({ from: 'a.age', to: 'b.age', fromSha: SHA, message: 'x'.repeat(201) })
    ).toThrow('Invalid commit message')
    expect(() =>
      validateMovePayload({ from: 'a.age', to: 'b.age', fromSha: SHA, message: 'bad\nline' })
    ).toThrow('Invalid commit message')
  })
})

describe('validateDeletePayload', () => {
  it('accepts deleting a plain file or an encrypted one by its stored path', () => {
    expect(validateDeletePayload({ path: 'README.md', sha: SHA })).toEqual({
      path: 'README.md',
      sha: SHA,
      message: undefined,
    })
    expect(validateDeletePayload({ path: 'notes/secret.md.age', sha: SHA })).toEqual({
      path: 'notes/secret.md.age',
      sha: SHA,
      message: undefined,
    })
  })

  it('requires the sha of the blob the caller last saw', () => {
    // Without it a stale editor could not be told apart from a fresh one.
    expect(() => validateDeletePayload({ path: 'README.md' })).toThrow('Invalid sha')
    expect(() => validateDeletePayload({ path: 'README.md', sha: '' })).toThrow('Invalid sha')
    expect(() => validateDeletePayload({ path: 'README.md', sha: 'nope' })).toThrow('Invalid sha')
  })

  it('refuses .gitcloak and a folder placeholder', () => {
    expect(() => validateDeletePayload({ path: '.gitcloak', sha: SHA })).toThrow(
      'Only files can be deleted'
    )
    expect(() => validateDeletePayload({ path: 'notes/.gitkeep', sha: SHA })).toThrow(
      'Only files can be deleted'
    )
  })

  it('refuses paths under .github and traversal', () => {
    expect(() => validateDeletePayload({ path: '.github/workflows/x.yml.age', sha: SHA })).toThrow(
      'Writing to .github is not allowed'
    )
    expect(() => validateDeletePayload({ path: '../escape.md', sha: SHA })).toThrow()
  })

  it('rejects a body that is not an object and carries a validated message', () => {
    expect(() => validateDeletePayload(null)).toThrow()
    expect(() => validateDeletePayload([])).toThrow()
    expect(validateDeletePayload({ path: 'README.md', sha: SHA, message: 'Remove it' }).message).toBe(
      'Remove it'
    )
    // An empty message is absent, and a bad one is refused like everywhere else.
    expect(validateDeletePayload({ path: 'README.md', sha: SHA, message: '' }).message).toBeUndefined()
    expect(() =>
      validateDeletePayload({ path: 'README.md', sha: SHA, message: 'x'.repeat(201) })
    ).toThrow('Invalid commit message')
    expect(() =>
      validateDeletePayload({ path: 'README.md', sha: SHA, message: 'bad\nline' })
    ).toThrow('Invalid commit message')
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
