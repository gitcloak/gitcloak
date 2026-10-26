# Contributing to GitCloak

Thank you for your interest in contributing to GitCloak! This document provides guidelines and instructions for contributing.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you are expected to uphold it.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/gitcloak/gitcloak/issues)
2. If not, [open a bug report](https://github.com/gitcloak/gitcloak/issues/new/choose) with:
   - Clear, descriptive title
   - Steps to reproduce the bug
   - Expected behavior
   - Actual behavior
   - Screenshots if applicable
   - Environment details (browser, OS, etc.)

Never include passwords, repository keys, tokens or decrypted file contents in an issue.

### Suggesting Features

1. Check if the feature has already been suggested
2. [Open a feature request](https://github.com/gitcloak/gitcloak/issues/new/choose) with:
   - Clear description of the feature
   - Use cases and benefits
   - Potential implementation approach (optional)

### Pull Requests

The `main` branch is protected. Every change reaches it through a pull request, and direct pushes are blocked for everyone, including maintainers. A pull request can be merged when:

- All CI checks pass (lint, unit tests, end-to-end tests and build)
- It has an approving review from a maintainer
- All review conversations are resolved
- It is squash-merged or rebased onto `main` (merge commits are not used, so history stays linear)

To contribute:

1. **Create a branch from `main`**. External contributors should fork the repository first; maintainers can create a branch in the repository directly.
2. **Make your changes**:
   - Follow the existing code style
   - Use TypeScript for type safety
   - Add comments for complex logic
   - Update documentation as needed
3. **Test your changes**:
   - Run `npm run dev` to test locally
   - Run `npm run lint` to check ESLint (flat config in `eslint.config.mjs`)
   - Run `npm run build` to ensure it builds successfully
   - Run `npm test` (unit + end-to-end tests), or `npm run test:unit` /
     `npm run test:e2e` individually
   - Test the functionality manually
4. **Commit your changes**:
   - Use clear, descriptive commit messages
   - Reference issue numbers if applicable
5. **Open a pull request** against `main` and fill in the pull request template
6. **Wait for review** and address any feedback

## Development Setup

See the [Installation](README.md#installation) section in the README.

## Code Style

- Use TypeScript for all new code
- Follow the existing code organization
- Use functional components with hooks
- Follow the [style guide](docs/style-guide.md) for colors, spacing, typography and component blocks
  - The app shell uses inline style objects consuming `var(--gc-*)` tokens
  - Dialogs/forms use Tailwind utilities mapped to the same tokens (e.g. `bg-gc-canvas`)
- Use meaningful variable and function names
- Add JSDoc comments for complex functions

## Project Structure

```
src/
├── app/                # Next.js App Router pages
├── components/         # React components
├── lib/               # Utility libraries
└── auth.ts            # Authentication config
```

## Security

Read [docs/architecture.md](docs/architecture.md) first: it defines the trust
boundaries, security invariants, layering rules and the review checklist that
every change (and every AI agent working in this repo) must follow.

- All encryption/decryption must happen client-side
- Never transmit passwords to the server
- Never store passwords on disk
- Follow secure coding practices
- Report security vulnerabilities privately, as described in [SECURITY.md](SECURITY.md). Do not open a public issue or pull request for them.

## Testing

Automated tests live under `tests/`:

- `tests/unit/` — Vitest unit tests for the pure libraries
  (`npm run test:unit`).
- `tests/e2e/` — Playwright end-to-end tests that drive the real UI against
  the mock backend (`npm run test:e2e`).

Run both with `npm test`. Please add or update tests for any behaviour change;
end-to-end tests should not depend on GitHub credentials or the network.

## Questions?

Feel free to open an issue for any questions about contributing.

Thank you for contributing to GitCloak!
