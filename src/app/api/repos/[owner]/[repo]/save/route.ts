import { auth } from "@/auth"
import { NextResponse } from "next/server"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  try {
    const session = await auth()

    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { owner, repo } = await params
    const body = await request.json()
    const { path, content, sha, message } = body

    if (!path || content === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { Octokit } = await import("@octokit/rest")
    const octokit = new Octokit({ auth: session.accessToken })

    // Create or update file in GitHub
    const response = await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: path,
      message: message || `Update ${path}`,
      content: Buffer.from(content).toString('base64'),
      sha: sha || undefined, // Only include sha if updating existing file
    })

    return NextResponse.json({
      success: true,
      sha: response.data.content?.sha,
      path: response.data.content?.path,
    })
  } catch (error: any) {
    console.error('Error saving file:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save file' },
      { status: 500 }
    )
  }
}
