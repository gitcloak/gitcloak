'use client'

import { useState, useEffect } from 'react'
import { FiFile, FiChevronRight, FiChevronDown, FiMoreHorizontal } from 'react-icons/fi'

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
        const sorted = (Array.isArray(data) ? data : []).sort((a: TreeNode, b: TreeNode) => {
          if (a.type === b.type) {
            return a.name.localeCompare(b.name)
          }
          return a.type === 'dir' ? -1 : 1
        })

        setChildren(sorted)
      } catch (error) {
        console.error('Error loading folder contents:', error)
      } finally {
        setIsLoading(false)
      }
    }

    setIsExpanded(!isExpanded)
  }

  const paddingLeft = `${level * 12 + 8}px`
  const isSelected = node.type === 'file' && node.path === selectedFilePath

  return (
    <div>
      <div
        onClick={handleToggle}
        style={{
          paddingLeft,
          paddingRight: '8px',
          paddingTop: '4px',
          paddingBottom: '4px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          color: '#24292e',
          transition: 'background-color 0.1s',
          backgroundColor: isSelected ? '#e8f0fe' : 'transparent',
          fontWeight: isSelected ? '500' : 'normal',
        }}
        onMouseEnter={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = '#f6f8fa'
          }
        }}
        onMouseLeave={(e) => {
          if (!isSelected) {
            e.currentTarget.style.backgroundColor = 'transparent'
          }
        }}
      >
        {node.type === 'dir' && (
          <span style={{ width: '12px', display: 'flex', alignItems: 'center', color: '#666' }}>
            {isLoading ? <FiMoreHorizontal size={12} /> : isExpanded ? <FiChevronDown size={12} /> : <FiChevronRight size={12} />}
          </span>
        )}
        {node.type === 'file' && (
          <span style={{ width: '12px', display: 'flex', alignItems: 'center', color: '#666' }}>
            <FiFile size={12} />
          </span>
        )}
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
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

export function FileTree({ owner, repo, onFileSelect, onRefresh, selectedFilePath, onLoadingChange }: FileTreeProps) {
  const [rootNodes, setRootNodes] = useState<TreeNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const loadRootContents = async () => {
    setIsLoading(true)
    onLoadingChange?.(true)
    setError(null)
    try {
      const response = await fetch(`/api/repos/${owner}/${repo}/contents?t=${Date.now()}`)
      if (!response.ok) {
        throw new Error('Failed to load repository contents')
      }
      const data = await response.json()

      // Sort: directories first, then files, alphabetically
      const sorted = (Array.isArray(data) ? data : []).sort((a: TreeNode, b: TreeNode) => {
        if (a.type === b.type) {
          return a.name.localeCompare(b.name)
        }
        return a.type === 'dir' ? -1 : 1
      })

      setRootNodes(sorted)
      onRefresh?.()
    } catch (err) {
      console.error('Error loading repository contents:', err)
      setError('Failed to load files')
    } finally {
      setIsLoading(false)
      onLoadingChange?.(false)
    }
  }

  useEffect(() => {
    loadRootContents()
  }, [owner, repo, refreshTrigger])

  // Expose refresh function
  useEffect(() => {
    // Store refresh function on window for parent to call
    (window as any).__fileTreeRefresh = () => setRefreshTrigger(prev => prev + 1)
    return () => {
      delete (window as any).__fileTreeRefresh
    }
  }, [])

  if (isLoading) {
    return (
      <div style={{ padding: '1rem', color: '#666', fontSize: '13px' }}>
        Loading files...
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '1rem', color: '#d73a49', fontSize: '13px' }}>
        {error}
      </div>
    )
  }

  if (rootNodes.length === 0) {
    return (
      <div style={{ padding: '1rem', color: '#666', fontSize: '13px' }}>
        No files found
      </div>
    )
  }

  return (
    <div style={{ overflow: 'auto' }}>
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
