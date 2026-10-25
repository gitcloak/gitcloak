'use client'

import { Loader2 } from 'lucide-react'

interface LoadingOverlayProps {
  message?: string
}

export function LoadingOverlay({ message = 'Processing...' }: LoadingOverlayProps) {
  return (
    <div
      data-testid="loading-overlay"
      role="status"
      aria-busy="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in"
    >
      <div className="flex flex-col items-center gap-4 rounded-xl bg-background px-12 py-8 text-foreground shadow-lg">
        <Loader2 className="size-10 animate-spin text-gc-success" />
        <p className="text-sm font-medium">{message}</p>
      </div>
    </div>
  )
}
