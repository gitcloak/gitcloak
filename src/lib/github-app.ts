import { App } from "@octokit/app"
import { Octokit } from "@octokit/rest"

/**
 * GitHub App client for fine-grained repository access
 * Users select specific repositories during installation
 */
export class GitHubAppClient {
  private app: App
  private octokit: Octokit | null = null

  constructor() {
    // Get private key from environment variable
    const privateKey = process.env.GITHUB_PRIVATE_KEY

    if (!privateKey) {
      throw new Error('GITHUB_PRIVATE_KEY environment variable is not set')
    }

    // Handle base64-encoded keys (common in deployment platforms)
    let decodedKey = privateKey
    if (!privateKey.includes('BEGIN')) {
      try {
        decodedKey = Buffer.from(privateKey, 'base64').toString('utf-8')
      } catch (error) {
        // If base64 decode fails, use the key as-is
        decodedKey = privateKey
      }
    }

    // Replace literal \n with actual newlines if needed
    const formattedKey = decodedKey.replace(/\\n/g, '\n')

    this.app = new App({
      appId: process.env.GITHUB_APP_ID!,
      privateKey: formattedKey,
      oauth: {
        clientId: process.env.GITHUB_CLIENT_ID!,
        clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      },
    })
  }

  /**
   * Get Octokit instance for a specific installation
   * This allows access only to repositories the user selected
   */
  async getOctokitForInstallation(installationId: number): Promise<Octokit> {
    const octokit = await this.app.getInstallationOctokit(installationId)
    return octokit as unknown as Octokit
  }

  /**
   * Get user's installations (which accounts/orgs have the app installed)
   */
  async getUserInstallations(accessToken: string) {
    const octokit = new Octokit({ auth: accessToken })

    try {
      const { data } = await octokit.request("GET /user/installations")

      return data.installations.map((installation: any) => ({
        id: installation.id,
        account: {
          login: installation.account.login,
          type: installation.account.type,
          avatarUrl: installation.account.avatar_url,
        },
        repositorySelection: installation.repository_selection,
        permissions: installation.permissions,
      }))
    } catch (error) {
      throw new Error(`Failed to get installations: ${error}`)
    }
  }

  /**
   * Get repositories accessible to a specific installation
   * These are ONLY the repositories the user selected during installation
   */
  async getInstallationRepositories(installationId: number) {
    try {
      const octokit = await this.getOctokitForInstallation(installationId)

      const { data } = await octokit.request("GET /installation/repositories")

      return data.repositories.map((repo: any) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        owner: repo.owner.login,
        private: repo.private,
        description: repo.description,
        updatedAt: repo.updated_at,
      }))
    } catch (error) {
      throw new Error(`Failed to get installation repositories: ${error}`)
    }
  }

  /**
   * Get file content from a repository (installation-scoped)
   */
  async getFileContent(
    installationId: number,
    owner: string,
    repo: string,
    path: string
  ) {
    try {
      const octokit = await this.getOctokitForInstallation(installationId)

      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
      })

      if ('content' in data && data.type === 'file') {
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
   * Update or create a file (installation-scoped)
   */
  async updateFile(
    installationId: number,
    owner: string,
    repo: string,
    path: string,
    content: string,
    message: string,
    sha?: string
  ) {
    try {
      const octokit = await this.getOctokitForInstallation(installationId)

      const base64Content = Buffer.from(content).toString('base64')

      const { data } = await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path,
        message,
        content: base64Content,
        sha,
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
   * List contents of a directory (installation-scoped)
   */
  async listContents(
    installationId: number,
    owner: string,
    repo: string,
    path: string = ''
  ) {
    try {
      const octokit = await this.getOctokitForInstallation(installationId)

      const { data } = await octokit.repos.getContent({
        owner,
        repo,
        path,
      })

      if (Array.isArray(data)) {
        return data.map((item: any) => ({
          name: item.name,
          path: item.path,
          type: item.type as 'file' | 'dir',
          sha: item.sha,
          size: item.size,
        }))
      }

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
}

/**
 * Create a GitHub App client instance
 */
export function createGitHubAppClient() {
  return new GitHubAppClient()
}
