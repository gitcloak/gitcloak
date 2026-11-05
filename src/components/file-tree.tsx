'use client'

import { useCallback, useState, useEffect, useRef, type ReactNode } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Ellipsis,
  File as FileIcon,
  FilePlus,
  FolderPlus,
  Lock,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { decryptEntryName, decryptRepoPath, FOLDER_PLACEHOLDER, type FilenameKey } from '@/lib/filenames'
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
  /** Set while the repository is unlocked. A new folder then gets an encrypted name. */
  isUnlocked?: boolean
  onFileSelect?: (path: string, sha: string) => void
  /**
   * Asks the owner to create an entry in the folder the tree shows.
   * `parentPath` is the folder's plaintext path while it is known (the
   * repository is unlocked) and its stored path otherwise; `storedParentPath`
   * is always the stored path, or null for the repository root.
   */
  onCreateEntry?: (
    kind: 'file' | 'folder',
    parentPath: string,
    storedParentPath: string | null
  ) => void
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

/**
 * The placeholder that keeps an empty folder in the repository, in either
 * naming scheme. It is hidden whether the folder is stored under a plain name
 * (a `.gitkeep` file) or an encrypted one — then the decrypted label is
 * `.gitkeep`, or, for a repository from before encrypted names, the stored name
 * is `.gitkeep.age`.
 */
function isFolderPlaceholder(node: TreeNode, label: string): boolean {
  if (node.type !== 'file') return false
  if (label === FOLDER_PLACEHOLDER || node.name === FOLDER_PLACEHOLDER) return true
  return node.name === `${FOLDER_PLACEHOLDER}.age`
}

interface RowActionsProps {
  /** Name of the folder (or repository) the buttons add to, for their tooltips. */
  where: string
  /** Stored path of the folder, or '' for the repository root. */
  path: string
  /** While the repository is unlocked a new folder gets an encrypted name. */
  isUnlocked: boolean
  onAddFile: () => void
  onAddFolder: () => void
}

/**
 * New file and new folder buttons at the end of a tree row. Shown on hover or
 * focus, and always on touch screens where there is no hover. Both are always
 * enabled: an entry created while the repository is locked (or not set up) is
 * stored plainly, which needs no password — only an encrypted name needs it.
 */
function RowActions({
  where,
  path,
  isUnlocked,
  onAddFile,
  onAddFolder,
}: RowActionsProps) {
  return (
    <span
      className="ml-auto flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
      // The buttons sit inside a clickable row; they must not also toggle it.
      onClick={(event) => event.stopPropagation()}
    >
      <Button
        data-testid="tree-new-file-button"
        data-path={path}
        variant="ghost"
        size="icon-xs"
        title={`New file in ${where}`}
        aria-label={`New file in ${where}`}
        onClick={onAddFile}
      >
        <FilePlus className="size-3" />
      </Button>
      <Button
        data-testid="tree-new-folder-button"
        data-path={path}
        variant="ghost"
        size="icon-xs"
        title={isUnlocked ? `New folder in ${where}` : `New plain folder in ${where}`}
        aria-label={`New folder in ${where}`}
        onClick={onAddFolder}
      >
        <FolderPlus className="size-3" />
      </Button>
    </span>
  )
}

export function FileTree({
  owner,
  repo,
  filenameKey = null,
  isUnlocked = false,
  onFileSelect,
  onCreateEntry,
  onRefresh,
  selectedFilePath,
  onLoadingChange,
}: FileTreeProps) {
  const [rootNodes, setRootNodes] = useState<TreeNode[]>([])
  // Loaded folder contents keyed by stored path. The tree keeps them here
  // rather than in each row so it can sort and label everything together.
  const [children, setChildren] = useState<Record<string, TreeNode[]>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  // Read by `loadRootContents` so a refresh keeps the folders that are open.
  const expandedRef = useRef(expanded)
  const [loadingDirs, setLoadingDirs] = useState<Record<string, boolean>>({})
  // Plain names keyed by stored path. Only read while `filenameKey` is set.
  const [labels, setLabels] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  // Stored path of an entry the next load should make visible, set by a refresh
  // that asks for one. Its folders are opened so a file created at a nested
  // path shows up even though every folder above it was collapsed.
  const pendingReveal = useRef<string | null>(null)

  useEffect(() => {
    expandedRef.current = expanded
  }, [expanded])

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
      // Re-read the open folders too, so a refresh after a save leaves the
      // tree as the user had it. A folder that no longer exists closes.
      const reveal = pendingReveal.current
      pendingReveal.current = null
      const openPaths = Object.keys(expandedRef.current).filter(
        (path) => expandedRef.current[path]
      )
      if (reveal) {
        // Every folder above the revealed entry, outermost first.
        const segments = reveal.split('/')
        for (let depth = 1; depth < segments.length; depth++) {
          const folder = segments.slice(0, depth).join('/')
          if (!openPaths.includes(folder)) openPaths.push(folder)
        }
      }
      const [root, openFolders] = await Promise.all([
        fetchEntries(''),
        Promise.all(
          openPaths.map(async (path) => ({
            path,
            entries: await fetchEntries(path).catch(() => null),
          }))
        ),
      ])

      const nextChildren: Record<string, TreeNode[]> = {}
      const nextExpanded: Record<string, boolean> = {}
      for (const { path, entries } of openFolders) {
        if (entries) {
          nextChildren[path] = entries
          nextExpanded[path] = true
        }
      }
      setRootNodes(root)
      setChildren(nextChildren)
      setExpanded(nextExpanded)
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
  const refresh = useCallback((revealPath?: string) => {
    if (revealPath) pendingReveal.current = revealPath
    setRefreshTrigger((prev) => prev + 1)
  }, [])

  useEffect(() => {
    // Store refresh function on window for parent to call
    window.__fileTreeRefresh = refresh
    return () => {
      delete window.__fileTreeRefresh
    }
  }, [refresh])

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

  /**
   * Start a new file or folder inside `node`, or at the root when `node` is
   * null. The folder opens so the new entry shows once it is saved. The stored
   * path always goes along: while the repository is locked the plain path is
   * unknown, and even when it is known a plain file is written where it was
   * clicked rather than into a folder derived from re-encrypting that path.
   */
  const createIn = async (kind: 'file' | 'folder', node: TreeNode | null) => {
    if (!node) {
      onCreateEntry?.(kind, '', null)
      return
    }
    if (!expanded[node.path]) {
      void toggleDirectory(node)
    }
    // A new *encrypted* name is derived from the folder's plain path, which
    // needs the name key.
    const parent = filenameKey ? await decryptRepoPath(node.path, filenameKey, 'dir') : node.path
    onCreateEntry?.(kind, parent, node.path)
  }

  const renderNodes = (nodes: TreeNode[], level: number): ReactNode[] =>
    sortNodes(
      nodes.filter((node) => !isFolderPlaceholder(node, labelOf(node))),
      labelOf
    ).map((node) => {
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
            // The 2px left border is on every row so the labels stay aligned;
            // only its colour changes on the selected row, where it is the
            // accent bar that marks the file open in the editor.
            style={{ paddingLeft: `${level * 12 + 4}px` }}
            className={cn(
              'group flex cursor-pointer items-center gap-1.5 rounded-md border-l-2 border-transparent py-1 pr-2 text-[13px] transition-colors',
              isSelected
                ? // A stronger tint than hover, plus the accent bar, so the open
                  // file reads as selected rather than merely hovered.
                  'border-gc-accent bg-gc-accent/10 font-medium text-sidebar-foreground hover:bg-gc-accent/20'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
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
            {isDir && (
              <RowActions
                where={label}
                path={node.path}
                isUnlocked={isUnlocked}
                onAddFile={() => void createIn('file', node)}
                onAddFolder={() => void createIn('folder', node)}
              />
            )}
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

  // The repository row is always shown, so an empty repository can get its first file.
  return (
    <div className="flex flex-col gap-px">
      <div
        data-testid="tree-root"
        className="group flex items-center gap-1.5 rounded-md py-1 pl-1.5 pr-2 text-[13px] font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <span className="truncate">{repo}</span>
        <RowActions
          where={repo}
          path=""
          isUnlocked={isUnlocked}
          onAddFile={() => void createIn('file', null)}
          onAddFolder={() => void createIn('folder', null)}
        />
      </div>

      {rootNodes.length === 0 ? (
        <div
          data-testid="file-tree-empty"
          className="px-2 py-4 text-[13px] text-muted-foreground"
        >
          No files found
        </div>
      ) : (
        renderNodes(rootNodes, 0)
      )}
    </div>
  )
}
