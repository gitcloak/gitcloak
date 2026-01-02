import { signIn } from '@/auth'

export async function GET(request: Request) {
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
