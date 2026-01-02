'use client'

import { useState } from 'react'
import { AppSidebar } from '@/components/app-sidebar'
import { EditorArea } from '@/components/editor-area'
import { LoadingOverlay } from '@/components/loading-overlay'

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
}

interface ClientPageProps {
  repositories: Repository[]
  userName: string
  userImage?: string
  userEmail?: string
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

  const handleFileSelect = async (owner: string, repo: string, path: string, sha: string) => {
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

      // Decode base64 content
      if (data.content && data.encoding === 'base64') {
        let content = atob(data.content)

        // Check if this is an encrypted file (.age extension)
        const isEncrypted = path.endsWith('.age')

        if (isEncrypted) {
          const { decryptWithPassword } = await import('@/lib/encryption')
          const { checkGitCloakExists, verifyPassword } = await import('@/lib/gitcloak')
          const repoKey = `${owner}/${repo}`

          // Check if we have the password in memory
          let password = repoPasswords[repoKey]

          if (!password) {
            // Repository not unlocked - check if .gitcloak exists
            const gitcloakCheck = await checkGitCloakExists(owner, repo)

            if (!gitcloakCheck.exists) {
              alert('This repository has not been initialized with GitCloak yet.\nCannot decrypt file without .gitcloak file.')
              setIsLoading(false)
              return
            }

            // Ask for password
            setIsLoading(false) // Temporarily disable loading for prompt
            const enteredPassword = prompt('Repository is locked. Enter password to decrypt file:')
            if (!enteredPassword) return

            setLoadingMessage('Verifying password...')
            setIsLoading(true)

            // Verify password
            const isValid = await verifyPassword(gitcloakCheck.content!, enteredPassword)
            if (!isValid) {
              alert('Incorrect password!')
              setIsLoading(false)
              return
            }

            password = enteredPassword
            // Store password in memory
            setRepoPasswords(prev => ({ ...prev, [repoKey]: password! }))
          }

          // Decrypt the content
          setLoadingMessage('Decrypting file...')
          try {
            content = await decryptWithPassword(content, password)
          } catch (error) {
            console.error('Decryption error:', error)
            alert('Failed to decrypt file. The password may be incorrect or the file may be corrupted.')
            setIsLoading(false)
            return
          }
        }

        setSelectedFile({
          path,
          content,
          sha: data.sha,
          owner,
          repo,
        })
      }
    } catch (error) {
      console.error('Error loading file:', error)
      alert(`Failed to load file: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleUnlockRepo = async () => {
    if (!selectedRepo) {
      alert('Please select a repository first')
      return
    }

    try {
      setLoadingMessage('Verifying password...')
      setIsLoading(true)

      const { checkGitCloakExists, verifyPassword } = await import('@/lib/gitcloak')
      const repoKey = `${selectedRepo.owner}/${selectedRepo.name}`

      // Check if .gitcloak exists
      const gitcloakCheck = await checkGitCloakExists(selectedRepo.owner, selectedRepo.name)

      if (!gitcloakCheck.exists) {
        alert('This repository has not been initialized with GitCloak yet.\nCreate and save your first encrypted file to set up the repository password.')
        return
      }

      // Ask for password
      const password = prompt('Enter repository password:')
      if (!password) return

      // Verify password
      const isValid = await verifyPassword(gitcloakCheck.content!, password)
      if (!isValid) {
        alert('Incorrect password!')
        return
      }

      // Store password in memory
      setRepoPasswords(prev => ({ ...prev, [repoKey]: password }))
      alert('Repository unlocked successfully!')
    } catch (error) {
      console.error('Error unlocking repository:', error)
      alert('Failed to unlock repository')
    } finally {
      setIsLoading(false)
    }
  }

  const handleLockRepo = () => {
    if (!selectedRepo) return

    const repoKey = `${selectedRepo.owner}/${selectedRepo.name}`
    setRepoPasswords(prev => {
      const updated = { ...prev }
      delete updated[repoKey]
      return updated
    })
    alert('Repository locked. Password removed from memory.')
  }

  const handleNewFile = () => {
    if (!selectedRepo) {
      alert('Please select a repository first')
      return
    }

    const fileName = prompt('Enter file name (e.g., "folder/file.md"):')
    if (!fileName) return

    // Validate filename
    if (fileName.trim() === '') {
      alert('File name cannot be empty')
      return
    }

    // Create new file in memory
    setSelectedFile({
      path: fileName,
      content: '',
      sha: '', // Empty sha for new files
      owner: selectedRepo.owner,
      repo: selectedRepo.name,
      isNew: true,
    })
  }

  const handleSaveFile = async (content: string) => {
    if (!selectedFile) return

    try {
      // Don't show loading overlay for save - it happens in background
      // setLoadingMessage('Encrypting file...')
      // setIsLoading(true)

      // Import required functions
      const { encryptWithPassword } = await import('@/lib/encryption')
      const { checkGitCloakExists, createGitCloakFile, verifyPassword } = await import('@/lib/gitcloak')

      // Check if .gitcloak exists
      const repoKey = `${selectedFile.owner}/${selectedFile.repo}`
      const gitcloakCheck = await checkGitCloakExists(selectedFile.owner, selectedFile.repo)

      let password: string

      if (!gitcloakCheck.exists) {
        // First time encrypting in this repo - need to create .gitcloak
        const newPassword = prompt('This is the first encrypted file in this repository.\nEnter a password for this repository:')
        if (!newPassword) {
          alert('Password is required to encrypt and save the file')
          return
        }

        // Confirm password
        const confirmPassword = prompt('Confirm repository password:')
        if (newPassword !== confirmPassword) {
          alert('Passwords do not match')
          return
        }

        password = newPassword

        // Create .gitcloak file
        const gitcloakContent = await createGitCloakFile(password)

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
        setRepoPasswords(prev => ({ ...prev, [repoKey]: password }))
      } else {
        // .gitcloak exists - check if we have the password in memory
        if (repoPasswords[repoKey]) {
          password = repoPasswords[repoKey]
        } else {
          // Ask for password and verify it
          const enteredPassword = prompt('Enter repository password:')
          if (!enteredPassword) {
            alert('Password is required to encrypt and save the file')
            return
          }

          // Verify password against .gitcloak
          const isValid = await verifyPassword(gitcloakCheck.content!, enteredPassword)
          if (!isValid) {
            alert('Incorrect password!')
            return
          }

          password = enteredPassword

          // Store password in memory
          setRepoPasswords(prev => ({ ...prev, [repoKey]: password }))
        }
      }

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
        content: content, // Update content to match what was saved
        sha: result.sha,
        path: savePath,
        isNew: false,
      })

      // Don't show success alert - status bar will show "Saved"
    } catch (error) {
      console.error('Error saving file:', error)
      alert(`Failed to save file: ${error instanceof Error ? error.message : 'Unknown error'}`)
      // Re-throw error so EditorArea can handle it
      throw error
    }
  }

  // Check if current repo is unlocked
  const isRepoUnlocked = selectedRepo
    ? !!repoPasswords[`${selectedRepo.owner}/${selectedRepo.name}`]
    : false

  return (
    <>
      {isLoading && <LoadingOverlay message={loadingMessage} />}
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
        isRepoUnlocked={isRepoUnlocked}
        selectedFilePath={selectedFile?.path}
      />
      <EditorArea
        selectedFile={selectedFile}
        isLoading={isLoading}
        onSave={handleSaveFile}
      />
    </>
  )
}
