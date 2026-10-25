import { redirect } from "next/navigation"
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
    const backend = createFileBackend(session.accessToken)
    repositories = await backend.listRepositories()
  } catch (err) {
    console.error('Error loading repositories:', err)

    // Check if it's a 401 error (expired/invalid token)
    if (err && typeof err === 'object' && 'status' in err && err.status === 401) {
      // Token is invalid or expired - redirect to sign-in
      console.log('Token expired or invalid, redirecting to sign-in')
      redirect('/api/auth/signout?callbackUrl=/api/auth/signin?callbackUrl=/app')
    }

    error = err instanceof Error ? err.message : 'Failed to load repositories'
  }

  // Show error if any
  if (error) {
    return (
      <div style={{
        width: '100%',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f6f8fa'
      }}>
        <div style={{
          maxWidth: '500px',
          padding: '3rem 2rem',
          textAlign: 'center',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ marginBottom: '1rem', color: '#333' }}>Error Loading Data</h2>
          <p style={{ color: '#666', marginBottom: '2rem' }}>{error}</p>
          <a
            href="/app"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#24292e',
              color: 'white',
              borderRadius: '6px',
              textDecoration: 'none',
              fontWeight: '500'
            }}
          >
            Retry
          </a>
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
