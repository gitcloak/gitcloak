import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { createFileBackend, isBackendNotFound } from "@/lib/backends"
import {
  isValidationError,
  validateOwnerRepo,
  validatePath,
} from "@/lib/validation"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  try {
    const session = await getSession()

    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { owner, repo } = await params
    const { searchParams } = new URL(request.url)
    validateOwnerRepo(owner, repo)
    const path = validatePath(searchParams.get('path') ?? '', { allowRoot: true })

    const backend = await createFileBackend(session.accessToken)
    const result = await backend.getContents(owner, repo, path)

    // Keep the GitHub-compatible response shape the browser code expects:
    // directories are a JSON array and files carry base64 `content`.
    if (result.type === 'dir') {
      return NextResponse.json(result.entries)
    }

    const file = result.file
    return NextResponse.json({
      name: file.name,
      path: file.path,
      sha: file.sha,
      size: file.size,
      type: 'file',
      content: Buffer.from(file.content, 'utf-8').toString('base64'),
      encoding: 'base64',
    })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    if (isBackendNotFound(error)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    console.error('Error fetching repository contents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch repository contents' },
      { status: 500 }
    )
  }
}
