/**
 * Encrypted file and folder names.
 *
 * Every entry of a repository is stored under an opaque name derived from its
 * plaintext name, for example `k3ql2w7ue6cxbtqjq5gkg2r2zq2y3d6nb4.age` for
 * `file.md`. The name is encrypted with a deterministic, authenticated scheme
 * (an SIV-style construction: HMAC-SHA256 as the synthetic IV, AES-CTR as the
 * cipher), so the same name always maps to the same stored name and folders
 * can be addressed without remembering their stored name.
 *
 * Locked, the file tree shows the stored names. Unlocked, it decrypts them.
 * Names that were not produced by this scheme (for example plaintext files or
 * entries saved before this feature) are never changed and are shown as stored.
 *
 * The keys come from a random secret kept in `.gitcloak`, wrapped with age
 * under the repository password. Names are therefore exactly as hard to guess
 * as the file contents: a password guess cannot be checked against the stored
 * names any faster than against age. See `openFilenameKey` in `gitcloak.ts`.
 *
 * Browser-side only, like `encryption.ts`. Uses WebCrypto; no third-party code.
 */

/** Length of the synthetic IV (the truncated HMAC tag) prefixed to each name. */
const TAG_BYTES = 16
/** Extension of every stored file; directories have none. */
const FILE_EXTENSION = '.age'
/** Length of the random secret in bytes, before it is hex-encoded. */
const SECRET_BYTES = 32

/**
 * Plaintext name of the empty file that keeps a new folder in the repository,
 * since git cannot store an empty directory. It is hidden from the file tree.
 */
export const FOLDER_PLACEHOLDER = '.gitkeep'
/**
 * Plaintext limit per path segment in bytes. The stored segment is about 1.6x
 * longer plus the extension, which keeps it under GitHub's 255-byte limit.
 */
const MAX_SEGMENT_BYTES = 100

const BASE32_ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567'
const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/

const encoder = new TextEncoder()

/** Keys for one repository. Derived from its secret, so they are cleared with the password. */
export interface FilenameKey {
  mac: CryptoKey
  enc: CryptoKey
}

/** A new random secret, hex-encoded. It is stored only wrapped with age in `.gitcloak`. */
export function generateFilenameSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SECRET_BYTES))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Expand a repository's filename secret into its MAC and cipher keys (HKDF-SHA256). */
export async function filenameKeyFromSecret(secret: string): Promise<FilenameKey> {
  const base = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, [
    'deriveBits',
  ])
  const deriveBits = (info: string) =>
    crypto.subtle.deriveBits(
      { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(0), info: encoder.encode(info) },
      base,
      256
    )

  return {
    mac: await crypto.subtle.importKey(
      'raw',
      await deriveBits('gitcloak-filename-mac-v1'),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    enc: await crypto.subtle.importKey(
      'raw',
      await deriveBits('gitcloak-filename-enc-v1'),
      'AES-CTR',
      false,
      ['encrypt', 'decrypt']
    ),
  }
}

/**
 * Stored name for one plaintext segment. Directories are returned as-is;
 * files get the `.age` extension added by the caller.
 */
export async function encryptEntryName(name: string, key: FilenameKey): Promise<string> {
  const plaintext = encoder.encode(name)
  const tag = await macTag(key, plaintext)
  const body = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter: tag, length: 64 },
    key.enc,
    plaintext
  )
  const sealed = new Uint8Array(TAG_BYTES + body.byteLength)
  sealed.set(tag, 0)
  sealed.set(new Uint8Array(body), TAG_BYTES)
  return toBase32(sealed)
}

/**
 * Plaintext name for one stored segment. Returns the stored name unchanged
 * when it is not an encrypted name for this key.
 */
export async function decryptEntryName(
  stored: string,
  type: 'file' | 'dir',
  key: FilenameKey
): Promise<string> {
  if (type === 'file' && !stored.endsWith(FILE_EXTENSION)) return stored

  const token = type === 'file' ? stored.slice(0, -FILE_EXTENSION.length) : stored
  const sealed = fromBase32(token)
  if (!sealed || sealed.length <= TAG_BYTES) return stored

  const tag = sealed.slice(0, TAG_BYTES)
  const plaintext = new Uint8Array(
    await crypto.subtle.decrypt(
      { name: 'AES-CTR', counter: tag, length: 64 },
      key.enc,
      sealed.slice(TAG_BYTES)
    )
  )
  // The tag must be the MAC of the recovered plaintext; this is what makes
  // a wrong key or a foreign name fall back to the stored name.
  if (!equalBytes(tag, await macTag(key, plaintext))) return stored

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(plaintext)
  } catch {
    return stored
  }
}

/**
 * Stored repository path for a plaintext path such as `notes/file.md`. Every
 * segment is encrypted and the last one gets `.age`.
 * The caller must validate the path with `validateFilePath` first.
 */
export async function encryptRepoPath(path: string, key: FilenameKey): Promise<string> {
  const segments = path.split('/')
  const stored: string[] = []
  for (const [index, segment] of segments.entries()) {
    const token = await encryptEntryName(segment, key)
    stored.push(index === segments.length - 1 ? `${token}${FILE_EXTENSION}` : token)
  }
  return stored.join('/')
}

/**
 * Plaintext path for a stored repository path. Each segment is decrypted on
 * its own, so a path that mixes encrypted and plain segments still reads well.
 * `lastType` says whether the final segment is a file (the default) or a folder.
 */
export async function decryptRepoPath(
  path: string,
  key: FilenameKey,
  lastType: 'file' | 'dir' = 'file'
): Promise<string> {
  const segments = path.split('/')
  const plain: string[] = []
  for (const [index, segment] of segments.entries()) {
    const type = index === segments.length - 1 ? lastType : 'dir'
    plain.push(await decryptEntryName(segment, type, key))
  }
  return plain.join('/')
}

/**
 * Check a plaintext path typed by the user. Returns an error message, or null
 * when the path is usable.
 */
export function validateFilePath(path: string): string | null {
  if (path.trim() === '') {
    return 'Enter a file name, for example file.md.'
  }
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.' || segment === '..' || CONTROL_OR_BACKSLASH.test(segment)) {
      return 'Use a path like folder/file.md without empty, "." or ".." parts.'
    }
    if (encoder.encode(segment).length > MAX_SEGMENT_BYTES) {
      return `Each part of the name must be at most ${MAX_SEGMENT_BYTES} bytes.`
    }
  }
  return null
}

async function macTag(
  key: FilenameKey,
  data: Uint8Array<ArrayBuffer>
): Promise<Uint8Array<ArrayBuffer>> {
  const mac = await crypto.subtle.sign('HMAC', key.mac, data)
  return new Uint8Array(mac).slice(0, TAG_BYTES)
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i]
  }
  return diff === 0
}

/** RFC 4648 base32, lowercase and unpadded, so names stay safe on case-insensitive filesystems. */
function toBase32(bytes: Uint8Array): string {
  let output = ''
  let buffer = 0
  let bits = 0
  for (const byte of bytes) {
    buffer = ((buffer << 8) | byte) & 0xffff
    bits += 8
    while (bits >= 5) {
      bits -= 5
      output += BASE32_ALPHABET[(buffer >>> bits) & 31]
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(buffer << (5 - bits)) & 31]
  }
  return output
}

function fromBase32(text: string): Uint8Array | null {
  const bytes: number[] = []
  let buffer = 0
  let bits = 0
  for (const char of text) {
    const value = BASE32_ALPHABET.indexOf(char)
    if (value < 0) return null
    buffer = ((buffer << 5) | value) & 0xffff
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((buffer >>> bits) & 0xff)
    }
  }
  return new Uint8Array(bytes)
}
