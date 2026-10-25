# Contributing to GitCloak

Thank you for your interest in contributing to GitCloak! This document provides guidelines and instructions for contributing.

## Code of Conduct

Be respectful, inclusive, and professional in all interactions.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/yourusername/gitcloak/issues)
2. If not, create a new issue with:
   - Clear, descriptive title
   - Steps to reproduce the bug
   - Expected behavior
   - Actual behavior
   - Screenshots if applicable
   - Environment details (browser, OS, etc.)

### Suggesting Features

1. Check if the feature has already been suggested
2. Create a new issue with:
   - Clear description of the feature
   - Use cases and benefits
   - Potential implementation approach (optional)

### Pull Requests

1. **Fork the repository** and create a new branch from `main`
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
5. **Push to your fork** and submit a pull request
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

- All encryption/decryption must happen client-side
- Never transmit passwords to the server
- Never store passwords on disk
- Follow secure coding practices
- Report security vulnerabilities privately

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
