import { Encrypter, Decrypter, armor } from 'age-encryption'

/**
 * Yield control to the browser to prevent UI freezing
 */
function yieldToMain(): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, 0)
  })
}

/**
 * Encrypt content using age encryption with a password
 * Uses yieldToMain to keep UI responsive during computation
 * @param content The content to encrypt
 * @param password The password to use for encryption
 * @returns ASCII armored encrypted content
 */
export async function encryptWithPassword(content: string, password: string): Promise<string> {
  // Yield to browser before heavy computation
  await yieldToMain()

  const encrypter = new Encrypter()
  encrypter.setPassphrase(password)

  const encrypted = await encrypter.encrypt(content)

  // Yield again before armoring
  await yieldToMain()

  // Return ASCII armored format (text-based)
  const armored = armor.encode(encrypted)
  return armored
}

/**
 * Decrypt content using age encryption with a password
 * Uses yieldToMain to keep UI responsive during computation
 * @param encryptedContent The encrypted content (age armored format)
 * @param password The password to use for decryption
 * @returns Decrypted content as string
 */
export async function decryptWithPassword(encryptedContent: string, password: string): Promise<string> {
  // Yield to browser before heavy computation
  await yieldToMain()

  const decrypter = new Decrypter()
  decrypter.addPassphrase(password)

  // Decode the armored format first
  const decoded = armor.decode(encryptedContent)

  // Yield again before decryption
  await yieldToMain()

  const decrypted = await decrypter.decrypt(decoded, 'text')
  return decrypted
}
