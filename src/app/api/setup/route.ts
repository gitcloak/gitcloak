import { signIn } from '@/auth'
import { isMockBackend } from '@/lib/backends'

export async function GET(request: Request) {
  // In mock mode there is no GitHub App to install or authorize; go straight
  // to the app using the simulated session.
  if (isMockBackend()) {
    return Response.redirect(new URL('/app', request.url), 302)
  }

  // After GitHub App installation, redirect to NextAuth sign-in
  // This completes the flow: Install → Authorize → App

  const { searchParams } = new URL(request.url)
  const installationId = searchParams.get('installation_id')
  const setupAction = searchParams.get('setup_action')

  console.log('GitHub App setup callback:', {
    installationId,
    setupAction,
  })

  // Use NextAuth v5 signIn function
  // This properly handles PKCE and OAuth flow
  await signIn('github', { redirectTo: '/app' })
}
