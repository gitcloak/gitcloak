import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { createFileBackend } from "@/lib/backends"

/**
 * The repositories the GitHub App installation currently covers.
 *
 * The selection can change outside this app (GitHub's installation settings
 * page), which this server component only reads on a full page load. The
 * "Add repositories" dialog calls this on open so a repository granted on
 * GitHub shows up without a reload.
 */
export async function GET() {
  try {
    const session = await getSession()

    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const backend = await createFileBackend(session.accessToken)
    const repositories = await backend.listRepositories()

    return NextResponse.json({ repositories })
  } catch (error) {
    console.error('Error refreshing repositories:', error)
    return NextResponse.json(
      { error: 'Failed to load repositories' },
      { status: 500 }
    )
  }
}
