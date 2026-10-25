'use client'

import { useEffect } from 'react'
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface Notice {
  id: string
  type: 'success' | 'error' | 'info'
  message: string
}

interface NoticeToastProps {
  notice: Notice | null
  onDismiss: () => void
  /** Auto-dismiss delay in milliseconds. */
  duration?: number
}

const NOTICE_STYLES: Record<
  Notice['type'],
  { className: string; icon: React.ReactNode }
> = {
  success: {
    className: 'border-gc-success/40 bg-gc-success-bg text-gc-success-fg',
    icon: <CircleCheck className="size-[18px]" />,
  },
  error: {
    className: 'border-gc-danger/40 bg-gc-danger-bg text-gc-danger-fg',
    icon: <CircleAlert className="size-[18px]" />,
  },
  info: {
    className: 'border-gc-accent/40 bg-gc-accent/10 text-gc-accent',
    icon: <Info className="size-[18px]" />,
  },
}

/**
 * Small, non-blocking, HTML rendered notification used instead of native
 * browser alert() dialogs. Announced politely to assistive technology and
 * auto-dismissed after `duration` ms.
 *
 * Deliberately not `sonner`: the flow is driven by tests through a stable
 * `data-testid="notice"` + `data-notice-type` contract, which sonner's portal
 * does not expose. It is styled with the same tokens as the rest of the shell.
 */
export function NoticeToast({
  notice,
  onDismiss,
  duration = 5000,
}: NoticeToastProps) {
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  }, [notice, onDismiss, duration])

  if (!notice) return null

  const styles = NOTICE_STYLES[notice.type]

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-100 flex justify-center px-4">
      <div
        data-testid="notice"
        data-notice-type={notice.type}
        role="status"
        aria-live="polite"
        className={cn(
          'pointer-events-auto flex max-w-xl items-center gap-2.5 rounded-gc-lg border px-4 py-3 text-sm font-medium shadow-gc-popover',
          'animate-in fade-in slide-in-from-top-2',
          styles.className
        )}
      >
        <span className="flex shrink-0">{styles.icon}</span>
        <span className="flex-1">{notice.message}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="flex cursor-pointer opacity-70 transition-opacity hover:opacity-100"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
