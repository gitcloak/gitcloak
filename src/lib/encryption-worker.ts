/// <reference lib="webworker" />

import { decryptPassphrase, encryptPassphrase } from './age-passphrase'

/**
 * Worker entry for `lib/encryption.ts`. Each request carries an `id` so the
 * caller can match the reply, even when several requests are in flight.
 */
export type EncryptionRequest = {
  id: number
  op: 'encrypt' | 'decrypt'
  content: string
  password: string
}

export type EncryptionResponse = { id: number; ok: true; result: string } | { id: number; ok: false; error: string }

self.onmessage = async (event: MessageEvent<EncryptionRequest>) => {
  const { id, op, content, password } = event.data
  try {
    const result = op === 'encrypt'
      ? await encryptPassphrase(content, password)
      : await decryptPassphrase(content, password)
    const response: EncryptionResponse = { id, ok: true, result }
    self.postMessage(response)
  } catch (error) {
    const response: EncryptionResponse = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : 'Encryption failed',
    }
    self.postMessage(response)
  }
}
