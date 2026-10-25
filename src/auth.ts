import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"

/**
 * `profile` is typed as the generic `Profile`; the GitHub provider's payload is
 * a `GitHubProfile`, which carries `login`.
 */
function githubLogin(profile: unknown): string | undefined {
  const login = (profile as { login?: unknown })?.login
  return typeof login === "string" ? login : undefined
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: process.env.AUTH_SECRET,
  providers: [
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      // GitHub now includes the `iss` parameter on the OAuth callback
      // (`https://github.com/login/oauth`). Auth.js's built-in GitHub provider is
      // `type: "oauth"` with no issuer, so oauth4webapi validates `iss` against the
      // sentinel `https://authjs.dev` and throws "unexpected iss response parameter
      // value" -> CallbackRouteError -> error=Configuration. Declaring the issuer
      // makes the validation pass. Must be an exact match to GitHub's `iss` value.
      issuer: "https://github.com/login/oauth",
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

      }
      if (profile) {
        token.login = githubLogin(profile)
      }
      return token
    },
    async session({ session, token }) {
      // Make the access token and GitHub login available in the session
      session.accessToken = token.accessToken as string
      session.user.login = token.login as string

      return session
    },
  },
  // Auth.js debug output is verbose and can include token material; keep it
  // to local development so it never reaches production or preview logs.
  debug: process.env.NODE_ENV === "development",
})
