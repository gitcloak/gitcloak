import { Encrypter, Decrypter, armor } from 'age-encryption'

/**
 * The age passphrase core. This is the only file that imports age-encryption,
 * and it runs inside the encryption worker (`encryption-worker.ts`): scrypt
 * key derivation is CPU-bound and would freeze the page on the main thread.
 * Application code uses `lib/encryption.ts`, which talks to that worker.
 */

/**
 * Encrypt content using age encryption with a password
 * @param content The content to encrypt
 * @param password The password to use for encryption
 * @returns ASCII armored encrypted content
 */
export async function encryptPassphrase(content: string, password: string): Promise<string> {
  const encrypter = new Encrypter()
  encrypter.setPassphrase(password)

  const encrypted = await encrypter.encrypt(content)

  // Return ASCII armored format (text-based)
  return armor.encode(encrypted)
}

/**
 * Decrypt content using age encryption with a password
 * @param encryptedContent The encrypted content (age armored format)
 * @param password The password to use for decryption
 * @returns Decrypted content as string
 */
export async function decryptPassphrase(encryptedContent: string, password: string): Promise<string> {
  const decrypter = new Decrypter()
  decrypter.addPassphrase(password)

  const decoded = armor.decode(encryptedContent)
  return decrypter.decrypt(decoded, 'text')
}
