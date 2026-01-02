import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { createGitHubAppClient } from "@/lib/github-app"
import { ClientPage } from "./client-page"

export default async function AppPage() {
  const session = await auth()

  // Protection is handled by layout, but double-check
  if (!session?.user || !session.accessToken) {
    redirect('/')
  }

  // Fetch repositories using GitHub App installation
  // This will only show repositories the user selected during installation
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

    // First, get the user's installations for our app
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
      error = 'GitHub App not installed. Please install the app first.'
    } else {
      console.log('Found installation:', installation.id)

      // Get repositories for this installation
      const { data: repoData } = await octokit.apps.listInstallationReposForAuthenticatedUser({
        installation_id: installation.id,
        per_page: 100
      })

      console.log('Installation repositories:', repoData.repositories.length)

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
    error = err instanceof Error ? err.message : 'Failed to load repositories'
  }

  // If no repositories, show installation prompt
  if (repositories.length === 0 && !error) {
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
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔐</div>
          <h2 style={{ marginBottom: '1rem', color: '#333' }}>
            Install GitCloak GitHub App
          </h2>
          <p style={{ color: '#666', marginBottom: '2rem', lineHeight: '1.6' }}>
            You need to install the GitCloak GitHub App and select repositories to get started.
          </p>
          <a
            href={`https://github.com/apps/${process.env.NEXT_PUBLIC_GITHUB_APP_NAME || 'gitcloak'}/installations/new`}
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
            Install GitHub App
          </a>
        </div>
      </div>
    )
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
