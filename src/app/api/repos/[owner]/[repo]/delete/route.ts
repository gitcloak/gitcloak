import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { createFileBackend, isBackendConflict, isBackendNotFound } from "@/lib/backends"
import {
  MAX_BODY_BYTES,
  isSameOrigin,
  isValidationError,
  validateDeletePayload,
  validateOwnerRepo,
} from "@/lib/validation"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const session = await getSession()

    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { owner, repo } = await params
    validateOwnerRepo(owner, repo)

    const declaredLength = Number(request.headers.get('content-length') ?? 0)
    if (declaredLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    const rawBody = await request.text()
    if (rawBody.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
    }

    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { path, sha, message } = validateDeletePayload(body)

    const backend = await createFileBackend(session.accessToken)
    await backend.deleteFile({
      owner,
      repo,
      path,
      sha,
      message: message || `Delete ${path}`,
    })

    return NextResponse.json({ success: true, path })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (isBackendNotFound(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    if (isBackendConflict(error)) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    console.error('Error deleting file:', error)
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 })
  }
}
