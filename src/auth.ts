import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"

import { applyJwt, toClientSession } from "@/lib/auth-callbacks"

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
    // The GitHub tokens stay in the encrypted JWT cookie only; the session
    // returned to the browser carries just the user's identity.
    async jwt({ token, account, profile }) {
      return applyJwt(token, account, profile)
    },
    async session({ session, token }) {
      return toClientSession(session, token)
    },
  },
  // Auth.js debug output is verbose and can include token material; keep it
  // to local development so it never reaches production or preview logs.
  debug: process.env.NODE_ENV === "development",
})
