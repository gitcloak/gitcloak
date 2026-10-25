'use client'

import { useCallback, useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, Ellipsis, File as FileIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface TreeNode {
  name: string
  path: string
  type: 'file' | 'dir'
  sha: string
}

interface FileTreeProps {
  owner: string
  repo: string
  onFileSelect?: (path: string, sha: string) => void
  onRefresh?: () => void
  selectedFilePath?: string
  onLoadingChange?: (isLoading: boolean) => void
}

function TreeItem({
  node,
  owner,
  repo,
  level = 0,
  onFileSelect,
  selectedFilePath,
}: {
  node: TreeNode
  owner: string
  repo: string
  level?: number
  onFileSelect?: (path: string, sha: string) => void
  selectedFilePath?: string
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [children, setChildren] = useState<TreeNode[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const handleToggle = async () => {
    if (node.type === 'file') {
      onFileSelect?.(node.path, node.sha)
      return
    }

    if (!isExpanded && children.length === 0) {
      // Load children
      setIsLoading(true)
      try {
        const response = await fetch(
          `/api/repos/${owner}/${repo}/contents?path=${encodeURIComponent(node.path)}`
        )
        const data = await response.json()

        // Sort: directories first, then files, alphabetically
        const sorted = (Array.isArray(data) ? data : []).sort(
          (a: TreeNode, b: TreeNode) => {
            if (a.type === b.type) {
              return a.name.localeCompare(b.name)
            }
            return a.type === 'dir' ? -1 : 1
          }
        )

        setChildren(sorted)
      } catch (error) {
        console.error('Error loading folder contents:', error)
      } finally {
        setIsLoading(false)
      }
    }

    setIsExpanded(!isExpanded)
  }

  const isSelected = node.type === 'file' && node.path === selectedFilePath

  return (
    <div>
      <div
        data-testid="file-node"
        data-path={node.path}
        data-node-type={node.type}
        data-selected={isSelected}
        onClick={handleToggle}
        style={{ paddingLeft: `${level * 12 + 6}px` }}
        className={cn(
          'flex cursor-pointer items-center gap-1.5 rounded-md py-1 pr-2 text-[13px] transition-colors',
          'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          isSelected
            ? 'bg-sidebar-accent font-medium text-sidebar-accent-foreground'
            : 'text-sidebar-foreground'
        )}
      >
        {node.type === 'dir' ? (
          <span className="flex w-3 shrink-0 items-center justify-center text-muted-foreground">
            {isLoading ? (
              <Ellipsis className="size-3" />
            ) : isExpanded ? (
              <ChevronDown className="size-3" />
            ) : (
              <ChevronRight className="size-3" />
            )}
          </span>
        ) : (
          <span className="flex w-3 shrink-0 items-center justify-center text-muted-foreground">
            <FileIcon className="size-3" />
          </span>
        )}
        <span className="truncate">{node.name}</span>
      </div>

      {isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <TreeItem
              key={child.path}
              node={child}
              owner={owner}
              repo={repo}
              level={level + 1}
              onFileSelect={onFileSelect}
              selectedFilePath={selectedFilePath}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function FileTree({
  owner,
  repo,
  onFileSelect,
  onRefresh,
  selectedFilePath,
  onLoadingChange,
}: FileTreeProps) {
  const [rootNodes, setRootNodes] = useState<TreeNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const loadRootContents = useCallback(async () => {
    setIsLoading(true)
    onLoadingChange?.(true)
    setError(null)
    try {
      const response = await fetch(
        `/api/repos/${owner}/${repo}/contents?t=${Date.now()}`
      )
      if (!response.ok) {
        throw new Error('Failed to load repository contents')
      }
      const data = await response.json()

      // Sort: directories first, then files, alphabetically
      const sorted = (Array.isArray(data) ? data : []).sort(
        (a: TreeNode, b: TreeNode) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name)
          }
          return a.type === 'dir' ? -1 : 1
        }
      )

      setRootNodes(sorted)
      onRefresh?.()
    } catch (err) {
      console.error('Error loading repository contents:', err)
      setError('Failed to load files')
    } finally {
      setIsLoading(false)
      onLoadingChange?.(false)
    }
  }, [owner, repo, onLoadingChange, onRefresh])

  useEffect(() => {
    loadRootContents()
  }, [loadRootContents, refreshTrigger])

  // Expose refresh function
  useEffect(() => {
    // Store refresh function on window for parent to call
    window.__fileTreeRefresh = () => setRefreshTrigger((prev) => prev + 1)
    return () => {
      delete window.__fileTreeRefresh
    }
  }, [])

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

  return (
    <div className="flex flex-col gap-px">
      {rootNodes.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          owner={owner}
          repo={repo}
          onFileSelect={onFileSelect}
          selectedFilePath={selectedFilePath}
        />
      ))}
    </div>
  )
}
