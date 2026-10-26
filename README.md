# GitCloak

**Secure, encrypted file editing for GitHub repositories**

[![CI](https://github.com/gitcloak/gitcloak/actions/workflows/ci.yml/badge.svg)](https://github.com/gitcloak/gitcloak/actions/workflows/ci.yml)
[![CodeQL](https://github.com/gitcloak/gitcloak/actions/workflows/codeql.yml/badge.svg)](https://github.com/gitcloak/gitcloak/actions/workflows/codeql.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

GitCloak is a web application that allows you to edit and store encrypted files directly in your GitHub repositories. All encryption and decryption happens client-side in your browser using the industry-standard [age encryption format](https://age-encryption.org/), ensuring your sensitive data never leaves your control.

## Features

- **Client-Side Encryption**: All encryption/decryption happens in your browser using age format
- **Zero Knowledge**: Your encryption password is stored only in browser memory, never transmitted
- **GitHub Native**: Encrypted files are stored directly in your GitHub repositories
- **Repository-Level Passwords**: Each repository has its own encryption password
- **Password Verification**: Secure password verification without storing the password
- **Interoperable**: Uses age format - decrypt your files anywhere with age-compatible tools
- **Real-time Editing**: Edit files with live status updates and background saving
- **Live Markdown**: Headings, emphasis, links, lists, quotes and code render as you type, Obsidian-style; the stored file is always the plain Markdown you wrote. A Source/Rendered toggle switches to the raw text; non-Markdown files always show raw text
- **File Tree Navigation**: Browse and manage your repository files easily
- **Responsive Shell**: Collapsible sidebar that becomes an off-canvas sheet on mobile
- **Dark Mode**: Light/dark/system themes via `next-themes`, chosen in Settings
- **Autosave**: Optionally save a moment after you stop typing (Settings → Editor)
- **GitHub OAuth**: Secure authentication through GitHub

## How It Works

1. **Authenticate** with your GitHub account via OAuth
2. **Select** a repository you want to work with
3. **Create or edit** files - they're automatically encrypted with age format before saving
4. **Set a password** the first time you save an encrypted file in a repository
5. **Files are saved** to GitHub with a `.age` extension, fully encrypted

Your files remain in your GitHub repository, but they're encrypted at rest. Only someone with the repository password can decrypt them.

## Security Model

- **Encryption**: AES-256-GCM via age format (industry standard)
- **Password Verification**: Uses encrypted challenge string (never stores password)
- **Client-Side Only**: All crypto operations happen in your browser
- **Memory-Only Storage**: Passwords stored only in browser memory during session
- **GitHub OAuth**: No password storage, uses GitHub's authentication

**⚠️ Important**: Keep your repository passwords safe. If you lose a password, encrypted files in that repository cannot be recovered.

## Tech Stack

- **Frontend**: Next.js 15 (App Router) + React 19
- **Language**: TypeScript
- **Authentication**: NextAuth.js v5 with GitHub OAuth
- **Encryption**: [age-encryption](https://www.npmjs.com/package/age-encryption) (WebAssembly)
- **GitHub API**: Octokit
- **Styling**: Tailwind CSS v4 + [shadcn/ui](https://ui.shadcn.com) (`new-york`)
- **Icons**: [lucide-react](https://lucide.dev)
- **Primitives**: [Radix UI](https://www.radix-ui.com) (via the unified `radix-ui` package)
- **Theming**: `next-themes` (light / dark / system)

## Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- A GitHub account
- A GitHub OAuth App (for authentication)

### Setup

1. **Clone the repository**:
   \`\`\`bash
   git clone https://github.com/gitcloak/gitcloak.git
   cd gitcloak
   \`\`\`

2. **Install dependencies**:
   \`\`\`bash
   npm install
   \`\`\`

3. **Create a GitHub OAuth App**:
   - Go to GitHub Settings → Developer settings → OAuth Apps
   - Click "New OAuth App"
   - Fill in the details:
     - Application name: \`GitCloak (Development)\`
     - Homepage URL: \`http://localhost:3000\`
     - Authorization callback URL: \`http://localhost:3000/api/auth/callback/github\`
   - Click "Register application"
   - Copy the Client ID and generate a Client Secret

4. **Configure environment variables**:
   Create a \`.env.local\` file in the root directory:
   \`\`\`bash
   # GitHub OAuth
   AUTH_GITHUB_ID=your_github_client_id
   AUTH_GITHUB_SECRET=your_github_client_secret

   # NextAuth
   AUTH_SECRET=your_random_secret_key  # Generate with: openssl rand -base64 32
   AUTH_URL=http://localhost:3000
   \`\`\`

5. **Run the development server**:
   \`\`\`bash
   npm run dev
   \`\`\`

6. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

### Build for Production

\`\`\`bash
npm run build
npm start
\`\`\`

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import your repository in [Vercel](https://vercel.com)
3. Configure environment variables in Vercel:
   - \`AUTH_GITHUB_ID\`
   - \`AUTH_GITHUB_SECRET\`
   - \`AUTH_SECRET\`
   - \`AUTH_URL\` (set to your production domain)
4. Update your GitHub OAuth App callback URL to match your Vercel domain
5. Deploy!

### Other Platforms

GitCloak is a standard Next.js application and can be deployed to any platform that supports Next.js:

- Netlify
- Railway
- Render
- AWS Amplify
- Self-hosted with Node.js

## Usage

### Creating Your First Encrypted File

1. Sign in with GitHub
2. Select a repository from the dropdown
3. Click the "New" button
4. Enter a filename (e.g., \`secrets.md\`)
5. Type your content
6. Click "Save Changes"
7. Enter and confirm a repository password
8. Your file is encrypted and saved as \`secrets.md.age\`

### Opening Encrypted Files

1. Click on any \`.age\` file in the file tree
2. If the repository is locked, enter the password
3. The file is decrypted and displayed
4. Edit and save as needed

### Repository Lock/Unlock

- **Lock**: Click the "Lock" button to clear the password from memory
- **Unlock**: Click the "Unlock" button to enter the password and keep it in memory

## Project Structure

\`\`\`
gitcloak/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (authenticated)/    # Protected routes
│   │   │   └── app/           # Main application
│   │   ├── api/               # API routes
│   │   │   ├── auth/          # NextAuth configuration
│   │   │   └── repos/         # GitHub API endpoints
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Landing page
│   ├── components/            # React components
│   │   ├── ui/                # shadcn/ui primitives (button, dialog, sidebar, …)
│   │   ├── app-sidebar.tsx    # Sidebar with file tree
│   │   ├── editor-area.tsx    # File editor
│   │   ├── markdown-editor.tsx # CodeMirror 6 editor with live Markdown rendering
│   │   ├── file-tree.tsx      # Repository file browser
│   │   └── ...
│   ├── hooks/                 # Shared React hooks (use-mobile)
│   ├── lib/                   # Utility libraries
│   │   ├── backends/          # Storage backends (git / mock)
│   │   ├── encryption.ts      # Age encryption/decryption
│   │   ├── gitcloak.ts        # Password verification
│   │   ├── session.ts         # Session resolution (mock-aware)
│   │   └── github-app.ts      # GitHub API client
│   └── auth.ts                # NextAuth configuration
├── public/                    # Static assets
├── docs/                      # Documentation
│   └── style-guide.md         # UI style guide (tokens & components)
├── tests/
│   ├── unit/                  # Vitest unit tests (crypto helpers)
│   └── e2e/                   # Playwright end-to-end tests
├── .env.local                 # Environment variables (not in git)
├── package.json
├── tsconfig.json
└── README.md
\`\`\`

## File Format

Encrypted files use the age format with ASCII armor encoding:

\`\`\`
-----BEGIN AGE ENCRYPTED FILE-----
YWdlLWVuY3J5cHRpb24ub3JnL3YxCi0+IHNjcnlwdCBmSEJ3YktHS2pHV0N0ZGJL
...
-----END AGE ENCRYPTED FILE-----
\`\`\`

These files can be decrypted using:
- GitCloak web interface
- [age CLI tool](https://github.com/FiloSottile/age)
- Any age-compatible tool

## Decrypting Files Outside GitCloak

You can decrypt \`.age\` files using the [age CLI tool](https://github.com/FiloSottile/age):

\`\`\`bash
# Install age
brew install age  # macOS
# or download from https://github.com/FiloSottile/age/releases

# Decrypt a file
age -d -o decrypted.md secrets.md.age
# Enter your repository password when prompted
\`\`\`

## Storage Backends

All repository access on the server goes through a small backend interface (`src/lib/backends`):

- **`git`** (default) – talks to GitHub with the signed-in user's OAuth token.
- **`mock`** – an in-memory backend seeded with real age-encrypted content, used by the end-to-end test suite.

Select the backend with the `FILE_BACKEND` environment variable (`git` or `mock`).
`git` is the default everywhere; `mock` is reserved for the automated test suite
and is never selected automatically.

When `FILE_BACKEND=mock`, authentication is bypassed with a deterministic mock
session, so the app can be driven locally without GitHub credentials. The mock
backend also exposes test-only endpoints (`POST /api/test/reset` and
`GET /api/test/state`) which return `404` whenever the mock backend is not
active.

### Vercel preview deployments

Like every environment other than the automated test suite, preview deployments
use the real GitHub backend. A preview therefore needs the GitHub/Auth variables
(`AUTH_SECRET`, `GITHUB_*`, `AUTH_URL`, `NEXT_PUBLIC_GITHUB_APP_NAME`) set in the
**Preview** scope, and its OAuth callback URL registered on the GitHub App.
Because each deploy gets a unique hostname, register the stable **branch alias**
(e.g. `https://gitcloak-git-<branch>-<team>.vercel.app/api/auth/callback/github`)
and set `AUTH_URL` to that same alias — per-commit URLs will not match the OAuth
callback. Without those variables Auth.js shows the *"There is a problem with
the server configuration"* error on `/api/auth/error`.

## End-to-End Tests

The frontend is covered by Playwright tests that run the real Next.js app
against the mock backend:

```bash
# Uses the locally installed Google Chrome (`channel: "chrome"`).
# On a machine without Chrome run `npx playwright install chromium` and
# remove `channel` from playwright.config.ts.
npm run test:e2e
```

The suite boots `next dev` on port 3100 with `FILE_BACKEND=mock` (see
`playwright.config.ts`), resets the backend before every test and verifies the
landing page, repository selector, lock/unlock flow, file tree, editor,
decryption with an alternative password, creating/saving encrypted files, a
full encrypt-on-save → reload → decrypt round trip (asserting the plaintext is
never stored), and that the [style guide](docs/style-guide.md) is applied to
the unlock popup.

## Unit Tests

The pure library code is covered by [Vitest](https://vitest.dev) unit tests:

```bash
npm run test:unit        # single run
npm run test:unit:watch  # watch mode
```

These target `src/lib/encryption.ts` (age encrypt/decrypt round trips, armored
output, fresh-salt non-determinism, wrong-password and tamper rejection,
unicode/empty content) and `src/lib/gitcloak.ts` (`.gitcloak` verification file
creation and password verification). Run everything with `npm test`.

## Linting

ESLint runs through its own CLI (`next lint` is deprecated in Next 15 and
removed in Next 16) against the flat config in `eslint.config.mjs`, which
bridges `next/core-web-vitals` and `next/typescript` in via `FlatCompat`:

```bash
npm run lint       # check
npm run lint:fix   # check and autofix
```

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Changes to `main` are only accepted through reviewed pull requests that pass CI.

### Development Guidelines

- Use TypeScript for type safety
- Follow the [style guide](docs/style-guide.md) for all UI changes
- Follow the existing code style
- Test your changes locally before submitting
- Update documentation as needed

### Reporting Issues

If you find a bug or have a feature request, please [open an issue](https://github.com/gitcloak/gitcloak/issues/new/choose). Security vulnerabilities must be reported privately; see [SECURITY.md](SECURITY.md).

### Community

This project is governed by the [Code of Conduct](CODE_OF_CONDUCT.md).

## Security Considerations

- **Password Strength**: Use strong, unique passwords for each repository
- **Password Storage**: Passwords are never sent to servers or stored on disk
- **HTTPS Required**: Always use HTTPS in production to prevent MITM attacks
- **Browser Security**: Keep your browser up to date
- **Repository Access**: GitCloak requires GitHub OAuth permissions to read and write files

## Roadmap

- [x] Markdown live preview while editing (rendered as you type)
- [ ] File search functionality
- [ ] Multiple file selection
- [ ] File and folder creation via UI
- [ ] Drag-and-drop file upload
- [ ] Syntax highlighting for code files
- [ ] Password change functionality
- [ ] Export/import encrypted files
- [ ] Mobile-responsive design improvements

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- [age encryption](https://age-encryption.org/) by Filippo Valsorda
- [Next.js](https://nextjs.org/) framework
- [NextAuth.js](https://next-auth.js.org/) for authentication
- [Octokit](https://github.com/octokit) for GitHub API access
- [React Icons](https://react-icons.github.io/react-icons/)

## Support

For questions or support, please open an issue on GitHub.

---

**Made with security in mind**
