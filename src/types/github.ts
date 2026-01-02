/**
 * GitHub repository information
 */
export interface Repository {
  id: number
  name: string
  fullName: string
  owner: string
  private: boolean
  description: string | null
  updatedAt: string
}

/**
 * File or directory node in repository
 */
export interface FileNode {
  name: string
  path: string
  type: 'file' | 'dir'
  sha: string
  size?: number
}

/**
 * File content with metadata
 */
export interface FileContent {
  content: string
  sha: string
  path: string
  name: string
}

/**
 * GitHub user information
 */
export interface GitHubUser {
  id: number
  login: string
  name: string | null
  email: string | null
  avatarUrl: string
}
