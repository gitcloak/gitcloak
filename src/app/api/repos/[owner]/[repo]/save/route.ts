import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { createFileBackend, isBackendConflict } from "@/lib/backends"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  try {
    const session = await getSession()

    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { owner, repo } = await params
    const body = await request.json()
    const { path, content, sha, message } = body

    if (!path || content === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const backend = createFileBackend(session.accessToken)
    const result = await backend.saveFile({
      owner,
      repo,
      path,
      content,
      message: message || `Update ${path}`,
      sha: sha || undefined,
    })

    return NextResponse.json({
      success: true,
      sha: result.sha,
      path: result.path,
    })
  } catch (error: any) {
    if (isBackendConflict(error)) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }

    console.error('Error saving file:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save file' },
      { status: 500 }
    )
  }
}
