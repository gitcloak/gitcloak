import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      // GitHub App authorization - users select repositories during installation
      authorization: {
        url: "https://github.com/login/oauth/authorize",
        params: {
          // No scope needed - permissions are defined in the GitHub App settings
          // Users will be prompted to select repositories during authorization
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // Store the GitHub access token and user info in the JWT
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at

        // Log for debugging
        console.log('Auth callback - account:', {
          provider: account.provider,
          type: account.type,
          hasAccessToken: !!account.access_token,
          tokenPreview: account.access_token?.substring(0, 20) + '...',
          scope: account.scope,
        })
      }
      if (profile) {
        token.login = (profile as any).login
      }
      return token
    },
    async session({ session, token }) {
      // Make the access token and GitHub login available in the session
      session.accessToken = token.accessToken as string
      session.user.login = token.login as string

      // Log for debugging
      console.log('Session callback:', {
        hasAccessToken: !!session.accessToken,
        tokenPreview: session.accessToken?.substring(0, 20) + '...',
      })

      return session
    },
  },
  debug: true, // Enable debug mode to see auth flow issues
})
