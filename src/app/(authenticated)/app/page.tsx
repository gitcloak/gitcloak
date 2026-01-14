import { auth, signOut } from "@/auth"
import { redirect } from "next/navigation"
import { ClientPage } from "./client-page"

export default async function AppPage() {
  const session = await auth()

  // Protection is handled by layout, but double-check
  if (!session?.user || !session.accessToken) {
    redirect('/')
  }

  // Fetch repositories selected during GitHub App installation
  let repositories: Array<{
    id: number
    name: string
    fullName: string
    owner: string
    private: boolean
    description: string | null
    updatedAt: string
  }> = []
  let error: string | null = null

  try {
    const { Octokit } = await import("@octokit/rest")
    const octokit = new Octokit({ auth: session.accessToken })

    // Get user's installations for our GitHub App
    const { data: installations } = await octokit.apps.listInstallationsForAuthenticatedUser({
      per_page: 100
    })

    console.log('User installations:', installations)

    // Find our app's installation
    const appId = process.env.GITHUB_APP_ID
    const installation = installations.installations.find(
      (inst: any) => inst.app_id === parseInt(appId || '0')
    )

    if (!installation) {
      console.log('No installation found for app ID:', appId)
      error = 'GitHub App not installed. Please authorize the app and select repositories.'
    } else {
      console.log('Found installation:', installation.id)

      // Get only the repositories user selected during installation
      const { data: repoData } = await octokit.apps.listInstallationReposForAuthenticatedUser({
        installation_id: installation.id,
        per_page: 100
      })

      console.log('Selected repositories:', repoData.repositories.length)

      repositories = repoData.repositories.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        private: repo.private,
        description: repo.description,
        updatedAt: repo.updated_at,
      }))
    }
  } catch (err) {
    console.error('Error loading repositories:', err)

    // Check if it's a 401 error (expired/invalid token)
    if (err && typeof err === 'object' && 'status' in err && err.status === 401) {
      // Token is invalid or expired - redirect to sign-in
      console.log('Token expired or invalid, redirecting to sign-in')
      // First sign out to clear the invalid session, then redirect to sign in
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
