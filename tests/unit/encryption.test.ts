import { beforeAll, describe, expect, it } from 'vitest'
import { decryptWithPassword, encryptWithPassword } from '@/lib/encryption'

const PASSWORD = 'correct horse battery staple'
const PLAINTEXT = '# Round trip\n\nThe quick brown fox jumps over the lazy dog.\n'

describe('encryptWithPassword / decryptWithPassword', () => {
  let ciphertext: string

  beforeAll(async () => {
    ciphertext = await encryptWithPassword(PLAINTEXT, PASSWORD)
  })

  it('round-trips content back to the original plaintext', async () => {
    const decrypted = await decryptWithPassword(ciphertext, PASSWORD)
    expect(decrypted).toBe(PLAINTEXT)
  })

  it('produces an ASCII-armored age payload, not the plaintext', () => {
    expect(ciphertext).toContain('-----BEGIN AGE ENCRYPTED FILE-----')
    expect(ciphertext).toContain('-----END AGE ENCRYPTED FILE-----')
    expect(ciphertext).not.toContain('quick brown fox')
  })

  it('rejects the wrong password', async () => {
    await expect(
      decryptWithPassword(ciphertext, 'not-the-password')
    ).rejects.toThrow()
  })

  it('rejects a tampered payload instead of returning garbage', async () => {
    const tampered = ciphertext.replace(/[A-Za-z0-9]/, (c) =>
      c === 'A' ? 'B' : 'A'
    )
    await expect(decryptWithPassword(tampered, PASSWORD)).rejects.toThrow()
  })

  it('uses a fresh salt so the same input encrypts differently each time', async () => {
    const other = await encryptWithPassword(PLAINTEXT, PASSWORD)
    expect(other).not.toBe(ciphertext)
    // Both ciphertexts must still decrypt to the same plaintext.
    expect(await decryptWithPassword(other, PASSWORD)).toBe(PLAINTEXT)
    expect(await decryptWithPassword(ciphertext, PASSWORD)).toBe(PLAINTEXT)
  })

  it('round-trips unicode and multi-line content', async () => {
    const unicode = 'héllo 🌍 日本語\n\n\tindented — em dash\n'
    const encrypted = await encryptWithPassword(unicode, PASSWORD)
    expect(await decryptWithPassword(encrypted, PASSWORD)).toBe(unicode)
  })

  it('round-trips empty content', async () => {
    const encrypted = await encryptWithPassword('', PASSWORD)
    expect(await decryptWithPassword(encrypted, PASSWORD)).toBe('')
  })
})
