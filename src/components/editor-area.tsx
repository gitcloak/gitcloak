'use client'

import { useCallback, useEffect, useState } from 'react'
import { Clock, PenLine, Save } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

/** Idle time after the last keystroke before an autosave runs. */
const AUTOSAVE_DELAY_MS = 1500

interface SelectedFile {
  path: string
  content: string
  sha: string
  owner: string
  repo: string
  isNew?: boolean
  /** Changes whenever a different file is opened, so the editor can reset. */
  openId: number
}

interface EditorAreaProps {
  selectedFile: SelectedFile | null
  isLoading: boolean
  /** Save automatically after the user stops typing. */
  autosave: boolean
  /**
   * Whether a save can complete without asking for a password (the file's
   * repository is unlocked). Autosave never opens a password dialog.
   */
  canAutosave: boolean
  onSave: (content: string) => Promise<void>
}

export function EditorArea({
  selectedFile,
  isLoading,
  autosave,
  canAutosave,
  onSave,
}: EditorAreaProps) {
  // The parent keys this component by `openId`, so each opened file starts
  // with fresh state. Saving does not remount the editor, which keeps text the
  // user types while a save is in flight.
  const [content, setContent] = useState(selectedFile?.content ?? '')
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedContent, setSavedContent] = useState(selectedFile?.content ?? '')
  // Set when an autosave fails. Autosave waits for the next edit before trying
  // again, instead of retrying and showing an error every few seconds.
  const [autosaveFailed, setAutosaveFailed] = useState(false)

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    setHasChanges(newContent !== savedContent)
    setAutosaveFailed(false)
  }

  const handleSave = useCallback(
    async (source: 'manual' | 'autosave' = 'manual') => {
      // Take a snapshot of the content to save
      const contentToSave = content
      const previousSaved = savedContent
      setSavedContent(contentToSave)
      setHasChanges(false)
      setAutosaveFailed(false)
      setIsSaving(true)

      // Save in background
      try {
        await onSave(contentToSave)
      } catch {
        // The snapshot never reached GitHub, so keep the last saved baseline
        // and treat the edit as still unsaved.
        setSavedContent(previousSaved)
        setHasChanges(contentToSave !== previousSaved)
        setAutosaveFailed(source === 'autosave')
      } finally {
        setIsSaving(false)
      }
    },
    [content, onSave, savedContent]
  )

  const hasFile = Boolean(selectedFile)

  // Debounced autosave: every keystroke changes `handleSave`, which restarts
  // the timer, so the save runs once the user pauses.
  useEffect(() => {
    if (
      !autosave ||
      !canAutosave ||
      !hasFile ||
      !hasChanges ||
      isSaving ||
      isLoading ||
      autosaveFailed
    ) {
      return
    }
    const timer = window.setTimeout(() => {
      void handleSave('autosave')
    }, AUTOSAVE_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [
    autosave,
    canAutosave,
    hasFile,
    hasChanges,
    isSaving,
    isLoading,
    autosaveFailed,
    handleSave,
  ])

  const canSave = Boolean(selectedFile) && hasChanges && !isSaving

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-gc-surface">
      {/* Editor header. Wraps on narrow viewports; the sidebar trigger is the
          only way to reach the file tree below `md`. */}
      <header className="flex items-center gap-2 border-b border-gc-border bg-gc-canvas-subtle px-2 py-2 sm:gap-3 sm:px-5 sm:py-3">
        <SidebarTrigger className="shrink-0" />
        <Separator
          orientation="vertical"
          className="hidden h-6 bg-gc-border sm:block"
        />

        <div className="min-w-0 flex-1">
          <div
            data-testid="editor-repo"
            className="truncate text-xs text-gc-fg-muted"
          >
            {selectedFile
              ? `${selectedFile.owner}/${selectedFile.repo}`
              : 'No file selected'}
          </div>
          <div
            data-testid="editor-title"
            className="flex min-w-0 items-center gap-2 text-base font-semibold text-gc-fg sm:text-lg"
          >
            {selectedFile ? (
              <>
                <span data-testid="selected-file-path" className="truncate">
                  {selectedFile.path}
                </span>
                {selectedFile.isNew && (
                  <span className="shrink-0 rounded-gc-sm bg-gc-success-bg px-2 py-0.5 text-xs font-medium text-gc-success-fg">
                    New
                  </span>
                )}
              </>
            ) : (
              <span className="truncate">Welcome to GitCloak</span>
            )}
          </div>
        </div>

        <Button
          data-testid="save-button"
          data-state={
            !selectedFile ? 'empty' : hasChanges ? 'dirty' : 'clean'
          }
          onClick={() => void handleSave()}
          disabled={!canSave}
          variant={canSave ? 'default' : 'outline'}
          size="sm"
          className={cn(
            'shrink-0',
            canSave &&
              'bg-gc-success text-white hover:bg-gc-success-hover disabled:opacity-100'
          )}
        >
          <Save className={cn('size-4', isSaving && 'animate-pulse')} />
          <span className="hidden sm:inline">
            {isSaving ? 'Saving…' : hasChanges ? 'Save Changes' : 'Save'}
          </span>
          <span className="sm:hidden">Save</span>
        </Button>
      </header>

      {/* Editor pane. */}
      <div className="flex min-h-0 flex-1">
        {isLoading ? (
          <div className="flex flex-1 items-center justify-center p-8 text-gc-fg-subtle">
            <div className="text-center">
              <Clock className="mx-auto mb-4 size-10" />
              <p className="text-sm">Loading file…</p>
            </div>
          </div>
        ) : selectedFile ? (
          <textarea
            data-testid="editor-input"
            value={content}
            onChange={(e) => handleContentChange(e.target.value)}
            spellCheck={false}
            className="min-h-0 flex-1 resize-none border-0 bg-gc-surface p-4 font-mono text-[13px] leading-relaxed text-gc-fg outline-none sm:p-6 sm:text-sm"
          />
        ) : (
          <div
            data-testid="editor-empty"
            className="flex flex-1 items-center justify-center p-8"
          >
            <div className="max-w-sm text-center text-gc-fg-subtle">
              <PenLine className="mx-auto mb-4 size-10" />
              <p className="mb-2 text-sm text-gc-fg">
                Select a file to start editing
              </p>
              <p className="text-xs">
                Your files will be encrypted with age format before saving
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Status bar. */}
      <footer className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-gc-border bg-gc-canvas px-3 py-1.5 text-xs text-gc-fg-muted">
        <div
          data-testid="editor-status"
          data-status={
            isSaving
              ? 'saving'
              : hasChanges
                ? 'modified'
                : selectedFile
                  ? 'saved'
                  : 'ready'
          }
        >
          {isSaving
            ? '● Saving…'
            : hasChanges
              ? '● Modified'
              : selectedFile
                ? '● Saved'
                : 'Ready'}
        </div>
        <div className="flex items-center gap-4">
          {autosave && selectedFile && (
            <div
              data-testid="autosave-status"
              data-state={canAutosave ? 'on' : 'paused'}
              className="whitespace-nowrap"
            >
              {canAutosave ? 'Autosave on' : 'Autosave paused · unlock to resume'}
            </div>
          )}
          <div data-testid="editor-stats" className="tabular-nums">
            {selectedFile
              ? `${content.split('\n').length} lines | ${content.length} chars`
              : 'UTF-8'}
          </div>
          <a
            href="https://github.com/gitcloak/gitcloak"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-gc-accent transition-opacity hover:opacity-70"
          >
            Contribute
          </a>
        </div>
      </footer>
    </div>
  )
}
