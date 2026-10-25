'use client'

import { useEffect } from 'react'
import { FiAlertCircle, FiCheckCircle, FiInfo, FiX } from 'react-icons/fi'

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
  { background: string; border: string; color: string; icon: React.ReactNode }
> = {
  success: {
    background: '#dafbe1',
    border: '#2ea44f',
    color: '#1a7f37',
    icon: <FiCheckCircle size={18} />,
  },
  error: {
    background: '#ffebe9',
    border: '#cf222e',
    color: '#cf222e',
    icon: <FiAlertCircle size={18} />,
  },
  info: {
    background: '#ddf4ff',
    border: '#0969da',
    color: '#0969da',
    icon: <FiInfo size={18} />,
  },
}

/**
 * Small, non-blocking, HTML rendered notification used instead of native
 * browser alert() dialogs. Announced politely to assistive technology and
 * auto-dismissed after `duration` ms.
 */
export function NoticeToast({ notice, onDismiss, duration = 5000 }: NoticeToastProps) {
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(onDismiss, duration)
    return () => clearTimeout(timer)
  }, [notice, onDismiss, duration])

  if (!notice) return null

  const styles = NOTICE_STYLES[notice.type]

  return (
    <div
      data-testid="notice"
      data-notice-type={notice.type}
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: '1rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        gap: '0.625rem',
        maxWidth: 'min(560px, calc(100vw - 2rem))',
        padding: '0.75rem 1rem',
        borderRadius: '8px',
        background: styles.background,
        border: `1px solid ${styles.border}`,
        color: styles.color,
        fontSize: '0.875rem',
        fontWeight: 500,
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.12)',
      }}
    >
      <span style={{ display: 'flex', flexShrink: 0 }}>{styles.icon}</span>
      <span style={{ flex: 1 }}>{notice.message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss notification"
        style={{
          border: 'none',
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
          display: 'flex',
          padding: 0,
          opacity: 0.7,
        }}
      >
        <FiX size={16} />
      </button>
    </div>
  )
}
