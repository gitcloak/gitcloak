"use client"

import { useState, useEffect } from "react"
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
  onSubmit: (password: string) => void | Promise<void>
}

export function PasswordDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  confirmLabel,
  requireConfirmation = false,
  testId = "password-dialog",
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
        className="sm:max-w-[425px]"
        data-testid={`${testId}-dialog`}
        onOpenAutoFocus={(event) => {
          // Let the password input keep focus instead of the close button.
          event.preventDefault()
        }}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle data-testid={`${testId}-title`}>{title}</DialogTitle>
            <DialogDescription data-testid={`${testId}-description`}>
              {description}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor={`${testId}-password`}>Password</Label>
              <PasswordInput
                id={`${testId}-password`}
                name="encryption-password"
                data-testid={`${testId}-input`}
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
              <div className="grid gap-2">
                <Label htmlFor={`${testId}-confirm-password`}>
                  Confirm Password
                </Label>
                <PasswordInput
                  id={`${testId}-confirm-password`}
                  name="confirm-encryption-password"
                  data-testid={`${testId}-confirm-input`}
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
                className="text-sm text-destructive"
                data-testid={`${testId}-error`}
                role="alert"
              >
                {error}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              data-testid={`${testId}-cancel`}
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
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
