"use client"

import type { ReactNode } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  /** Text of the confirming button. */
  confirmLabel: string
  /** Optional emblem for the header medallion (see docs/style-guide.md §6.7). */
  icon?: ReactNode
  /** Prefix for the `data-testid` attributes, so automation can drive it. */
  testId?: string
  onConfirm: () => void
}

/**
 * Asks before a destructive action, following the style guide's dialog block
 * (`docs/style-guide.md` §6.7). The guide bans `window.confirm()`, so removing a
 * file asks here instead. The confirming action is styled as destructive *text*
 * (red on the surface), the guide's treatment for a destructive control — never
 * the reserved green primary.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  icon,
  testId = "confirm",
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="gap-0 overflow-hidden rounded-gc-lg border-gc-border p-0 shadow-gc-popover sm:max-w-[26rem]"
        data-testid={`${testId}-dialog`}
      >
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

        <DialogFooter className="flex-row justify-end gap-2 space-x-0 border-t border-gc-border bg-gc-canvas-subtle px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-gc-md border-gc-border bg-gc-surface text-gc-fg shadow-none hover:bg-gc-canvas hover:text-gc-fg"
            data-testid={`${testId}-cancel`}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 rounded-gc-md border-gc-border bg-gc-surface text-gc-danger shadow-none hover:bg-gc-danger-bg hover:text-gc-danger"
            data-testid={`${testId}-submit`}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
