'use client'

import { useState } from 'react'
import { FiBook, FiLock, FiGlobe, FiClock } from 'react-icons/fi'

interface Repository {
  id: number
  name: string
  fullName: string
  owner: string
  private: boolean
  description: string | null
  updatedAt: string
}

export function RepositoryCard({ repo }: { repo: Repository }) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <div
      style={{
        border: `1px solid ${isHovered ? '#667eea' : '#e1e4e8'}`,
        borderRadius: '6px',
        padding: '1rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: isHovered ? '0 2px 8px rgba(102,126,234,0.1)' : 'none',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'start'
      }}>
        <div style={{ flex: 1 }}>
          <h4 style={{
            fontSize: '1.1rem',
            color: '#0366d6',
            marginBottom: '0.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <FiBook size={18} />
            {repo.fullName}
          </h4>
          {repo.description && (
            <p style={{
              color: '#666',
              fontSize: '0.9rem',
              margin: '0.25rem 0'
            }}>
              {repo.description}
            </p>
          )}
          <p style={{
            color: '#999',
            fontSize: '0.8rem',
            marginTop: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            <FiClock size={12} />
            Updated: {new Date(repo.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <span style={{
          fontSize: '0.75rem',
          padding: '0.25rem 0.5rem',
          borderRadius: '12px',
          backgroundColor: repo.private ? '#ffeaa7' : '#dfe6e9',
          color: '#2d3436',
          display: 'flex',
          alignItems: 'center',
          gap: '0.25rem',
          whiteSpace: 'nowrap'
        }}>
          {repo.private ? <FiLock size={12} /> : <FiGlobe size={12} />}
          {repo.private ? 'Private' : 'Public'}
        </span>
      </div>
    </div>
  )
}
