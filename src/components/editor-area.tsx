'use client'

import { useState, useEffect } from 'react'
import { FiClock, FiEdit3, FiSave } from 'react-icons/fi'

interface SelectedFile {
  path: string
  content: string
  sha: string
  owner: string
  repo: string
  isNew?: boolean
}

interface EditorAreaProps {
  selectedFile: SelectedFile | null
  isLoading: boolean
  onSave: (content: string) => Promise<void>
}

export function EditorArea({ selectedFile, isLoading, onSave }: EditorAreaProps) {
  const [content, setContent] = useState('')
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [savedContent, setSavedContent] = useState('')

  // Update content when selectedFile changes
  useEffect(() => {
    if (selectedFile) {
      setContent(selectedFile.content)
      setSavedContent(selectedFile.content)
      setHasChanges(false)
    }
  }, [selectedFile])

  const handleContentChange = (newContent: string) => {
    setContent(newContent)
    setHasChanges(newContent !== savedContent)
  }

  const handleSave = async () => {
    // Take a snapshot of the content to save
    const contentToSave = content
    setSavedContent(contentToSave)
    setHasChanges(false)
    setIsSaving(true)

    // Save in background
    try {
      await onSave(contentToSave)
    } catch (error) {
      // If save fails, restore the hasChanges state
      setHasChanges(content !== savedContent)
    } finally {
      setIsSaving(false)
    }
  }
  return (
    <>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'white',
        overflow: 'hidden'
      }}>
      {/* Editor Header */}
      <div style={{
        padding: '1rem 1.5rem',
        borderBottom: '1px solid #e1e4e8',
        backgroundColor: '#fafbfc',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <div style={{
            fontSize: '0.875rem',
            color: '#666',
            marginBottom: '0.25rem'
          }}>
            {selectedFile ? `${selectedFile.owner}/${selectedFile.repo}` : 'No file selected'}
          </div>
          <div style={{
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#24292e',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            {selectedFile ? (
              <>
                <span>{selectedFile.path}</span>
                {selectedFile.isNew && (
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '500',
                    color: '#2ea44f',
                    backgroundColor: '#dafbe1',
                    padding: '0.125rem 0.5rem',
                    borderRadius: '4px'
                  }}>
                    New
                  </span>
                )}
              </>
            ) : (
              'Welcome to GitCloak'
            )}
          </div>
        </div>
        <div style={{
          display: 'flex',
          gap: '0.5rem'
        }}>
          <button
            onClick={handleSave}
            disabled={!selectedFile || !hasChanges || isSaving}
            style={{
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              border: '1px solid #e1e4e8',
              borderRadius: '6px',
              backgroundColor: selectedFile && hasChanges ? '#2ea44f' : '#f6f8fa',
              color: selectedFile && hasChanges ? 'white' : '#999',
              cursor: (selectedFile && hasChanges && !isSaving) ? 'pointer' : 'not-allowed',
              fontWeight: selectedFile && hasChanges ? '500' : 'normal',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <FiSave
              size={16}
              style={{
                animation: isSaving ? 'pulse 1.5s ease-in-out infinite' : 'none'
              }}
            />
            {isSaving ? 'Saving...' : hasChanges ? 'Save Changes' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main Editor Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden'
      }}>
        {/* Editor Pane (Full Width) */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            padding: '0.5rem 1rem',
            borderBottom: '1px solid #e1e4e8',
            fontSize: '0.75rem',
            fontWeight: '600',
            color: '#666',
            backgroundColor: '#fafbfc'
          }}>
            EDITOR
          </div>
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            color: '#999'
          }}>
            {isLoading ? (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <FiClock size={48} style={{ color: '#999', marginBottom: '1rem' }} />
                  <p style={{ fontSize: '1rem' }}>Loading file...</p>
                </div>
              </div>
            ) : selectedFile ? (
              <textarea
                value={content}
                onChange={(e) => handleContentChange(e.target.value)}
                spellCheck={false}
                style={{
                  flex: 1,
                  padding: '1.5rem',
                  border: 'none',
                  outline: 'none',
                  resize: 'none',
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                  fontSize: '14px',
                  lineHeight: '1.6',
                  color: '#24292e',
                  backgroundColor: 'white'
                }}
              />
            ) : (
              <div style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem'
              }}>
                <div style={{ textAlign: 'center' }}>
                  <FiEdit3 size={48} style={{ color: '#999', marginBottom: '1rem' }} />
                  <p style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
                    Select a file to start editing
                  </p>
                  <p style={{ fontSize: '0.875rem' }}>
                    Your files will be encrypted with age format before saving
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div style={{
        padding: '0.5rem 1rem',
        borderTop: '1px solid #e1e4e8',
        backgroundColor: '#f6f8fa',
        fontSize: '0.75rem',
        color: '#666',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          {isSaving ? '● Saving...' : hasChanges ? '● Modified' : selectedFile ? '● Saved' : 'Ready'}
        </div>
        <div style={{
          display: 'flex',
          gap: '1rem',
          alignItems: 'center'
        }}>
          <div>
            {selectedFile ? `${content.split('\n').length} lines | ${content.length} chars` : 'UTF-8'}
          </div>
          <a
            href="https://github.com/gitcloak/gitcloak"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#0366d6',
              textDecoration: 'none',
              fontWeight: '500',
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
          >
            Contribute
          </a>
        </div>
      </div>
    </div>
    </>
  )
}
