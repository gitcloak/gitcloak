import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { createFileBackend } from "@/lib/backends"

/**
 * Repositories the signed-in user could still add to the app installation,
 * plus a link to GitHub's installation settings for the authoritative list.
 *
 * The candidate list is best-effort: a GitHub App user token can only see the
 * repositories both the user and the app can access, so it can come back
 * empty. The client falls back to the settings link in that case.
 */
export async function GET() {
  try {
    const session = await getSession()

    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const backend = await createFileBackend(session.accessToken)
    const access = await backend.listRepositoryAccess()

    return NextResponse.json(access)
  } catch (error) {
    console.error('Error loading repository access:', error)
    return NextResponse.json(
      { error: 'Failed to load repository access' },
      { status: 500 }
    )
  }
}
