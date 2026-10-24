"use client"

import { useState, useEffect, type ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { PasswordInput } from "@/components/password-input"

interface PasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** Label for the submit button. */
  submitLabel?: string
  /**
   * Legacy alias for submitLabel kept for backwards compatibility with earlier
   * call sites.
   */
  confirmLabel?: string
  requireConfirmation?: boolean
  /**
   * Prefix used for stable `data-testid` attributes so the flow can be driven
   * by browser automation.
   */
  testId?: string
  /**
   * Optional icon rendered in the dialog-header medallion
   * (see `docs/style-guide.md` → Dialog).
   */
  icon?: ReactNode
  onSubmit: (password: string) => void | Promise<void>
}

/**
 * Shared password dialog used for unlock, decrypt, set-password and
 * save-password flows. The layout follows the GitCloak style guide
 * (`docs/style-guide.md`): a header medallion + title + description, a body
 * with labelled fields, an optional inline alert, and a tinted footer with the
 * cancel / confirm actions.
 */
export function PasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  confirmLabel,
  requireConfirmation = false,
  testId = "password-dialog",
  icon,
  onSubmit,
}: PasswordDialogProps) {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const actionLabel = submitLabel ?? confirmLabel ?? "Submit"

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!open) {
      setPassword("")
      setConfirmPassword("")
      setError("")
      setIsLoading(false)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!password) {
      setError("Password is required")
      return
    }

    if (requireConfirmation && password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)
    try {
      await onSubmit(password)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 rounded-none border-gc-border p-0 shadow-gc-popover sm:max-w-[26rem] sm:rounded-gc-lg"
        data-testid={`${testId}-dialog`}
        onOpenAutoFocus={(event) => {
          // Let the password input keep focus instead of the close button.
          event.preventDefault()
        }}
      >
        <form onSubmit={handleSubmit} className="flex flex-col">
          {/* Dialog header: optional medallion + title + description. */}
          <DialogHeader className="flex-row items-start gap-3 space-y-0 px-6 pt-6 pr-12 text-left">
            {icon && (
              <span
                data-testid={`${testId}-icon`}
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-gc-md border border-gc-border bg-gc-canvas text-gc-fg-muted"
              >
                {icon}
              </span>
            )}
            <div className="space-y-1.5">
              <DialogTitle
                className="text-base font-semibold leading-tight tracking-tight text-gc-fg"
                data-testid={`${testId}-title`}
              >
                {title}
              </DialogTitle>
              <DialogDescription
                className="text-sm leading-relaxed text-gc-fg-muted"
                data-testid={`${testId}-description`}
              >
                {description}
              </DialogDescription>
            </div>
          </DialogHeader>

          {/* Dialog body: labelled fields + inline alert. */}
          <div className="grid gap-4 px-6 py-5">
            <div className="grid gap-1.5">
              <Label
                htmlFor={`${testId}-password`}
                className="text-xs font-semibold uppercase tracking-wide text-gc-fg-muted"
              >
                Password
              </Label>
              <PasswordInput
                id={`${testId}-password`}
                name="encryption-password"
                data-testid={`${testId}-input`}
                className="h-9 rounded-gc-md border-gc-border bg-gc-surface text-gc-fg placeholder:text-gc-fg-subtle"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError("")
                }}
                placeholder="Enter password"
                autoFocus
                disabled={isLoading}
              />
            </div>
            {requireConfirmation && (
              <div className="grid gap-1.5">
                <Label
                  htmlFor={`${testId}-confirm-password`}
                  className="text-xs font-semibold uppercase tracking-wide text-gc-fg-muted"
                >
                  Confirm Password
                </Label>
                <PasswordInput
                  id={`${testId}-confirm-password`}
                  name="confirm-encryption-password"
                  data-testid={`${testId}-confirm-input`}
                  className="h-9 rounded-gc-md border-gc-border bg-gc-surface text-gc-fg placeholder:text-gc-fg-subtle"
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (error) setError("")
                  }}
                  placeholder="Confirm password"
                  disabled={isLoading}
                />
              </div>
            )}
            {error && (
              <div
                className="rounded-gc-md border border-gc-danger/30 bg-gc-danger-bg px-3 py-2 text-sm font-medium text-gc-danger-fg"
                data-testid={`${testId}-error`}
                role="alert"
              >
                {error}
              </div>
            )}
          </div>

          {/* Dialog footer: tinted bar with secondary + primary actions. */}
          <DialogFooter className="flex-row justify-end gap-2 space-x-0 border-t border-gc-border bg-gc-canvas-subtle px-6 py-4">
            <Button
              type="button"
              variant="outline"
              className="h-9 rounded-gc-md border-gc-border bg-gc-surface text-gc-fg shadow-none hover:bg-gc-canvas hover:text-gc-fg"
              data-testid={`${testId}-cancel`}
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="h-9 rounded-gc-md bg-gc-success text-white shadow-none hover:bg-gc-success-hover"
              data-testid={`${testId}-submit`}
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : actionLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
