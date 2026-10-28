# GitCloak Architecture and Security Guidance

This is the contract for anyone changing GitCloak, human or agent. Read it
before touching auth, crypto, the API routes, storage backends, headers or
dependencies. Where a rule here conflicts with convenience, the rule wins; if a
rule is wrong, change it in the same PR and say why.

The visual language lives in [style-guide.md](style-guide.md). This document is
about trust boundaries, security invariants and structure.

---

## 1. What GitCloak is, and what it promises

A Next.js (App Router) app that edits files in a user's GitHub repositories.
Files are encrypted **in the browser** with [age](https://age-encryption.org)
passphrase mode and stored as `*.age`. A `.gitcloak` file in the repository
holds an encrypted known string so a password can be checked without storing it.

The promise to users, which every change must preserve:

> The server and GitHub never see a password or plaintext file content.

File and folder names are encrypted too (invariant 17). What is **not**
protected (state this honestly in docs and UI, never claim "zero knowledge"):
the number of entries and the depth of the directory tree, file sizes, commit
messages (they contain the stored names), commit timing, names of entries
created before encrypted names, and the set of repositories the user installed
the app on.

## 2. Trust boundaries

```
 Browser (trusted for secrets)          Next.js server (never sees secrets)         GitHub
 ───────────────────────────            ─────────────────────────────────           ──────
 password, plaintext, age crypto  ───►  session check, validation, proxy  ───────►  repo storage
 React state only                       ciphertext + metadata only                  installation-scoped
```

| Zone | May hold | Must never hold |
| --- | --- | --- |
| Browser memory (React state) | Repository/file passwords, decrypted text | Anything persisted: no `localStorage`, `sessionStorage`, IndexedDB, cookies, URLs, `console` output. The only allowed browser storage is non-sensitive UI preferences (e.g. the autosave toggle) |
| Server (route handlers, server components) | GitHub OAuth token (read from the encrypted session cookie), ciphertext, repo metadata | Passwords, plaintext, decrypted content, token material in logs |
| GitHub | Ciphertext, `.gitcloak`, stored names (encrypted for new entries), commit messages | Plain names of new entries, anything else |

The browser is the only place plaintext exists. Treat any XSS as total
compromise of unlocked repositories; the defences in section 5 exist for that
reason.

## 3. Code map and layering

```
src/
  app/                    Routes only. Thin: auth check -> validate -> call backend -> shape response.
    api/repos/[owner]/[repo]/{contents,save,move}/route.ts   The only data API.
    api/auth/[...nextauth]/                              Auth.js handlers (+ mock shim for e2e).
    api/setup/                                           GitHub App post-install redirect.
    api/session/end/                                     Clears a session GitHub rejected; returns to the landing page.
    api/test/*                                           Mock-only; 404 unless FILE_BACKEND=mock.
    (authenticated)/app/                                 Server layout guards the page; client-page.tsx holds UI state.
  components/             UI. No fetch to anything but our own /api. No secrets in props that leave the client.
    ui/                   shadcn primitives. Do not hand-edit; regenerate.
  lib/
    encryption.ts         Browser API for age. Sends encrypt/decrypt requests to the worker below.
    age-passphrase.ts     age passphrase core. The ONLY file that imports age-encryption. Runs in the worker.
    encryption-worker.ts  Web Worker that runs scrypt off the main thread, so the UI never freezes.
    gitcloak.ts           .gitcloak create/verify, browser-side.
    filenames.ts          Encrypted file and folder names, browser-side. Keys come from a secret wrapped in .gitcloak.
    name-migration.ts     Upgrades old repositories to encrypted names on unlock (browser-side).
    validation.ts         Input validation and same-origin check for routes. Server-side.
    session.ts            getSession(): the ONLY way server code obtains the user/token.
    access-token.ts       Decrypts the GitHub token from the session cookie (server-only).
    token-refresh.ts      Refreshes the GitHub token via the OAuth refresh grant.
    session-refresh.ts    Re-encrypts the session cookie with the rotated tokens.
    auth-callbacks.ts     Auth.js jwt/session callbacks; tokens go in the JWT, never the session.
    mock-*.ts             Test-only (session, auth handler). Loaded only behind the mock build flag.
    backends/             FileBackend interface + git (GitHub) and mock implementations.
    github.ts, github-app.ts   Legacy; unused. Do not build on them (see section 9).
  auth.ts                 Auth.js config.
  middleware.ts           Refreshes the GitHub token near expiry on /app and /api/repos. Does not gate access.
next.config.ts            Security headers / CSP.
tests/unit, tests/e2e     Vitest and Playwright (mock backend, no network).
```

Dependency direction (enforce in review):

- `components/` -> `lib/encryption`, `lib/gitcloak`, `lib/filenames`, our own `/api`. Never `lib/backends`, `auth.ts` or Octokit.
- `app/api/**` -> `lib/session`, `lib/validation`, `lib/backends`. Never `lib/encryption` (the server must not be able to decrypt) and never `age-encryption`.
- `lib/backends/*` know nothing about React, Auth.js or HTTP shapes. They take a token and return normalized data.
- Server-only modules must not be imported into client components. Add `import "server-only"` to new server-only modules.

## 4. Security invariants (must always hold)

Each has a test or a check. If you change code that touches one, prove it still holds.

**Crypto and secrets**

1. `age-encryption` is imported only in `lib/age-passphrase.ts`, which runs in the Web Worker `lib/encryption-worker.ts`; `lib/encryption`, `lib/gitcloak` and `lib/filenames` are imported only from client code (and the mock backend's seed data). No server route may decrypt or accept a password.
2. Passwords and plaintext live only in React state and are cleared on lock (`handleLockRepo`). Never write them to storage, URLs, logs, error messages, analytics or `data-*` attributes.
3. Passwords are never sent over the network. Request bodies to `/api/repos/**/save` carry ciphertext only.
4. Crypto stays in age passphrase mode; do not hand-roll primitives, change the armor format, or add a "remember password" feature without a design review. Changes to the scrypt work factor or `.gitcloak` format need a version bump and a migration path for existing repositories. **Exception: file names** (`lib/filenames.ts`). age cannot encrypt a name deterministically, so names use an SIV-style construction over WebCrypto (HMAC-SHA256 as the synthetic IV, AES-CTR, keys from HKDF-SHA256). The keys come from a random 32-byte secret stored in `.gitcloak` (version 1.1) as `nameKey`, wrapped with age under the repository password. Names are therefore as hard to guess as the contents: never derive name keys directly from the password, because public names would then give a fast offline check. The construction is new and has not had an independent review; get one before relying on it for anything beyond name hiding.

**Server and API**

5. Every route handler calls `getSession()` first and returns 401 without a token. Server components under `(authenticated)` do the same. There is no unauthenticated data path. Do not add `middleware.ts`-only protection; check in the handler.
6. All request input (path params, query, body) goes through `lib/validation.ts` before use. Add a validator when you add a field; never pass raw input to Octokit.
7. `save` accepts only age ciphertext (`.age`) or a well-formed `.gitcloak`, never writes under `.github/`, and rejects traversal paths. Do not loosen this to "support" another file type; encrypt on the client instead. `move` renames only `.age` files to `.age` paths and copies the bytes unchanged; it never touches `.gitcloak`.
8. State-changing routes (POST/PUT/PATCH/DELETE) call `isSameOrigin()`. Use `x-forwarded-host`, as it does, so it works behind Vercel.
9. Errors returned to clients are fixed strings (or validation messages we wrote). Log details server-side with `console.error`, never return `error.message` from Octokit or the runtime.
10. Never log tokens, token prefixes, cookies, request bodies or file content. Auth.js `debug` stays development-only.
11. The GitHub access/refresh tokens exist only inside the encrypted, httpOnly Auth.js JWT cookie and in server memory. They must never appear on the object returned by `/api/auth/session` (the `session` callback in `lib/auth-callbacks.ts` copies identity only), in props passed to client components, or in any API response. Server code obtains the token through `getSession()`, which uses `readAccessToken()`. `session.ts` and the git backend import `server-only` so a client import fails the build. `tests/unit/access-token.test.ts` and `mock-auth.spec.ts` assert this.
12. GitHub access is through the GitHub App user-to-server token, which GitHub limits to repositories the user installed the app on. Keep the app's permissions minimal (Contents: read/write; Metadata: read). Do not request OAuth scopes or switch to a broad personal-access-token style.
13. Mock mode (`FILE_BACKEND=mock`) replaces authentication with a fixed user and must be impossible in a deployment. It is enforced three ways: (a) `next.config.ts` refuses to build it for production on Vercel, or locally without `ALLOW_MOCK_BACKEND=1`; (b) all mock code (`backends/mock`, `mock-session`, `mock-auth-handler`, `/api/test/*` bodies) is loaded with `import()` behind the build-time constant `process.env.NEXT_PUBLIC_MOCK_BACKEND === '1'`, so a normal production bundle does not contain it; (c) `getBackendKind()` throws if mock is requested in a production runtime that was not built for it, or on Vercel, so a stray env var fails closed with a 500, not an open app. Keep the literal constant in the condition (webpack can only drop the dead branch if it sees it) and never import mock modules statically.

**Browser hardening**

14. The CSP in `next.config.ts` is a security control. Don't add third-party script, frame or connect origins to production policy. Preview-only origins (`vercel.live`) are gated on `VERCEL_ENV === "preview"`. Never ship `'unsafe-eval'` in production.
15. No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function` or user-controlled `href`/`src` schemes. Render decrypted text as text.
16. No new third-party scripts, analytics, fonts from CDNs or tracking pixels. Anything loaded in the page can read unlocked plaintext.

**File names**

17. Plain names of new entries never leave the browser. `encryptRepoPath` in `lib/filenames.ts` produces stored names for new entries, and `name-migration.ts` produces them for old ones. The server validates and stores the stored name it is given (still `.age` for files), and the commit message shows the stored name. Tests: `tests/unit/filenames.test.ts`, `tests/e2e/encrypted-names.spec.ts` and `tests/e2e/name-migration.spec.ts`.

## 5. Defence in depth: how the layers back each other up

| Threat | First line | Second line |
| --- | --- | --- |
| XSS reads password/plaintext | No HTML injection patterns, React escaping | CSP (`script-src 'self'`, `connect-src 'self'`) stops exfiltration; `frame-ancestors 'none'` stops clickjacking |
| Plaintext committed by bug or crafted request | Client always encrypts before save | `validateSavePayload` refuses non-age content server-side |
| Path traversal / writing CI files | `validatePath` | GitHub App permissions; `.github/` denied |
| CSRF on save | SameSite session cookie | `isSameOrigin` |
| Token leak | Never logged, not in URLs, not in the browser-visible session | Short-lived GitHub App tokens (see gap 1); scoped to installed repos |
| Mock/test bypass reaches production | Mock code not in production bundle | Build refuses mock on Vercel; runtime `getBackendKind()` throws |
| Vulnerable dependency | `npm audit` clean, lockfile committed | Dependabot/CI audit (to be added, section 9) |
| Offline password guessing against public ciphertext | age scrypt | Password strength guidance (to be added, section 9) |

## 6. Scalability and structure rules

The app is stateless and serverless-friendly. Keep it that way.

- **No server state.** Sessions are Auth.js JWTs; there is no database. Do not add in-memory server caches or module-level state that matters for correctness (Vercel runs many isolates). The mock backend is the sole exception and is test-only. If shared state is genuinely needed (rate limiting, audit logs), introduce an external store behind an interface and document it here first.
- **Routes stay thin.** A handler does: origin check, session, validate, backend call, shape response, map errors. Business logic goes in `lib/`. Share the pattern; do not copy-paste auth/validation blocks into a fifth route. When a third route needs it, extract a `withSession`/`parseRequest` helper.
- **Storage goes through `FileBackend`.** New operations (delete, rename, history) are added to the interface in `lib/backends/types.ts` and implemented in **both** `git.ts` and `mock.ts`. Backends return normalized data; HTTP shaping stays in routes. This keeps alternative backends (GitLab, S3, local) possible without touching the UI.
- **GitHub API budget.** GitHub rate-limits per user token. Prefer one call per user action; use pagination for `listRepositories`/directory listings when exceeding 100 items rather than raising `per_page` blindly; use conditional requests (ETag) before adding polling. Never poll.
- **Large content.** Request bodies are capped (`MAX_BODY_BYTES`). age's scrypt runs in a Web Worker (`lib/encryption-worker.ts`), so unlock, decrypt and save never block the UI. Keep that work off the main thread. Stream rather than buffer if file size limits are raised.
- **Client state.** `client-page.tsx` is already large. New features should extract hooks/components (e.g. `useRepoPasswords`) rather than grow it; keep secrets in one well-defined store that `lock` can clear in one call.
- **Config.** All env access is read in one place per concern (`auth.ts`, `backends/index.ts`, `next.config.ts`). Fail fast on missing required config at startup rather than at first request. Document every variable in `.env.example`.
- **Versioned formats.** Anything persisted in a user's repo (`.gitcloak`, file headers, naming conventions) carries a version and must stay readable by older and newer clients. Prefer additive changes. `.gitcloak` version 1.1 added `nameKey` (additive: 1.0 clients ignore it). Encrypted names (`lib/filenames.ts`) have no version marker of their own: the HKDF labels (`gitcloak-filename-mac-v1`, `gitcloak-filename-enc-v1`), the SIV construction and the 16-byte tag are fixed for every repository. Changing any of them makes existing names unreadable (they then show as stored, and nothing is lost), so add a marker and a migration first. A version 1.0 `.gitcloak` is upgraded to 1.1 on the first unlock (`name-migration.ts`).
- **Interop.** Files must remain decryptable with the stock `age` CLI. Don't add custom wrappers around the ciphertext.

## 7. Deployment model (Vercel)

- **Production** and **preview** run the same code path with the real GitHub backend. `FILE_BACKEND=mock` is for Playwright only and must never be set in a Vercel environment (the build and runtime both refuse it there).
- Required env: `AUTH_SECRET`, `AUTH_URL` (or rely on Vercel's host trust), `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_APP_ID`, `NEXT_PUBLIC_GITHUB_APP_NAME`. Secrets are set per Vercel environment; use a **separate GitHub App (and secrets) for preview** from production so a preview build cannot reach production installations.
- Each preview URL must be registered as a callback on the preview GitHub App, or previews should use a stable preview alias.
- `NEXT_PUBLIC_*` variables are public. Never put a secret in one.
- `AUTH_SECRET` encrypts the session cookie that contains the GitHub token; treat it as the master secret and rotate it on suspected exposure (this signs everyone out).
- Security headers and CSP are set in `next.config.ts` at build time from `VERCEL_ENV`; verify them after changing it (see checklist).

## 8. Review checklist (copy into PR descriptions)

Security-relevant PRs (auth, crypto, routes, backends, headers, deps) must answer:

- [ ] Does any password or plaintext reach the server, a log, storage, a URL or an error message, or any token reach the browser? (Must be no.)
- [ ] Is every new route/handler session-checked, origin-checked if mutating, and validated through `lib/validation.ts`?
- [ ] Does `save` still refuse non-ciphertext and `.github/` writes? Did I add tests for new rejection cases?
- [ ] Does new code reference mock modules only through `import()` behind `NEXT_PUBLIC_MOCK_BACKEND`?
- [ ] Did CSP/headers change? If a new origin was added, is it preview-only or truly necessary, and why?
- [ ] New dependency: needed, maintained, license OK, `npm audit` clean, runs only where intended (client vs server)?
- [ ] New backend operation implemented in both `git` and `mock` backends and covered by e2e?
- [ ] Errors to the client are generic; details logged server-side without sensitive data?
- [ ] Any new persisted format versioned and backward compatible?
- [ ] Docs updated (this file, README security model, `.env.example`)?

Before merging run:

```bash
npm run lint && npx tsc --noEmit
npm run test:unit
npm run test:e2e
npm audit --omit=dev
```

and check that a normal production build contains no mock code:

```bash
AUTH_SECRET=x NEXT_DIST_DIR=.next-check npm run build
grep -rl 'mock-access-token\|demo-password' .next-check/server .next-check/static   # must print nothing
rm -rf .next-check
```

and, for header/CSP changes, build and inspect both variants:

```bash
ALLOW_MOCK_BACKEND=1 FILE_BACKEND=mock AUTH_SECRET=x npm run build && npm start      # production policy
VERCEL_ENV=preview ALLOW_MOCK_BACKEND=1 FILE_BACKEND=mock AUTH_SECRET=x npm run build # adds vercel.live
curl -sI localhost:3000/ | grep -i content-security-policy
```

Load the built app in a browser and confirm there are no CSP violations in the console.

## 9. Known gaps and planned work (highest priority first)

Do not paper over these; fix them or consciously carry them. Remove an item when it ships.

1. **Rate limiting.** There is no per-user limit on `/api/repos/**` (needs an external store, see section 6).
2. **No password strength rules.** Ciphertext is public in public repos, so password quality is the main defence. Enforce a minimum length/zxcvbn score on "Set Repository Password" and recommend passphrases.
3. **`.gitcloak` is unauthenticated.** A collaborator with write access can replace it. Warn when it changes (e.g. pin a fingerprint client-side) and document that write access to the repo is a trust boundary.
4. **First-save race.** `.gitcloak` is created with no `sha`; concurrent first saves can overwrite each other, and a failed second step leaves an initialised repo with no files. Use a create-only write and handle 422 explicitly.
5. **No rotation.** Changing the repository password needs a re-encrypt flow; old commits remain decryptable with the old password. Document this limit.
6. **Nonce-based CSP.** `script-src` still allows `'unsafe-inline'`. Move to per-request nonces (middleware) when feasible.
7. **CI gaps.** CI (lint, unit, build, e2e), Dependabot, CodeQL and `SECURITY.md` exist. Still missing: an `npm audit --omit=dev` step and the "no mock code in the production bundle" grep from section 8 in CI.
8. **Dead code.** `lib/github.ts` and `lib/github-app.ts` are unused; delete them rather than extend them.
9. **Pagination.** `listRepositories` reads only the first 100 repos.
10. **Metadata leakage.** File names are encrypted (invariant 17), and `.age` files saved before that are renamed on unlock. Still visible: folder names and plain (non-`.age`) files, because renaming a folder moves everything inside it, code included, so that needs its own design. Also visible: commit messages (they contain the stored names; consider a generic message setting), entry counts, tree depth, and sizes.
