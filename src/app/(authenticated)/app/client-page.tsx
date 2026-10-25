'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, KeyRound, Lock, ShieldCheck } from 'lucide-react'
import { AppSidebar, type RepoStatus } from '@/components/app-sidebar'
import { EditorArea } from '@/components/editor-area'
import { LoadingOverlay } from '@/components/loading-overlay'
import { PasswordDialog } from '@/components/password-dialog'
import { InputDialog } from '@/components/input-dialog'
import { NoticeToast, type Notice } from '@/components/notice-toast'
import { SettingsDialog } from '@/components/settings-dialog'
import { SidebarInset } from '@/components/ui/sidebar'
import { useAutosave } from '@/hooks/use-autosave'

interface Repository {
  id: number
  name: string
  fullName: string
  owner: string
  private: boolean
  description: string | null
  updatedAt: string
}

interface SelectedFile {
  path: string
  content: string
  sha: string // Empty string for new files
  owner: string
  repo: string
  isNew?: boolean // Flag to indicate this is a new file not yet saved
  openId: number // Unique per opened file; keys the editor so it resets on open
}

// Source of `SelectedFile.openId`. Module scope is fine: this is client state
// and only needs to be unique within the page session.
let lastOpenId = 0
function nextOpenId(): number {
  lastOpenId += 1
  return lastOpenId
}

interface ClientPageProps {
  repositories: Repository[]
  userName: string
  userImage?: string
  userEmail?: string
}

/**
 * A file the user is trying to open. `content` is the raw (still encrypted)
 * text and is only populated when the file download already happened.
 */
interface PendingFile {
  owner: string
  repo: string
  path: string
  sha: string
  content?: string
}

type DecryptTarget = PendingFile & { content: string }

interface PasswordDialogState {
  open: boolean
  title: string
  description: string
  submitLabel: string
  requireConfirmation: boolean
  testId: string
  icon?: ReactNode
  onSubmit: (password: string) => void | Promise<void>
}

const CLOSED_PASSWORD_DIALOG: PasswordDialogState = {
  open: false,
  title: '',
  description: '',
  submitLabel: 'Submit',
  requireConfirmation: false,
  testId: 'password-dialog',
  onSubmit: () => {},
}

export function ClientPage({ repositories, userName, userImage, userEmail }: ClientPageProps) {
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Processing...')
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(
    repositories.length > 0 ? repositories[0] : null
  )
  // Store the repository password in memory (per repository)
  const [repoPasswords, setRepoPasswords] = useState<Record<string, string>>({})
  // Per-file password overrides used when a file is encrypted with a password
  // different from the repository password.
  const [filePasswords, setFilePasswords] = useState<Record<string, string>>({})
  // Whether a repository has a `.gitcloak` file: undefined = not checked yet.
  const [repoInitialized, setRepoInitialized] = useState<Record<string, boolean | 'checking'>>({})

  const [notice, setNotice] = useState<Notice | null>(null)

  // Password dialog state (unlock / decrypt / set password / save password)
  const [passwordDialog, setPasswordDialog] = useState<PasswordDialogState>(CLOSED_PASSWORD_DIALOG)

  // File name input dialog state
  const [fileNameDialog, setFileNameDialog] = useState(false)

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [autosave, setAutosave] = useAutosave()

  const repoKey = selectedRepo ? `${selectedRepo.owner}/${selectedRepo.name}` : null
  // Autosave may only save when the file's repository password is already in
  // memory, so it never opens a password dialog while the user is typing.
  const canAutosave = selectedFile
    ? Boolean(repoPasswords[`${selectedFile.owner}/${selectedFile.repo}`])
    : false

  const showNotice = useCallback((type: Notice['type'], message: string) => {
    setNotice({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, type, message })
  }, [])

  const dismissNotice = useCallback(() => setNotice(null), [])

  // Inspect the selected repository for a `.gitcloak` file so we can show
  // whether it is set up / locked / unlocked.
  useEffect(() => {
    if (!selectedRepo) return
    const key = `${selectedRepo.owner}/${selectedRepo.name}`
    let cancelled = false
    setRepoInitialized(prev => ({ ...prev, [key]: 'checking' }))

    void (async () => {
      try {
        const { checkGitCloakExists } = await import('@/lib/gitcloak')
        const check = await checkGitCloakExists(selectedRepo.owner, selectedRepo.name)
        if (!cancelled) {
          setRepoInitialized(prev => ({ ...prev, [key]: check.exists }))
        }
      } catch {
        if (!cancelled) {
          setRepoInitialized(prev => ({ ...prev, [key]: false }))
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [selectedRepo])

  const repoStatus: RepoStatus = !repoKey
    ? 'checking'
    : repoPasswords[repoKey]
      ? 'unlocked'
      : repoInitialized[repoKey] === false
        ? 'uninitialized'
        : repoInitialized[repoKey] === true
          ? 'locked'
          : 'checking'

  /**
   * Ask for an alternative password when a file cannot be decrypted with the
   * repository password (or when the repository has no `.gitcloak` to verify
   * against). Successfully decrypted files remember their password.
   */
  function openDecryptDialog(
    file: DecryptTarget,
    options: { uninitialized?: boolean } = {}
  ) {
    const fileKey = `${file.owner}/${file.repo}::${file.path}`
    const intro = options.uninitialized
      ? 'This repository is not initialized with GitCloak, so there is no repository password to check against.'
      : 'GitCloak could not decrypt this file with the current repository password.'

    setPasswordDialog({
      open: true,
      title: 'Cannot Decrypt File',
      description: `${intro} The file "${file.path}" may be protected with a different password. Enter an alternative password to try to decrypt it.`,
      submitLabel: 'Decrypt',
      requireConfirmation: false,
      testId: 'decrypt-error',
      icon: <AlertCircle className="size-4" />,
      onSubmit: async (password: string) => {
        const { decryptWithPassword } = await import('@/lib/encryption')
        let decrypted: string
        try {
          decrypted = await decryptWithPassword(file.content, password)
        } catch {
          throw new Error('That password could not decrypt this file. Check the password and try again.')
        }

        setFilePasswords(prev => ({ ...prev, [fileKey]: password }))
        setSelectedFile({
          path: file.path,
          content: decrypted,
          sha: file.sha,
          owner: file.owner,
          repo: file.repo,
          openId: nextOpenId(),
        })
        showNotice('success', `Unlocked "${file.path}" with an alternative password.`)
      },
    })
  }

  /**
   * Verify a password against the repository's `.gitcloak` file, remember it and
   * mark the repository as unlocked. When `resumeFile` is provided the file is
   * loaded again with the freshly entered password.
   */
  function openUnlockDialog(resumeFile?: PendingFile) {
    if (!selectedRepo) {
      showNotice('error', 'Select a repository first.')
      return
    }

    const owner = selectedRepo.owner
    const repo = selectedRepo.name
    const key = `${owner}/${repo}`

    void (async () => {
      setLoadingMessage('Checking repository...')
      setIsLoading(true)
      try {
        const { checkGitCloakExists, verifyPassword } = await import('@/lib/gitcloak')
        const check = await checkGitCloakExists(owner, repo)
        setRepoInitialized(prev => ({ ...prev, [key]: check.exists }))

        if (!check.exists) {
          if (resumeFile?.content) {
            // No `.gitcloak` to verify against — let the user type the file's
            // password directly.
            openDecryptDialog(
              { ...resumeFile, content: resumeFile.content },
              { uninitialized: true }
            )
          } else {
            showNotice(
              'error',
              'This repository is not initialized with GitCloak yet. Create and save an encrypted file first.'
            )
          }
          return
        }

        setPasswordDialog({
          open: true,
          title: 'Unlock Repository',
          description: `Enter the password for ${key}. GitCloak assumes every file in a repository uses the same password.`,
          submitLabel: 'Unlock',
          requireConfirmation: false,
          testId: 'unlock',
          icon: <Lock className="size-4" />,
          onSubmit: async (password: string) => {
            const isValid = await verifyPassword(check.content!, password)
            if (!isValid) {
              throw new Error('Incorrect password. Please try again.')
            }
            setRepoPasswords(prev => ({ ...prev, [key]: password }))
            showNotice('success', `${key} is now unlocked.`)
            if (resumeFile) {
              void loadFile(resumeFile, password)
            }
          },
        })
      } finally {
        setIsLoading(false)
      }
    })()
  }

  /**
   * Download a file and decrypt it when needed. Tries the file-specific
   * password first, then the repository password. Falls back to the unlock
   * dialog or the alternative-password dialog when decryption is not possible.
   */
  async function loadFile(file: PendingFile, passwordOverride?: string) {
    const { owner, repo, path, sha } = file
    const key = `${owner}/${repo}`
    const fileKey = `${key}::${path}`

    setLoadingMessage('Loading file...')
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/repos/${owner}/${repo}/contents?path=${encodeURIComponent(path)}`
      )

      if (!response.ok) {
        throw new Error('Failed to fetch file content')
      }

      const data = await response.json()

      if (!(data.content && data.encoding === 'base64')) {
        return
      }

      let content = atob(data.content)
      const isEncrypted = path.endsWith('.age')

      if (isEncrypted) {
        const { decryptWithPassword } = await import('@/lib/encryption')

        // Candidate passwords, highest priority first.
        const candidates: string[] = []
        if (passwordOverride) candidates.push(passwordOverride)
        if (filePasswords[fileKey] && !candidates.includes(filePasswords[fileKey])) {
          candidates.push(filePasswords[fileKey])
        }
        if (repoPasswords[key] && !candidates.includes(repoPasswords[key])) {
          candidates.push(repoPasswords[key])
        }

        let decrypted: string | null = null
        for (const password of candidates) {
          try {
            decrypted = await decryptWithPassword(content, password)
            break
          } catch {
            // Try the next candidate.
          }
        }

        if (decrypted === null) {
          // Stop the loading overlay before showing a dialog.
          setIsLoading(false)
          if (candidates.length === 0) {
            // No password available yet — unlock the repository first. Pass the
            // downloaded content so we can fall back to a direct password entry.
            openUnlockDialog({ owner, repo, path, sha, content })
          } else {
            openDecryptDialog({ owner, repo, path, sha, content })
          }
          return
        }

        content = decrypted
      }

      setSelectedFile({ path, content, sha: data.sha, owner, repo, openId: nextOpenId() })
    } catch (error) {
      console.error('Error loading file:', error)
      showNotice(
        'error',
        `Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleFileSelect = (owner: string, repo: string, path: string, sha: string) => {
    void loadFile({ owner, repo, path, sha })
  }

  const handleUnlockRepo = () => {
    openUnlockDialog()
  }

  const handleLockRepo = () => {
    if (!selectedRepo) return

    const key = `${selectedRepo.owner}/${selectedRepo.name}`
    setRepoPasswords(prev => {
      const updated = { ...prev }
      delete updated[key]
      return updated
    })
    // Remove per-file passwords that belong to this repository as well.
    setFilePasswords(prev => {
      const updated: Record<string, string> = {}
      for (const [fileKey, password] of Object.entries(prev)) {
        if (!fileKey.startsWith(`${key}::`)) {
          updated[fileKey] = password
        }
      }
      return updated
    })
    showNotice('info', `${key} is now locked. Password removed from memory.`)
  }

  const handleNewFile = () => {
    if (!selectedRepo) {
      showNotice('error', 'Select a repository first.')
      return
    }

    setFileNameDialog(true)
  }

  const handleFileNameSubmit = (fileName: string) => {
    if (!selectedRepo) return

    // Create new file in memory
    setSelectedFile({
      path: fileName,
      content: '',
      sha: '', // Empty sha for new files
      owner: selectedRepo.owner,
      repo: selectedRepo.name,
      isNew: true,
      openId: nextOpenId(),
    })
  }

  const handleSaveFile = async (content: string) => {
    if (!selectedFile) return

    const performSave = async (password: string) => {
      const { encryptWithPassword } = await import('@/lib/encryption')

      // Encrypt the content
      const encryptedContent = await encryptWithPassword(content, password)

      // Determine the save path (add .age extension)
      const savePath = selectedFile.path.endsWith('.age')
        ? selectedFile.path
        : `${selectedFile.path}.age`

      // Save to GitHub
      const response = await fetch(
        `/api/repos/${selectedFile.owner}/${selectedFile.repo}/save`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            path: savePath,
            content: encryptedContent,
            sha: selectedFile.isNew ? undefined : selectedFile.sha,
            message: selectedFile.isNew
              ? `Create ${savePath}`
              : `Update ${savePath}`,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save file')
      }

      const result = await response.json()

      // Update selected file with new sha, path, content and remove isNew flag
      setSelectedFile({
        ...selectedFile,
        content: content,
        sha: result.sha,
        path: savePath,
        isNew: false,
      })

      showNotice('success', `Saved ${savePath}`)
      // Refresh the file tree so newly created files show up immediately.
      window.__fileTreeRefresh?.()
    }

    try {
      const { checkGitCloakExists, createGitCloakFile, verifyPassword } = await import('@/lib/gitcloak')
      const repoKeyForFile = `${selectedFile.owner}/${selectedFile.repo}`
      const gitcloakCheck = await checkGitCloakExists(selectedFile.owner, selectedFile.repo)

      if (!gitcloakCheck.exists) {
        // First time encrypting - show dialog to set password
        setPasswordDialog({
          open: true,
          title: 'Set Repository Password',
          description: 'This is the first encrypted file in this repository. Set a password for encrypting files.',
          submitLabel: 'Set Password',
          requireConfirmation: true,
          testId: 'set-password',
          icon: <ShieldCheck className="size-4" />,
          onSubmit: async (newPassword: string) => {
            // Create .gitcloak file
            const gitcloakContent = await createGitCloakFile(newPassword)

            // Save .gitcloak file first
            const gitcloakResponse = await fetch(
              `/api/repos/${selectedFile.owner}/${selectedFile.repo}/save`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  path: '.gitcloak',
                  content: gitcloakContent,
                  message: 'Initialize GitCloak repository',
                }),
              }
            )

            if (!gitcloakResponse.ok) {
              throw new Error('Failed to create .gitcloak file')
            }

            // Store password in memory
            setRepoPasswords(prev => ({ ...prev, [repoKeyForFile]: newPassword }))
            setRepoInitialized(prev => ({ ...prev, [repoKeyForFile]: true }))

            // Perform the save
            await performSave(newPassword)
          },
        })
      } else if (repoPasswords[repoKeyForFile]) {
        // Have password in memory
        await performSave(repoPasswords[repoKeyForFile])
      } else {
        // Need to ask for password
        setPasswordDialog({
          open: true,
          title: 'Enter Repository Password',
          description: 'Enter the repository password to encrypt and save the file.',
          submitLabel: 'Save',
          requireConfirmation: false,
          testId: 'save-password',
          icon: <KeyRound className="size-4" />,
          onSubmit: async (enteredPassword: string) => {
            // Verify password
            const isValid = await verifyPassword(gitcloakCheck.content!, enteredPassword)
            if (!isValid) {
              throw new Error('Incorrect password!')
            }

            // Store password in memory
            setRepoPasswords(prev => ({ ...prev, [repoKeyForFile]: enteredPassword }))

            // Perform the save
            await performSave(enteredPassword)
          },
        })
      }
    } catch (error) {
      console.error('Error saving file:', error)
      showNotice(
        'error',
        `Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
      throw error
    }
  }

  return (
    <>
      {isLoading && <LoadingOverlay message={loadingMessage} />}
      <NoticeToast notice={notice} onDismiss={dismissNotice} />
      <PasswordDialog
        open={passwordDialog.open}
        onOpenChange={(open) => setPasswordDialog(prev => ({ ...prev, open }))}
        title={passwordDialog.title}
        description={passwordDialog.description}
        submitLabel={passwordDialog.submitLabel}
        requireConfirmation={passwordDialog.requireConfirmation}
        testId={passwordDialog.testId}
        icon={passwordDialog.icon}
        onSubmit={passwordDialog.onSubmit}
      />
      <InputDialog
        open={fileNameDialog}
        onOpenChange={setFileNameDialog}
        title="Create New File"
        description="Enter the file name (e.g., folder/file.md)"
        label="File name"
        placeholder="folder/file.md"
        onSubmit={handleFileNameSubmit}
      />
      <AppSidebar
        repositories={repositories}
        userName={userName}
        userImage={userImage}
        userEmail={userEmail}
        onFileSelect={handleFileSelect}
        onNewFile={handleNewFile}
        onRepoChange={setSelectedRepo}
        onUnlockRepo={handleUnlockRepo}
        onLockRepo={handleLockRepo}
        onOpenSettings={() => setSettingsOpen(true)}
        repoStatus={repoStatus}
        selectedFilePath={selectedFile?.path}
      />
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        autosave={autosave}
        onAutosaveChange={setAutosave}
      />
      <SidebarInset className="min-w-0 overflow-hidden">
        <EditorArea
          key={selectedFile?.openId ?? 'none'}
          selectedFile={selectedFile}
          isLoading={isLoading}
          autosave={autosave}
          canAutosave={canAutosave}
          onSave={handleSaveFile}
        />
      </SidebarInset>
    </>
  )
}
