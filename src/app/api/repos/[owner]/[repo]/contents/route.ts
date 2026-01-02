import { auth } from "@/auth"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  try {
    const session = await auth()

    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { owner, repo } = await params
    const { searchParams } = new URL(request.url)
    const path = searchParams.get('path') || ''

    const { Octokit } = await import("@octokit/rest")
    const octokit = new Octokit({ auth: session.accessToken })

    // Fetch contents at the specified path
    const { data } = await octokit.repos.getContent({
      owner,
      repo,
      path: path,
    })

    // Return the contents
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching repository contents:', error)
    return NextResponse.json(
      { error: 'Failed to fetch repository contents' },
      { status: 500 }
    )
  }
}
