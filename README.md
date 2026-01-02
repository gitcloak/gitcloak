# GitCloak

**Secure, encrypted file editing for GitHub repositories**

GitCloak is a web application that allows you to edit and store encrypted files directly in your GitHub repositories. All encryption and decryption happens client-side in your browser using the industry-standard [age encryption format](https://age-encryption.org/), ensuring your sensitive data never leaves your control.

## Features

- **Client-Side Encryption**: All encryption/decryption happens in your browser using age format
- **Zero Knowledge**: Your encryption password is stored only in browser memory, never transmitted
- **GitHub Native**: Encrypted files are stored directly in your GitHub repositories
- **Repository-Level Passwords**: Each repository has its own encryption password
- **Password Verification**: Secure password verification without storing the password
- **Interoperable**: Uses age format - decrypt your files anywhere with age-compatible tools
- **Real-time Editing**: Edit files with live status updates and background saving
- **File Tree Navigation**: Browse and manage your repository files easily
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
- **Styling**: Inline styles with React
- **Icons**: React Icons (Feather)

## Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- A GitHub account
- A GitHub OAuth App (for authentication)

### Setup

1. **Clone the repository**:
   \`\`\`bash
   git clone https://github.com/yourusername/gitcloak.git
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
│   │   ├── app-sidebar.tsx    # Sidebar with file tree
│   │   ├── editor-area.tsx    # File editor
│   │   ├── file-tree.tsx      # Repository file browser
│   │   └── ...
│   ├── lib/                   # Utility libraries
│   │   ├── encryption.ts      # Age encryption/decryption
│   │   ├── gitcloak.ts        # Password verification
│   │   └── github-app.ts      # GitHub API client
│   └── auth.ts                # NextAuth configuration
├── public/                    # Static assets
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

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

- Use TypeScript for type safety
- Follow the existing code style
- Test your changes locally before submitting
- Update documentation as needed

### Reporting Issues

If you find a bug or have a feature request, please open an issue on GitHub.

## Security Considerations

- **Password Strength**: Use strong, unique passwords for each repository
- **Password Storage**: Passwords are never sent to servers or stored on disk
- **HTTPS Required**: Always use HTTPS in production to prevent MITM attacks
- **Browser Security**: Keep your browser up to date
- **Repository Access**: GitCloak requires GitHub OAuth permissions to read and write files

## Roadmap

- [ ] Markdown preview mode
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
