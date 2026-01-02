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
   - Run `npm run build` to ensure it builds successfully
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
- Prefer inline styles (existing pattern)
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

Currently, testing is manual. Contributions to add automated testing are welcome!

## Questions?

Feel free to open an issue for any questions about contributing.

Thank you for contributing to GitCloak!
