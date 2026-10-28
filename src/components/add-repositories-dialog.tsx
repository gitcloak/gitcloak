"use client"

import { useEffect, useState } from "react"
import { ExternalLink, FolderPlus, Loader2, Plus } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { appInstallUrl } from "@/lib/github-urls"

/** The subset of a repository this dialog needs to add it. */
interface Repository {
  id: number
  name: string
  fullName: string
  owner: string
  private: boolean
  description: string | null
  updatedAt: string
}

interface InstallationInfo {
  id: number
  accountLogin: string
  accountType: string
  repositorySelection: "all" | "selected"
  manageUrl: string
}

interface RepositoryAccess {
  installation: InstallationInfo | null
  selectable: Repository[]
}

interface AddRepositoriesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with the newly granted repository, so the app can show it. */
  onAdded: (repo: Repository) => void
}

/**
 * Post-install escape hatch: after authorizing GitHub access the user may want
 * to make more repositories available to GitCloak. This dialog lists what can
 * be added and grants access one repository at a time
 * (`PUT /user/installations/{id}/repositories/{repo_id}`), falling back to
 * GitHub's own installation settings page for anything the app cannot see.
 */
export function AddRepositoriesDialog({
  open,
  onOpenChange,
  onAdded,
}: AddRepositoriesDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [installation, setInstallation] = useState<InstallationInfo | null>(null)
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [addingId, setAddingId] = useState<number | null>(null)
  const [addedIds, setAddedIds] = useState<number[]>([])

  useEffect(() => {
    if (!open) return
    let cancelled = false

    setLoading(true)
    setError(null)
    setAddedIds([])
    setAddingId(null)

    void (async () => {
      try {
        const response = await fetch("/api/repos/available")
        if (!response.ok) {
          throw new Error("Could not load repositories from GitHub.")
        }
        const data = (await response.json()) as RepositoryAccess
        if (cancelled) return
        setInstallation(data.installation ?? null)
        setRepositories(data.selectable ?? [])
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load repositories."
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open])

  const handleAdd = async (repo: Repository) => {
    setAddingId(repo.id)
    setError(null)

    try {
      const response = await fetch("/api/repos/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ owner: repo.owner, repo: repo.name }),
      })
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string
        }
        throw new Error(data.error ?? "Failed to add repository.")
      }
      setAddedIds((prev) =>
        prev.includes(repo.id) ? prev : [...prev, repo.id]
      )
      onAdded(repo)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add repository.")
    } finally {
      setAddingId(null)
    }
  }

  const installUrl = appInstallUrl(process.env.NEXT_PUBLIC_GITHUB_APP_NAME)
  const showManageLink = installation !== null
  const nothingToAdd =
    !loading && !error && installation !== null && repositories.length === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-gc-lg border-gc-border p-0 shadow-gc-popover sm:max-w-[28rem]"
        data-testid="add-repositories-dialog"
      >
        <DialogHeader className="flex-row items-start gap-3 space-y-0 px-6 pt-6 pr-12 text-left">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-gc-md border border-gc-border bg-gc-canvas text-gc-fg-muted"
          >
            <FolderPlus className="size-4" />
          </span>
          <div className="space-y-1.5">
            <DialogTitle
              className="text-base font-semibold leading-tight tracking-tight text-gc-fg"
              data-testid="add-repositories-title"
            >
              Add Repositories
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-gc-fg-muted">
              Give GitCloak access to more of your GitHub repositories.
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="grid gap-3 px-6 py-5">
          {loading && (
            <p
              data-testid="add-repositories-loading"
              className="flex items-center gap-2 text-sm text-gc-fg-muted"
            >
              <Loader2 className="size-4 animate-spin" />
              Loading repositories…
            </p>
          )}

          {error && (
            <p
              data-testid="add-repositories-error"
              role="alert"
              className="rounded-gc-md border border-gc-danger/40 bg-gc-danger-bg px-3 py-2 text-sm text-gc-danger-fg"
            >
              {error}
            </p>
          )}

          {!loading && !error && installation === null && (
            <p
              data-testid="add-repositories-empty"
              className="text-sm leading-relaxed text-gc-fg-muted"
            >
              GitCloak is not installed on your GitHub account yet.
              {installUrl && (
                <>
                  {" "}
                  <a
                    href={installUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-gc-fg underline underline-offset-4"
                  >
                    Install the app
                  </a>{" "}
                  and choose the repositories to make available.
                </>
              )}
            </p>
          )}

          {!loading &&
            !error &&
            installation?.repositorySelection === "all" && (
              <p
                data-testid="add-repositories-empty"
                className="text-sm leading-relaxed text-gc-fg-muted"
              >
                GitCloak already has access to every repository on this account.
              </p>
            )}

          {!loading &&
            !error &&
            installation?.repositorySelection === "selected" &&
            repositories.length > 0 && (
              <ul
                data-testid="add-repositories-list"
                className="grid max-h-[18rem] gap-2 overflow-y-auto"
              >
                {repositories.map((repo) => {
                  const added = addedIds.includes(repo.id)
                  return (
                    <li
                      key={repo.id}
                      data-testid="add-repo-option"
                      data-repo={repo.fullName}
                      className="flex items-center gap-3 rounded-gc-md border border-gc-border bg-gc-surface px-3 py-2"
                    >
                      <div className="grid min-w-0 flex-1 gap-0.5">
                        <span className="truncate text-sm font-medium text-gc-fg">
                          {repo.fullName}
                        </span>
                        <span className="flex items-center gap-1.5 text-xs text-gc-fg-muted">
                          <Badge
                            variant="outline"
                            className="px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide text-gc-fg-muted"
                          >
                            {repo.private ? "Private" : "Public"}
                          </Badge>
                          {repo.description && (
                            <span className="truncate">{repo.description}</span>
                          )}
                        </span>
                      </div>
                      {added ? (
                        <Badge
                          variant="outline"
                          data-testid="add-repo-added"
                          className="gap-1 border-gc-success/40 bg-gc-success-bg px-2 py-0 text-[11px] font-semibold text-gc-success-fg"
                        >
                          Added
                        </Badge>
                      ) : (
                        <Button
                          data-testid="add-repo-confirm"
                          data-repo={repo.fullName}
                          onClick={() => void handleAdd(repo)}
                          disabled={addingId !== null}
                          variant="outline"
                          size="sm"
                        >
                          {addingId === repo.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Plus className="size-3.5" />
                          )}
                          Add
                        </Button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

          {nothingToAdd && (
            <p
              data-testid="add-repositories-empty"
              className="text-sm leading-relaxed text-gc-fg-muted"
            >
              There are no repositories left to add right now. Manage repository
              access on GitHub to grant more.
            </p>
          )}

          {showManageLink && (
            <p className="text-xs leading-relaxed text-gc-fg-muted">
              Can&apos;t find a repository?{" "}
              <a
                data-testid="add-repositories-manage-link"
                href={installation.manageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-gc-fg underline underline-offset-4 hover:text-gc-brand"
              >
                Manage repository access on GitHub
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            </p>
          )}
        </div>

        <DialogFooter className="border-t border-gc-border bg-gc-canvas px-6 py-4">
          <Button
            data-testid="add-repositories-done"
            onClick={() => onOpenChange(false)}
            variant="outline"
            size="sm"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
