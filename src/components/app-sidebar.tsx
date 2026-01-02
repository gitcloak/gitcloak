'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { FileTree } from './file-tree'
import { FiLock, FiUnlock, FiPlus, FiShield, FiRefreshCw } from 'react-icons/fi'

interface Repository {
  id: number
  name: string
  fullName: string
  owner: string
  private: boolean
  description: string | null
  updatedAt: string
}

interface FileNode {
  name: string
  path: string
  type: 'file' | 'dir'
  sha: string
  size?: number
}

interface AppSidebarProps {
  repositories: Repository[]
  userName: string
  userImage?: string
  userEmail?: string
  onFileSelect?: (owner: string, repo: string, path: string, sha: string) => void
  onNewFile?: () => void
  onRepoChange?: (repo: Repository | null) => void
  onUnlockRepo?: () => void
  onLockRepo?: () => void
  isRepoUnlocked?: boolean
  selectedFilePath?: string
}

export function AppSidebar({ repositories, userName, userImage, userEmail, onFileSelect, onNewFile, onRepoChange, onUnlockRepo, onLockRepo, isRepoUnlocked, selectedFilePath }: AppSidebarProps) {
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(
    repositories.length > 0 ? repositories[0] : null
  )
  const [isRepoSelectorOpen, setIsRepoSelectorOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRepoChange = (repo: Repository) => {
    setSelectedRepo(repo)
    onRepoChange?.(repo)
  }

  const handleRefresh = () => {
    if ((window as any).__fileTreeRefresh) {
      (window as any).__fileTreeRefresh()
    }
  }

  const handleLoadingChange = (isLoading: boolean) => {
    setIsRefreshing(isLoading)
  }

  return (
    <>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      <div style={{
        width: '300px',
        backgroundColor: '#f6f8fa',
        borderRight: '1px solid #e1e4e8',
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}>
      {/* Header with logo */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #e1e4e8',
        backgroundColor: 'white'
      }}>
        <h1 style={{
          fontSize: '1.25rem',
          fontWeight: 'bold',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <FiShield style={{ color: '#667eea' }} />
          GitCloak
        </h1>
      </div>

      {/* Repository Selector */}
      <div style={{
        padding: '1rem',
        borderBottom: '1px solid #e1e4e8',
        backgroundColor: 'white'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.5rem'
        }}>
          <label style={{
            fontSize: '0.75rem',
            fontWeight: '600',
            color: '#666',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            Repository
          </label>
          {selectedRepo && (
            <button
              onClick={isRepoUnlocked ? onLockRepo : onUnlockRepo}
              style={{
                padding: '0.375rem 0.5rem',
                fontSize: '0.75rem',
                border: '1px solid #e1e4e8',
                borderRadius: '4px',
                backgroundColor: isRepoUnlocked ? '#fff5f5' : 'white',
                cursor: 'pointer',
                color: isRepoUnlocked ? '#d73a49' : '#24292e',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                height: '28px'
              }}
              title={isRepoUnlocked ? 'Lock repository (clear password from memory)' : 'Unlock repository (enter password)'}
            >
              {isRepoUnlocked ? <FiUnlock size={14} /> : <FiLock size={14} />}
              {isRepoUnlocked ? 'Lock' : 'Unlock'}
            </button>
          )}
        </div>
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsRepoSelectorOpen(!isRepoSelectorOpen)}
            style={{
              width: '100%',
              padding: '0.5rem',
              border: '1px solid #e1e4e8',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '0.875rem'
            }}
          >
            <span style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {selectedRepo ? selectedRepo.fullName : 'Select repository'}
            </span>
            <span style={{ marginLeft: '0.5rem' }}>▼</span>
          </button>

          {isRepoSelectorOpen && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              left: 0,
              right: 0,
              backgroundColor: 'white',
              border: '1px solid #e1e4e8',
              borderRadius: '6px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              maxHeight: '200px',
              overflowY: 'auto',
              zIndex: 10
            }}>
              {repositories.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => {
                    handleRepoChange(repo)
                    setIsRepoSelectorOpen(false)
                  }}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: 'none',
                    backgroundColor: selectedRepo?.id === repo.id ? '#f0f0f0' : 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontSize: '0.875rem',
                    borderBottom: '1px solid #f0f0f0'
                  }}
                >
                  {repo.fullName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* File Navigator */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        backgroundColor: 'white',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{
          padding: '0.75rem 1rem',
          fontSize: '0.75rem',
          fontWeight: '600',
          color: '#666',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          borderBottom: '1px solid #e1e4e8',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Files</span>
          {selectedRepo && (
            <div style={{ display: 'flex', gap: '0.25rem' }}>
              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                style={{
                  padding: '0.375rem 0.5rem',
                  fontSize: '0.75rem',
                  border: '1px solid #e1e4e8',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: isRefreshing ? 'not-allowed' : 'pointer',
                  color: '#24292e',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  height: '28px',
                  opacity: isRefreshing ? 0.6 : 1
                }}
                title="Refresh file list"
              >
                <FiRefreshCw
                  size={14}
                  style={{
                    animation: isRefreshing ? 'spin 1s linear infinite' : 'none'
                  }}
                />
              </button>
              <button
                onClick={onNewFile}
                style={{
                  padding: '0.375rem 0.5rem',
                  fontSize: '0.75rem',
                  border: '1px solid #e1e4e8',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  color: '#24292e',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  height: '28px'
                }}
                title="Create new file"
              >
                <FiPlus size={14} />
                New
              </button>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {selectedRepo ? (
            <FileTree
              owner={selectedRepo.owner}
              repo={selectedRepo.name}
              onFileSelect={(path, sha) => {
                onFileSelect?.(selectedRepo.owner, selectedRepo.name, path, sha)
              }}
              selectedFilePath={selectedFilePath}
              onLoadingChange={handleLoadingChange}
            />
          ) : (
            <div style={{
              padding: '1rem',
              color: '#999',
              fontSize: '0.875rem',
              fontStyle: 'italic',
              textAlign: 'center'
            }}>
              Select a repository to view files
            </div>
          )}
        </div>
      </div>

      {/* Account/Settings at bottom */}
      <div style={{
        borderTop: '1px solid #e1e4e8',
        padding: '1rem',
        backgroundColor: 'white'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          marginBottom: '0.75rem'
        }}>
          {userImage && (
            <img
              src={userImage}
              alt={userName}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%'
              }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: '0.875rem',
              fontWeight: '500',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}>
              {userName}
            </div>
            {userEmail && (
              <div style={{
                fontSize: '0.75rem',
                color: '#666',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {userEmail}
              </div>
            )}
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '0.5rem'
        }}>
          <button
            style={{
              flex: 1,
              padding: '0.5rem',
              fontSize: '0.75rem',
              border: '1px solid #e1e4e8',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            Settings
          </button>
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            style={{
              flex: 1,
              padding: '0.5rem',
              fontSize: '0.75rem',
              border: '1px solid #e1e4e8',
              borderRadius: '6px',
              backgroundColor: 'white',
              cursor: 'pointer'
            }}
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
    </>
  )
}
