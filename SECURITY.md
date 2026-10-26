# Security Policy

GitCloak encrypts file contents in the browser before they reach GitHub, so
the security of the encryption, password handling and session code matters a
great deal. Thank you for taking the time to report issues responsibly.

## Supported Versions

Security fixes are applied to the latest release on `main`. Older versions are
not patched.

| Version | Supported          |
| ------- | ------------------ |
| `main`  | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
pull requests or discussions.**

Report them privately with GitHub's private vulnerability reporting:

1. Go to <https://github.com/gitcloak/gitcloak/security/advisories/new>.
2. Describe the issue, including the affected component, steps to reproduce
   and the potential impact.
3. Include a proof of concept if you have one. Do not include real repository
   passwords, tokens or private data.

We aim to acknowledge reports within 3 business days and to provide an initial
assessment within 10 business days. We will keep you informed while we work on
a fix and coordinate a disclosure date with you. Reporters are credited in the
advisory unless they ask not to be.

## Scope

In scope:

- Client-side encryption and decryption (age encryption, key derivation)
- Handling of repository passwords, which must never leave the browser or be
  stored on disk
- Authentication and session handling (NextAuth, GitHub OAuth and GitHub App
  flows)
- API routes under `src/app/api/`
- Leaks of plaintext file contents, passwords or tokens

Out of scope:

- Vulnerabilities in third-party services or dependencies that are not
  exploitable through GitCloak (report those upstream; Dependabot alerts are
  tracked in this repository)
- Denial of service through unrealistic load
- Findings that require a compromised device or browser
- Social engineering of maintainers or users
