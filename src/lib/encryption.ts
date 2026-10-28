import type { EncryptionRequest, EncryptionResponse } from './encryption-worker'

/**
 * Browser API for the age passphrase helpers. The scrypt work runs in a Web
 * Worker (`encryption-worker.ts`), so a slow unlock, save or decrypt never
 * blocks the page: the loading spinner keeps animating while it runs.
 */

interface PendingRequest {
  resolve: (result: string) => void
  reject: (error: Error) => void
}

let worker: Worker | null = null
let nextRequestId = 0
const pending = new Map<number, PendingRequest>()

function getWorker(): Worker {
  if (worker) return worker

  const created = new Worker(new URL('./encryption-worker.ts', import.meta.url), { type: 'module' })
  created.onmessage = (event: MessageEvent<EncryptionResponse>) => {
    const response = event.data
    const request = pending.get(response.id)
    if (!request) return
    pending.delete(response.id)
    if (response.ok) {
      request.resolve(response.result)
    } else {
      request.reject(new Error(response.error))
    }
  }
  created.onerror = () => {
    // A crashed worker loses every request in flight. Drop it so the next call starts a fresh one.
    for (const request of pending.values()) {
      request.reject(new Error('Encryption worker failed'))
    }
    pending.clear()
    created.terminate()
    worker = null
  }

  worker = created
  return created
}

function runInWorker(op: EncryptionRequest['op'], content: string, password: string): Promise<string> {
  const target = getWorker()
  const id = ++nextRequestId
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    const request: EncryptionRequest = { id, op, content, password }
    target.postMessage(request)
  })
}

/**
 * Only for runtimes without Web Workers (unit tests under node). Browsers always
 * take the worker path above.
 */
async function runInline(op: EncryptionRequest['op'], content: string, password: string): Promise<string> {
  const core = await import('./age-passphrase')
  return op === 'encrypt'
    ? core.encryptPassphrase(content, password)
    : core.decryptPassphrase(content, password)
}

function run(op: EncryptionRequest['op'], content: string, password: string): Promise<string> {
  return typeof Worker === 'undefined' ? runInline(op, content, password) : runInWorker(op, content, password)
}

/**
 * Encrypt content using age encryption with a password
 * @param content The content to encrypt
 * @param password The password to use for encryption
 * @returns ASCII armored encrypted content
 */
export function encryptWithPassword(content: string, password: string): Promise<string> {
  return run('encrypt', content, password)
}

/**
 * Decrypt content using age encryption with a password
 * @param encryptedContent The encrypted content (age armored format)
 * @param password The password to use for decryption
 * @returns Decrypted content as string
 */
export function decryptWithPassword(encryptedContent: string, password: string): Promise<string> {
  return run('decrypt', encryptedContent, password)
}
