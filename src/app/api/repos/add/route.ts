import { NextResponse } from "next/server"
import { getSession } from "@/lib/session"
import { createFileBackend, isBackendNotFound } from "@/lib/backends"
import {
  isSameOrigin,
  isValidationError,
  validateAddRepositoryPayload,
} from "@/lib/validation"

/**
 * Extend the GitHub App installation to one more repository, so it can be
 * opened in the app. Requires the app to have the `installation_repositories`
 * write permission; the user must be an admin on the repository.
 */
export async function POST(request: Request) {
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const session = await getSession()

    if (!session?.accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }

    const { owner, repo } = validateAddRepositoryPayload(body)

    const backend = await createFileBackend(session.accessToken)
    await backend.addRepositoryToInstallation(owner, repo)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isValidationError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    const status = (error as { status?: number })?.status

    // GitHub hides repositories the installation does not cover yet, so a
    // lookup by name fails with 404 even when the repository exists and the
    // user can see it in GitHub's own UI.
    if (isBackendNotFound(error) || status === 404) {
      return NextResponse.json(
        {
          error:
            "GitHub did not let GitCloak see that repository. Add it in GitHub's installation settings instead.",
        },
        { status: 404 }
      )
    }

    if (status === 403) {
      return NextResponse.json(
        {
          error:
            'GitHub refused to add that repository. You need admin access to it.',
        },
        { status: 403 }
      )
    }

    console.error('Error adding repository to installation:', error)
    return NextResponse.json(
      {
        error:
          'Failed to add repository. Check that you have admin access to it.',
      },
      { status: 500 }
    )
  }
}
