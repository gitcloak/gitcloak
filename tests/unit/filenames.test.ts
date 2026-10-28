import { beforeAll, describe, expect, it } from 'vitest'
import {
  decryptEntryName,
  decryptRepoPath,
  encryptEntryName,
  encryptRepoPath,
  filenameKeyFromSecret,
  generateFilenameSecret,
  validateFilePath,
  type FilenameKey,
} from '@/lib/filenames'

// Fixed secrets keep the expectations stable; real repositories use a random one.
const SECRET = 'a'.repeat(64)
const OTHER_SECRET = 'b'.repeat(64)

describe('filename encryption', () => {
  let key: FilenameKey

  beforeAll(async () => {
    key = await filenameKeyFromSecret(SECRET)
  })

  it('stores a file name as lowercase base32 with the .age extension', async () => {
    const stored = await encryptRepoPath('file.md', key)

    expect(stored).toMatch(/^[a-z2-7]+\.age$/)
    expect(stored).not.toContain('file')
    expect(stored.length).toBeGreaterThan(20)
  })

  it('encrypts every directory segment and keeps the path structure', async () => {
    const stored = await encryptRepoPath('notes/2024/file.md', key)
    const segments = stored.split('/')

    expect(segments).toHaveLength(3)
    expect(segments[0]).toMatch(/^[a-z2-7]+$/)
    expect(segments[1]).toMatch(/^[a-z2-7]+$/)
    expect(segments[2]).toMatch(/^[a-z2-7]+\.age$/)
    expect(stored).not.toMatch(/notes|2024|file/)
  })

  it('decrypts a folder path when the last segment is a folder', async () => {
    const stored = await encryptRepoPath('projects/todo.md', key)
    const folder = stored.split('/')[0]

    await expect(decryptRepoPath(folder, key, 'dir')).resolves.toBe('projects')
    await expect(decryptRepoPath(folder, key)).resolves.toBe(folder)
  })

  it('round-trips file, directory and non-ASCII names', async () => {
    const path = 'заметки/файл.md'
    const stored = await encryptRepoPath(path, key)

    await expect(decryptRepoPath(stored, key)).resolves.toBe(path)
    await expect(decryptEntryName(await encryptEntryName('folder', key), 'dir', key)).resolves.toBe('folder')
  })

  it('is deterministic, so the same name always maps to the same stored name', async () => {
    const first = await encryptRepoPath('todo.md', key)
    const second = await encryptRepoPath('todo.md', key)

    expect(second).toBe(first)
    expect(await encryptRepoPath('todo2.md', key)).not.toBe(first)
  })

  it('gives different stored names to the same path in different repositories', async () => {
    const other = await filenameKeyFromSecret(OTHER_SECRET)

    expect(await encryptRepoPath('todo.md', other)).not.toBe(await encryptRepoPath('todo.md', key))
  })

  it('leaves the stored name in place when the key does not match', async () => {
    const stored = await encryptRepoPath('secret.md', key)
    const otherKey = await filenameKeyFromSecret(OTHER_SECRET)

    await expect(decryptRepoPath(stored, otherKey)).resolves.toBe(stored)
  })

  it('generates a fresh 32-byte hex secret each time', () => {
    const first = generateFilenameSecret()

    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(generateFilenameSecret()).not.toBe(first)
  })

  it('leaves tampered names in place', async () => {
    const stored = await encryptRepoPath('secret.md', key)
    const [token] = stored.split('.')
    // Flip the last character to a different one of the alphabet.
    const flipped = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a')

    await expect(decryptRepoPath(`${flipped}.age`, key)).resolves.toBe(`${flipped}.age`)
  })

  it('leaves names that were never encrypted unchanged', async () => {
    await expect(decryptRepoPath('README.md', key)).resolves.toBe('README.md')
    await expect(decryptRepoPath('welcome.md.age', key)).resolves.toBe('welcome.md.age')
    await expect(decryptRepoPath('.gitcloak', key)).resolves.toBe('.gitcloak')
  })

  it('does not treat a directory token as a file (and the other way round)', async () => {
    const token = await encryptEntryName('notes', key)

    await expect(decryptEntryName(`${token}.age`, 'dir', key)).resolves.toBe(`${token}.age`)
    await expect(decryptEntryName(token, 'file', key)).resolves.toBe(token)
    await expect(decryptEntryName(token, 'dir', key)).resolves.toBe('notes')
  })
})

describe('validateFilePath', () => {
  it('accepts plain and nested paths', () => {
    expect(validateFilePath('file.md')).toBeNull()
    expect(validateFilePath('folder/file.md')).toBeNull()
  })

  it('rejects empty, relative and control-character paths', () => {
    for (const path of ['', '   ', 'a//b', '/a', 'a/', '../x', 'a/./b', 'a\\b', 'a\nb']) {
      expect(validateFilePath(path), path).not.toBeNull()
    }
  })

  it('rejects a segment too long for a stored name', () => {
    expect(validateFilePath('a'.repeat(100))).toBeNull()
    expect(validateFilePath('a'.repeat(101))).not.toBeNull()
  })
})
