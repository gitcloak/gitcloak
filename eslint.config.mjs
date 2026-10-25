import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// `eslint-config-next` still ships eslintrc-style configs, so bridge them into
// flat config with FlatCompat. This replaces `next lint`, which Next 15
// deprecated and Next 16 removes.
const compat = new FlatCompat({ baseDirectory: __dirname })

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      '.next/**',
      '.next-e2e/**',
      'node_modules/**',
      'test-results/**',
      'playwright-report/**',
      'next-env.d.ts',
    ],
  },
]

export default eslintConfig
