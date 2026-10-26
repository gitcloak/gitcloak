import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBackendKind } from '@/lib/backends'

afterEach(() => {
  vi.unstubAllEnvs()
})

function env(values: Record<string, string>) {
  vi.stubEnv('FILE_BACKEND', '')
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('VERCEL', '')
  vi.stubEnv('NEXT_PUBLIC_MOCK_BACKEND', '')
  for (const [key, value] of Object.entries(values)) vi.stubEnv(key, value)
}

describe('getBackendKind', () => {
  it('defaults to the git backend', () => {
    env({})
    expect(getBackendKind()).toBe('git')
  })

  it('allows mock mode outside production (tests, local dev)', () => {
    env({ FILE_BACKEND: 'mock' })
    expect(getBackendKind()).toBe('mock')
  })

  it('refuses mock mode in a production runtime that was not built for it', () => {
    env({ FILE_BACKEND: 'mock', NODE_ENV: 'production' })
    expect(() => getBackendKind()).toThrow(/not allowed/)
  })

  it('refuses mock mode on Vercel even when the bundle claims to be a mock build', () => {
    env({
      FILE_BACKEND: 'mock',
      NODE_ENV: 'production',
      NEXT_PUBLIC_MOCK_BACKEND: '1',
      VERCEL: '1',
    })
    expect(() => getBackendKind()).toThrow(/not allowed/)
  })

  it('allows an explicitly built local mock bundle', () => {
    env({ FILE_BACKEND: 'mock', NODE_ENV: 'production', NEXT_PUBLIC_MOCK_BACKEND: '1' })
    expect(getBackendKind()).toBe('mock')
  })

  it('ignores FILE_BACKEND values other than mock', () => {
    env({ FILE_BACKEND: 'git', NODE_ENV: 'production' })
    expect(getBackendKind()).toBe('git')
  })
})
