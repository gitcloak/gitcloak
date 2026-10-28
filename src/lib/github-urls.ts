/**
 * GitHub web URLs the app links to.
 *
 * These are plain, user-facing `github.com` links (never API calls), kept in
 * one place so the shapes are easy to review and test.
 */

/**
 * Installation settings page for an installation, where its owner can change
 * which repositories the app may access. Personal accounts and organizations
 * use different paths.
 */
export function installationSettingsUrl(
  accountType: string,
  accountLogin: string,
  installationId: number
): string {
  if (accountType.toLowerCase() === 'organization') {
    return `https://github.com/organizations/${encodeURIComponent(
      accountLogin
    )}/settings/installations/${installationId}`
  }
  return `https://github.com/settings/installations/${installationId}`
}

/**
 * The app's install page, which an account owner uses to install the app (or
 * to authorize more repositories on an existing installation). Returns null
 * when the app name is not configured, since a slug cannot be guessed.
 */
export function appInstallUrl(appName: string | undefined): string | null {
  const slug = appName?.trim()
  if (!slug) return null
  return `https://github.com/apps/${encodeURIComponent(slug)}/installations/new`
}
