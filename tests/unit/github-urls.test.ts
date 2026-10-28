import { describe, expect, it } from 'vitest'
import { appInstallUrl, installationSettingsUrl } from '@/lib/github-urls'

describe('installationSettingsUrl', () => {
  it('uses the personal settings path for a user account', () => {
    expect(installationSettingsUrl('User', 'octocat', 42)).toBe(
      'https://github.com/settings/installations/42'
    )
  })

  it('uses the organization settings path for an organization', () => {
    expect(installationSettingsUrl('Organization', 'acme', 42)).toBe(
      'https://github.com/organizations/acme/settings/installations/42'
    )
  })

  it('is case-insensitive about the account type', () => {
    expect(installationSettingsUrl('organization', 'acme', 1)).toBe(
      'https://github.com/organizations/acme/settings/installations/1'
    )
  })

  it('falls back to the personal path when the type is unknown', () => {
    expect(installationSettingsUrl('', 'octocat', 7)).toBe(
      'https://github.com/settings/installations/7'
    )
  })

  it('escapes the account login', () => {
    expect(installationSettingsUrl('Organization', 'a b', 1)).toBe(
      'https://github.com/organizations/a%20b/settings/installations/1'
    )
  })
})

describe('appInstallUrl', () => {
  it('builds the install page from the app slug', () => {
    expect(appInstallUrl('gitcloak')).toBe(
      'https://github.com/apps/gitcloak/installations/new'
    )
  })

  it('returns null when no slug is configured', () => {
    expect(appInstallUrl(undefined)).toBeNull()
    expect(appInstallUrl('   ')).toBeNull()
  })
})
