'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { signOut } from 'next-auth/react'
import {
  AlertCircle,
  Check,
  ChevronsUpDown,
  Lock,
  LockOpen,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

import { FileTree } from './file-tree'

/** Visual state of the selected repository's lock. */
export type RepoStatus = 'checking' | 'uninitialized' | 'locked' | 'unlocked'

const REPO_STATUS_META: Record<
  RepoStatus,
  { label: string; icon: ReactNode; className: string }
> = {
  checking: {
    label: 'Checking…',
    icon: <RefreshCw className="size-3 animate-spin" />,
    className: 'border-gc-border bg-gc-canvas text-gc-fg-muted',
  },
  uninitialized: {
    label: 'Not set up',
    icon: <AlertCircle className="size-3" />,
    className: 'border-gc-warning/40 bg-gc-warning-bg text-gc-warning-fg',
  },
  locked: {
    label: 'Locked',
    icon: <Lock className="size-3" />,
    className: 'border-gc-border bg-gc-canvas text-gc-fg-muted',
  },
  unlocked: {
    label: 'Unlocked',
    icon: <LockOpen className="size-3" />,
    className: 'border-gc-success/40 bg-gc-success-bg text-gc-success-fg',
  },
}

function RepoStatusBadge({ status }: { status: RepoStatus }) {
  const meta = REPO_STATUS_META[status]
  return (
    <Badge
      data-testid="repo-lock-status"
      data-repo-status={status}
      aria-live="polite"
      variant="outline"
      className={cn('gap-1 px-2 py-0 text-[11px] font-semibold', meta.className)}
    >
      {meta.icon}
      {meta.label}
    </Badge>
  )
}

interface Repository {
  id: number
  name: string
  fullName: string
  owner: string
  private: boolean
  description: string | null
  updatedAt: string
}

interface AppSidebarProps {
  repositories: Repository[]
  userName: string
  userImage?: string
  userEmail?: string
  onFileSelect?: (owner: string, repo: string, path: string, sha: string) => void
  onNewFile?: () => void
  onRepoChange?: (repo: Repository | null) => void
  onUnlockRepo?: () => void
  onLockRepo?: () => void
  onOpenSettings?: () => void
  repoStatus?: RepoStatus
  selectedFilePath?: string
}

export function AppSidebar({
  repositories,
  userName,
  userImage,
  userEmail,
  onFileSelect,
  onNewFile,
  onRepoChange,
  onUnlockRepo,
  onLockRepo,
  onOpenSettings,
  repoStatus = 'checking',
  selectedFilePath,
}: AppSidebarProps) {
  const isRepoUnlocked = repoStatus === 'unlocked'
  const { isMobile, setOpenMobile } = useSidebar()
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(
    repositories.length > 0 ? repositories[0] : null
  )
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)

  const handleRepoChange = (repo: Repository) => {
    setSelectedRepo(repo)
    onRepoChange?.(repo)
  }

  const handleOpenSettings = () => {
    // On mobile the sidebar is a sheet; close it so the dialog is not stacked
    // on top of it.
    if (isMobile) setOpenMobile(false)
    onOpenSettings?.()
  }

  const handleRefresh = () => {
    window.__fileTreeRefresh?.()
  }

  // Stable identity: `FileTree` re-runs its load effect when this changes.
  const handleLoadingChange = useCallback((isLoading: boolean) => {
    setIsRefreshing(isLoading)
  }, [])

  const handleSignOut = async () => {
    if (isSigningOut) return

    setIsSigningOut(true)

    try {
      // Call API to revoke GitHub App authorization
      await fetch('/api/auth/signout', {
        method: 'POST',
      })
    } catch (error) {
      console.error('Error revoking authorization:', error)
    }

    // Sign out regardless of API call result
    await signOut({ callbackUrl: '/', redirect: true })
  }

  const initials = userName.slice(0, 2).toUpperCase()

  return (
    <Sidebar collapsible="offcanvas">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="size-4" />
          </span>
          <span className="flex-1 truncate bg-gradient-to-br from-indigo-500 to-purple-600 bg-clip-text text-base font-bold text-transparent">
            GitCloak
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Repository selector + lock control. */}
        <SidebarGroup className="shrink-0">
          <div className="mb-2 flex items-center justify-between gap-2">
            <SidebarGroupLabel asChild>
              <span className="h-auto px-0">Repository</span>
            </SidebarGroupLabel>
            {selectedRepo && <RepoStatusBadge status={repoStatus} />}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                data-testid="repo-selector"
                data-repo={selectedRepo ? selectedRepo.fullName : ''}
                data-repo-status={repoStatus}
                variant="outline"
                className="w-full justify-between font-normal"
              >
                <span className="truncate">
                  {selectedRepo ? selectedRepo.fullName : 'Select repository'}
                </span>
                <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            >
              <DropdownMenuLabel>Repositories</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {repositories.map((repo) => (
                <DropdownMenuItem
                  key={repo.id}
                  data-testid="repo-option"
                  data-repo={repo.fullName}
                  data-selected={selectedRepo?.id === repo.id}
                  onSelect={() => handleRepoChange(repo)}
                >
                  <Check
                    className={cn(
                      'size-4 shrink-0',
                      selectedRepo?.id === repo.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{repo.fullName}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {selectedRepo && (
            <Button
              data-testid="repo-lock-toggle"
              data-repo-status={repoStatus}
              onClick={isRepoUnlocked ? onLockRepo : onUnlockRepo}
              disabled={repoStatus === 'checking'}
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              title={
                isRepoUnlocked
                  ? 'Lock repository (clear password from memory)'
                  : 'Unlock repository (enter password)'
              }
            >
              {isRepoUnlocked ? (
                <LockOpen className="size-4" />
              ) : (
                <Lock className="size-4" />
              )}
              {isRepoUnlocked ? 'Lock repository' : 'Unlock repository'}
            </Button>
          )}
        </SidebarGroup>

        <SidebarSeparator />

        {/* File navigator. */}
        <SidebarGroup className="flex min-h-0 flex-1 flex-col">
          <SidebarGroupLabel className="justify-between gap-1 pr-1">
            <span>Files</span>
            {selectedRepo && (
              <span className="flex items-center gap-1">
                <Button
                  data-testid="refresh-files-button"
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  variant="ghost"
                  size="icon-xs"
                  title="Refresh file list"
                >
                  <RefreshCw
                    className={cn('size-3.5', isRefreshing && 'animate-spin')}
                  />
                </Button>
                <Button
                  data-testid="new-file-button"
                  onClick={onNewFile}
                  variant="ghost"
                  size="xs"
                  title="Create new file"
                >
                  <Plus className="size-3.5" />
                  New
                </Button>
              </span>
            )}
          </SidebarGroupLabel>

          <SidebarGroupContent className="min-h-0 flex-1 overflow-y-auto">
            {selectedRepo ? (
              <FileTree
                owner={selectedRepo.owner}
                repo={selectedRepo.name}
                onFileSelect={(path, sha) => {
                  onFileSelect?.(selectedRepo.owner, selectedRepo.name, path, sha)
                }}
                selectedFilePath={selectedFilePath}
                onLoadingChange={handleLoadingChange}
              />
            ) : (
              <p className="px-2 py-4 text-center text-sm text-gc-fg-subtle italic">
                Select a repository to view files
              </p>
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-2 px-1">
          <Avatar className="size-8">
            {userImage && <AvatarImage src={userImage} alt={userName} />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
          <div className="grid min-w-0 flex-1 leading-tight">
            <span
              data-testid="user-name"
              className="truncate text-sm font-medium"
            >
              {userName}
            </span>
            {userEmail && (
              <span
                data-testid="user-email"
                className="truncate text-xs text-sidebar-foreground/70"
              >
                {userEmail}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            data-testid="settings-button"
            onClick={handleOpenSettings}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <Settings className="size-3.5" />
            Settings
          </Button>
          <Button
            data-testid="signout-button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            <LogOut className="size-3.5" />
            {isSigningOut ? 'Signing out…' : 'Sign Out'}
          </Button>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
