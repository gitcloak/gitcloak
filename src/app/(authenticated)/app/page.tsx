import { redirect } from "next/navigation"
import { TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { getSession } from "@/lib/session"
import { createFileBackend, type RepositorySummary } from "@/lib/backends"
import { ClientPage } from "./client-page"

export default async function AppPage() {
  const session = await getSession()

  // Protection is handled by layout, but double-check
  if (!session?.user || !session.accessToken) {
    redirect('/')
  }

  // Fetch repositories selected during GitHub App installation (or the seeded
  // repositories when the mock backend is active).
  let repositories: RepositorySummary[] = []
  let error: string | null = null

  try {
    const backend = await createFileBackend(session.accessToken)
    repositories = await backend.listRepositories()
  } catch (err) {
    console.error('Error loading repositories:', err)

    // Check if it's a 401 error (expired/invalid token)
    if (err && typeof err === 'object' && 'status' in err && err.status === 401) {
      // GitHub rejected the token and the refresh did not recover it. End the
      // session and show the landing page's sign-in, not the sign-out prompt.
      console.log('Token expired or invalid, ending session')
      redirect('/api/session/end')
    }

    error = err instanceof Error ? err.message : 'Failed to load repositories'
  }

  // Show error if any
  if (error) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center bg-muted p-6">
        <div className="w-full max-w-md rounded-xl border bg-card p-8 text-center shadow-sm">
          <TriangleAlert className="mx-auto mb-4 size-10 text-gc-warning-fg" />
          <h2 className="mb-2 text-lg font-semibold">Error Loading Data</h2>
          <p className="mb-6 text-sm text-muted-foreground">{error}</p>
          <Button asChild>
            <a href="/app">Retry</a>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <ClientPage
      repositories={repositories}
      userName={session.user.name || session.user.email || 'User'}
      userImage={session.user.image || undefined}
      userEmail={session.user.email || undefined}
    />
  )
}
