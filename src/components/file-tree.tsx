'use client'

import { useCallback, useState, useEffect, type ReactNode } from 'react'
import { ChevronDown, ChevronRight, Ellipsis, File as FileIcon, Lock } from 'lucide-react'

import { decryptEntryName, type FilenameKey } from '@/lib/filenames'
import { cn } from '@/lib/utils'

/** A row as stored in the repository. `name` and `path` are what GitHub has. */
interface TreeNode {
  name: string
  path: string
  type: 'file' | 'dir'
  sha: string
}

interface FileTreeProps {
  owner: string
  repo: string
  /** Set while the repository is unlocked. Names are shown decrypted only then. */
  filenameKey?: FilenameKey | null
  onFileSelect?: (path: string, sha: string) => void
  onRefresh?: () => void
  selectedFilePath?: string
  onLoadingChange?: (isLoading: boolean) => void
}

/** Directories first, then files, each alphabetically by the label they show. */
function sortNodes(nodes: TreeNode[], labelOf: (node: TreeNode) => string): TreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.type === b.type) {
      return labelOf(a).localeCompare(labelOf(b))
    }
    return a.type === 'dir' ? -1 : 1
  })
}

export function FileTree({
  owner,
  repo,
  filenameKey = null,
  onFileSelect,
  onRefresh,
  selectedFilePath,
  onLoadingChange,
}: FileTreeProps) {
  const [rootNodes, setRootNodes] = useState<TreeNode[]>([])
  // Loaded folder contents keyed by stored path. The tree keeps them here
  // rather than in each row so it can sort and label everything together.
  const [children, setChildren] = useState<Record<string, TreeNode[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [loadingDirs, setLoadingDirs] = useState<Record<string, boolean>>({})
  // Plain names keyed by stored path. Only read while `filenameKey` is set.
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const fetchEntries = useCallback(
    async (path: string): Promise<TreeNode[]> => {
      const response = await fetch(
        `/api/repos/${owner}/${repo}/contents?path=${encodeURIComponent(path)}&t=${Date.now()}`
      )
      if (!response.ok) {
        throw new Error('Failed to load repository contents')
      }
      const data = await response.json()
      return Array.isArray(data) ? data : []
    },
    [owner, repo]
  )

  const loadRootContents = useCallback(async () => {
    setIsLoading(true)
    onLoadingChange?.(true)
    setError(null)
    try {
      setRootNodes(await fetchEntries(''))
      setChildren({})
      setExpanded({})
      onRefresh?.()
    } catch (err) {
      console.error('Error loading repository contents:', err)
      setError('Failed to load files')
    } finally {
      setIsLoading(false)
      onLoadingChange?.(false)
    }
  }, [fetchEntries, onLoadingChange, onRefresh])

  useEffect(() => {
    loadRootContents()
  }, [loadRootContents, refreshTrigger])

  // Decrypt every loaded name whenever the key or the listing changes.
  useEffect(() => {
    if (!filenameKey) return
    let cancelled = false
    const nodes = [...rootNodes, ...Object.values(children).flat()]

    void (async () => {
      const next: Record<string, string> = {}
      for (const node of nodes) {
        next[node.path] = await decryptEntryName(node.name, node.type, filenameKey)
      }
      if (!cancelled) {
        setLabels(next)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [filenameKey, rootNodes, children])

  // Expose refresh function
  useEffect(() => {
    // Store refresh function on window for parent to call
    window.__fileTreeRefresh = () => setRefreshTrigger((prev) => prev + 1)
    return () => {
      delete window.__fileTreeRefresh
    }
  }, [])

  // Never show a decrypted name while locked, even before the labels catch up.
  const labelOf = (node: TreeNode): string => (filenameKey && labels[node.path]) || node.name

  const toggleDirectory = async (node: TreeNode) => {
    const isOpen = Boolean(expanded[node.path])

    if (!isOpen && !children[node.path]) {
      setLoadingDirs(prev => ({ ...prev, [node.path]: true }))
      try {
        const entries = await fetchEntries(node.path)
        setChildren(prev => ({ ...prev, [node.path]: entries }))
      } catch (err) {
        console.error('Error loading folder contents:', err)
      } finally {
        setLoadingDirs(prev => ({ ...prev, [node.path]: false }))
      }
    }

    setExpanded(prev => ({ ...prev, [node.path]: !isOpen }))
  }

  const renderNodes = (nodes: TreeNode[], level: number): ReactNode[] =>
    sortNodes(nodes, labelOf).map((node) => {
      const isDir = node.type === 'dir'
      const isExpanded = Boolean(expanded[node.path])
      const isSelected = !isDir && node.path === selectedFilePath
      const label = labelOf(node)
      // `.age` files are encrypted whether or not the repository is unlocked.
      const isProtected = !isDir && node.name.endsWith('.age')

      return (
        <div key={node.path}>
          <div
            data-testid="file-node"
            data-path={node.path}
            data-name={label}
            data-node-type={node.type}
            data-protected={isProtected}
            data-selected={isSelected}
            onClick={() => (isDir ? void toggleDirectory(node) : onFileSelect?.(node.path, node.sha))}
            style={{ paddingLeft: `${level * 12 + 6}px` }}
            className={cn(
              'flex cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-[13px] transition-colors',
              'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
              isSelected
                ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
                : 'text-sidebar-foreground'
            )}
          >
            {isDir ? (
              <span className="flex w-3 shrink-0 items-center justify-center text-muted-foreground">
                {loadingDirs[node.path] ? (
                  <Ellipsis className="size-3" />
                ) : isExpanded ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
              </span>
            ) : isProtected ? (
              <span
                className="flex w-3 shrink-0 items-center justify-center text-sidebar-foreground"
                title="Encrypted file"
                aria-label="Encrypted file"
              >
                <Lock className="size-3" />
              </span>
            ) : (
              <span
                className="flex w-3 shrink-0 items-center justify-center text-muted-foreground"
                title="Plain file"
                aria-label="Plain file"
              >
                <FileIcon className="size-3" />
              </span>
            )}
            <span className="truncate">{label}</span>
          </div>

          {isDir && isExpanded && children[node.path] && (
            <div>{renderNodes(children[node.path], level + 1)}</div>
          )}
        </div>
      )
    })

  if (isLoading) {
    return (
      <div
        data-testid="file-tree-loading"
        className="px-2 py-4 text-[13px] text-muted-foreground"
      >
        Loading files…
      </div>
    )
  }

  if (error) {
    return (
      <div
        data-testid="file-tree-error"
        className="px-2 py-4 text-[13px] text-destructive"
      >
        {error}
      </div>
    )
  }

  if (rootNodes.length === 0) {
    return (
      <div
        data-testid="file-tree-empty"
        className="px-2 py-4 text-[13px] text-muted-foreground"
      >
        No files found
      </div>
    )
  }

  return <div className="flex flex-col gap-px">{renderNodes(rootNodes, 0)}</div>
}
