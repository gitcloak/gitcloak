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
import { Input } from "@/components/ui/input"
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
  /**
   * Called with the installation's repositories as GitHub has them right now.
   * The selection can change on GitHub's settings page, which this app
   * otherwise only notices on a full page load; `selectFullName` asks for one
   * of them to be selected.
   */
  onRepositoriesChanged: (
    repositories: Repository[],
    selectFullName?: string
  ) => void
}

/**
 * Parse `owner/repo` out of what the user typed. Accepts a clone URL or a
 * GitHub URL too, because that is what people paste.
 */
function parseFullName(value: string): { owner: string; repo: string } | null {
  const trimmed = value
    .trim()
    .replace(/^https?:\/\/(www\.)?github\.com\//i, "")
    .replace(/\.git$/i, "")
    .replace(/^\/+|\/+$/g, "")

  const parts = trimmed.split("/")
  if (parts.length !== 2) return null

  const [owner, repo] = parts
  if (!owner || !repo) return null
  return { owner, repo }
}

/**
 * Post-install escape hatch: after authorizing GitHub access the user may want
 * to make more repositories available to GitCloak.
 *
 * GitHub will only tell a GitHub App user token about repositories the app
 * already covers, so the enumerated list below is best-effort and often empty.
 * The authoritative path is GitHub's installation settings page (linked), and
 * the name field exists so a user is never stuck when GitHub refuses to
 * enumerate the repository they want.
 */
export function AddRepositoriesDialog({
  open,
  onOpenChange,
  onAdded,
  onRepositoriesChanged,
}: AddRepositoriesDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [installation, setInstallation] = useState<InstallationInfo | null>(
    null
  )
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [addingId, setAddingId] = useState<number | null>(null)
  const [addedIds, setAddedIds] = useState<number[]>([])
  const [manualName, setManualName] = useState("")
  const [addingManual, setAddingManual] = useState(false)
  const [manualAdded, setManualAdded] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false

    setLoading(true)
    setError(null)
    setAddedIds([])
    setAddingId(null)
    setManualName("")
    setManualAdded(null)

    void (async () => {
      // Read the installation from GitHub and re-read the repositories it
      // covers, so a selection changed on GitHub shows up without a reload.
      const refreshed = fetch("/api/repos")
        .then((response) =>
          response.ok
            ? (response.json() as Promise<{ repositories?: Repository[] }>)
            : Promise.reject(new Error("refresh failed"))
        )
        .then((data) => data.repositories ?? [])
        .catch(() => null)

      const available = fetch("/api/repos/available")
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("Could not load repositories from GitHub.")
          }
          return (await response.json()) as RepositoryAccess
        })
        .catch((err: unknown) => {
          if (!cancelled) {
            setError(
              err instanceof Error ? err.message : "Could not load repositories."
            )
          }
          return null
        })

      const [granted, access] = await Promise.all([refreshed, available])

      // The parent owns the repository list: applying a refresh that lands
      // after the dialog closed is useful, not harmful, so it is not gated on
      // the dialog still being open.
      if (granted) onRepositoriesChanged(granted)
      if (cancelled) return

      if (access) {
        setInstallation(access.installation ?? null)
        setRepositories(access.selectable ?? [])
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [open, onRepositoriesChanged])

  /** POST one repository to the installation, returning the API's message. */
  const grant = async (owner: string, repo: string): Promise<void> => {
    const response = await fetch("/api/repos/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ owner, repo }),
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string
      }
      throw new Error(data.error ?? "Failed to add repository.")
    }
  }

  /** Re-read the installation and select the repository just granted. */
  const refreshAndSelect = async (fullName: string) => {
    try {
      const response = await fetch("/api/repos")
      if (!response.ok) return
      const data = (await response.json()) as { repositories?: Repository[] }
      onRepositoriesChanged(data.repositories ?? [], fullName)
    } catch {
      // The repository is granted either way; it appears on the next load.
    }
  }

  const handleAdd = async (repo: Repository) => {
    setAddingId(repo.id)
    setError(null)

    try {
      await grant(repo.owner, repo.name)
      setAddedIds((prev) => (prev.includes(repo.id) ? prev : [...prev, repo.id]))
      onAdded(repo)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add repository.")
    } finally {
      setAddingId(null)
    }
  }

  const handleAddByName = async () => {
    const parsed = parseFullName(manualName)
    if (!parsed) {
      setError("Enter a repository as owner/name, for example octocat/hello-world.")
      return
    }

    setAddingManual(true)
    setError(null)
    setManualAdded(null)

    try {
      await grant(parsed.owner, parsed.repo)
      const fullName = `${parsed.owner}/${parsed.repo}`
      await refreshAndSelect(fullName)
      setManualAdded(fullName)
      setManualName("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add repository.")
    } finally {
      setAddingManual(false)
    }
  }

  const installUrl = appInstallUrl(process.env.NEXT_PUBLIC_GITHUB_APP_NAME)
  const showManageLink = installation !== null
  const selectedInstallation =
    installation?.repositorySelection === "selected"
  const isSelected = !loading && !error && selectedInstallation
  const nothingToAdd = isSelected && repositories.length === 0

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
            isSelected &&
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
              GitHub is not showing GitCloak any repository left to add — it
              only reveals repositories the app already covers. Grant one in
              GitHub&apos;s installation settings (link below); it appears in
              the repository dropdown as soon as you grant it.
            </p>
          )}

          {selectedInstallation && (
            <div className="grid gap-2 border-t border-gc-border pt-3">
              <label
                htmlFor="add-repo-manual"
                className="text-xs font-medium text-gc-fg"
              >
                Add a repository by name
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id="add-repo-manual"
                  data-testid="add-repo-manual-input"
                  value={manualName}
                  onChange={(event) => setManualName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void handleAddByName()
                  }}
                  placeholder="owner/repository"
                  autoComplete="off"
                  spellCheck={false}
                  disabled={addingManual}
                  className="h-8 flex-1 text-sm"
                />
                <Button
                  data-testid="add-repo-manual-submit"
                  onClick={() => void handleAddByName()}
                  disabled={addingManual || manualName.trim().length === 0}
                  variant="outline"
                  size="sm"
                >
                  {addingManual ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Plus className="size-3.5" />
                  )}
                  Add
                </Button>
              </div>
              <p className="text-xs leading-relaxed text-gc-fg-muted">
                Use this when GitHub will not list the repository — for example
                one you created after installing GitCloak.
              </p>
              {manualAdded && (
                <p
                  data-testid="add-repositories-manual-added"
                  className="text-xs leading-relaxed text-gc-success-fg"
                >
                  Added {manualAdded}.
                </p>
              )}
            </div>
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
