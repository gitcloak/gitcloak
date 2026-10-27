import { useEffect, useState } from 'react'

import { decryptRepoPath, type FilenameKey } from '@/lib/filenames'

/**
 * The plain form of a stored repository path, for display. It shows the
 * stored path whenever there is no key, and until decryption has finished.
 */
export function useDisplayPath(
  path: string | undefined,
  key: FilenameKey | null
): string | undefined {
  const [resolved, setResolved] = useState<{
    key: FilenameKey
    path: string
    plain: string
  } | null>(null)

  useEffect(() => {
    if (!path || !key) return
    let cancelled = false
    void decryptRepoPath(path, key).then((plain) => {
      if (!cancelled) {
        setResolved({ key, path, plain })
      }
    })
    return () => {
      cancelled = true
    }
  }, [path, key])

  if (!path || !key) return path
  return resolved?.key === key && resolved.path === path ? resolved.plain : path
}
