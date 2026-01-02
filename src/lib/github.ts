import { Octokit } from "@octokit/rest"

/**
 * GitHub API client for repository operations
 */
export class GitHubClient {
  private octokit: Octokit

  constructor(accessToken: string) {
    this.octokit = new Octokit({
      auth: accessToken,
    })
  }

  /**
   * List all repositories for the authenticated user
   */
  async listRepositories() {
    try {
      const { data } = await this.octokit.repos.listForAuthenticatedUser({
        sort: 'updated',
        per_page: 100,
      })

      return data.map((repo) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        private: repo.private,
        description: repo.description,
        updatedAt: repo.updated_at,
      }))
    } catch (error) {
      throw new Error(`Failed to list repositories: ${error}`)
    }
  }

  /**
   * List contents of a repository directory
   */
  async listContents(owner: string, repo: string, path: string = '') {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      })

      if (Array.isArray(data)) {
        return data.map((item) => ({
          name: item.name,
          path: item.path,
          type: item.type as 'file' | 'dir',
          sha: item.sha,
          size: item.size,
        }))
      }

      // Single file
      return [{
        name: data.name,
        path: data.path,
        type: data.type as 'file' | 'dir',
        sha: data.sha,
        size: data.size,
      }]
    } catch (error) {
      throw new Error(`Failed to list contents: ${error}`)
    }
  }

  /**
   * Get file content from repository
   */
  async getFileContent(owner: string, repo: string, path: string) {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      })

      if ('content' in data && data.type === 'file') {
        // Decode base64 content
        const content = Buffer.from(data.content, 'base64').toString('utf-8')
        return {
          content,
          sha: data.sha,
          path: data.path,
          name: data.name,
        }
      }

      throw new Error('Path is not a file')
    } catch (error) {
      throw new Error(`Failed to get file content: ${error}`)
    }
  }

  /**
   * Update or create a file in the repository
   */
  async updateFile(
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string
  ) {
    try {
      // Encode content to base64
      const base64Content = Buffer.from(content).toString('base64')

      const { data } = await this.octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: base64Content,
        sha, // Required for updates, optional for creates
      })

      return {
        sha: data.content?.sha,
        path: data.content?.path,
        name: data.content?.name,
      }
    } catch (error) {
      throw new Error(`Failed to update file: ${error}`)
    }
  }

  /**
   * Get authenticated user info
   */
  async getUser() {
    try {
      const { data } = await this.octokit.users.getAuthenticated()
      return {
        id: data.id,
        login: data.login,
        name: data.name,
        email: data.email,
        avatarUrl: data.avatar_url,
      }
    } catch (error) {
      throw new Error(`Failed to get user info: ${error}`)
    }
  }
}

/**
 * Create a GitHub client instance with an access token
 */
export function createGitHubClient(accessToken: string) {
  return new GitHubClient(accessToken)
}
