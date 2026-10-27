/**
 * Input validation for the repository API routes.
 *
 * The routes proxy requests to GitHub with the signed-in user's token, so
 * everything taken from the URL or request body is validated here first. The
 * server also refuses to store anything that is not age ciphertext, so a
 * client bug (or a crafted request) can never commit plaintext.
 */

const OWNER_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/
const REPO_PATTERN = /^[A-Za-z0-9._-]{1,100}$/
const SHA_PATTERN = /^[0-9a-f]{40}$/
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

export const AGE_ARMOR_HEADER = '-----BEGIN AGE ENCRYPTED FILE-----'
export const GITCLOAK_FILE = '.gitcloak'

export const MAX_PATH_LENGTH = 512
export const MAX_MESSAGE_LENGTH = 200
/** Upper bound for the JSON request body, in bytes (GitHub caps files at 100 MB). */
export const MAX_BODY_BYTES = 2 * 1024 * 1024

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export function isValidationError(error: unknown): error is ValidationError {
  return (
    error instanceof ValidationError ||
    (error as { name?: string })?.name === 'ValidationError'
  )
}

export function validateOwnerRepo(owner: string, repo: string): void {
  if (!OWNER_PATTERN.test(owner)) {
    throw new ValidationError('Invalid repository owner')
  }
  if (!REPO_PATTERN.test(repo) || repo === '.' || repo === '..') {
    throw new ValidationError('Invalid repository name')
  }
}

/**
 * Validate a repository-relative path. The empty string (repository root) is
 * accepted only when `allowRoot` is set, which is the case for reads.
 */
export function validatePath(path: unknown, { allowRoot = false } = {}): string {
  if (typeof path !== 'string') {
    throw new ValidationError('Invalid path')
  }
  if (path === '') {
    if (allowRoot) return path
    throw new ValidationError('Invalid path')
  }
  if (path.length > MAX_PATH_LENGTH || CONTROL_CHARS.test(path) || path.includes('\\')) {
    throw new ValidationError('Invalid path')
  }

  const segments = path.split('/')
  for (const segment of segments) {
    const lower = segment.toLowerCase()
    if (segment === '' || segment === '.' || segment === '..' || lower === '.git') {
      throw new ValidationError('Invalid path')
    }
  }
  return path
}

function validateWritablePath(path: string): void {
  // Never let the app write CI configuration or other repository automation.
  if (path.split('/')[0].toLowerCase() === '.github') {
    throw new ValidationError('Writing to .github is not allowed')
  }
  if (path !== GITCLOAK_FILE && !path.endsWith('.age')) {
    throw new ValidationError('Only .age files and .gitcloak can be saved')
  }
}

function validateGitCloakContent(content: string): void {
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    throw new ValidationError('.gitcloak must be valid JSON')
  }
  const { verification, nameKey } = (parsed ?? {}) as {
    verification?: unknown
    nameKey?: unknown
  }
  if (typeof verification !== 'string' || !verification.startsWith(AGE_ARMOR_HEADER)) {
    throw new ValidationError('.gitcloak must contain an age-encrypted verification')
  }
  if (nameKey !== undefined && (typeof nameKey !== 'string' || !nameKey.startsWith(AGE_ARMOR_HEADER))) {
    throw new ValidationError('.gitcloak name key must be age-encrypted')
  }
}

export interface SavePayload {
  path: string
  content: string
  message?: string
  sha?: string
}

export function validateSavePayload(body: unknown): SavePayload {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Invalid request body')
  }
  const { path, content, message, sha } = body as Record<string, unknown>

  const validPath = validatePath(path)
  validateWritablePath(validPath)

  if (typeof content !== 'string' || content === '') {
    throw new ValidationError('Missing required fields')
  }
  if (validPath === GITCLOAK_FILE) {
    validateGitCloakContent(content)
  } else if (!content.startsWith(AGE_ARMOR_HEADER)) {
    throw new ValidationError('Refusing to store content that is not age-encrypted')
  }

  let validMessage: string | undefined
  if (message !== undefined && message !== null && message !== '') {
    if (
      typeof message !== 'string' ||
      message.length > MAX_MESSAGE_LENGTH ||
      CONTROL_CHARS.test(message)
    ) {
      throw new ValidationError('Invalid commit message')
    }
    validMessage = message
  }

  let validSha: string | undefined
  if (sha !== undefined && sha !== null && sha !== '') {
    if (typeof sha !== 'string' || !SHA_PATTERN.test(sha)) {
      throw new ValidationError('Invalid sha')
    }
    validSha = sha
  }

  return { path: validPath, content, message: validMessage, sha: validSha }
}

export interface MovePayload {
  from: string
  to: string
  fromSha: string
}

/**
 * Validate a rename of an encrypted file. Only `.age` files may be moved, and
 * the target must pass the same rules as a save.
 */
export function validateMovePayload(body: unknown): MovePayload {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new ValidationError('Invalid request body')
  }
  const { from, to, fromSha } = body as Record<string, unknown>

  const validFrom = validatePath(from)
  if (!validFrom.endsWith('.age') || validFrom === GITCLOAK_FILE) {
    throw new ValidationError('Only .age files can be renamed')
  }
  if (validFrom.split('/')[0].toLowerCase() === '.github') {
    throw new ValidationError('Writing to .github is not allowed')
  }

  const validTo = validatePath(to)
  // .gitcloak is writable through save, but a rename must never replace it.
  if (!validTo.endsWith('.age')) {
    throw new ValidationError('Only .age files can be renamed')
  }
  validateWritablePath(validTo)
  if (validTo === validFrom) {
    throw new ValidationError('The new name must differ from the old one')
  }

  if (typeof fromSha !== 'string' || !SHA_PATTERN.test(fromSha)) {
    throw new ValidationError('Invalid sha')
  }

  return { from: validFrom, to: validTo, fromSha }
}

/**
 * Reject cross-origin browser requests to state-changing routes. Requests
 * without an `Origin` header (non-browser clients) are left to the session
 * check. Compares against the forwarded host so it holds behind Vercel's
 * proxy for previews and production alike.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return true

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  try {
    return host !== null && new URL(origin).host === host
  } catch {
    return false
  }
}
