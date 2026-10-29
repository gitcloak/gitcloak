# Passkey and FIDO2 unlock: design proposal

Status: **proposed, not implemented.** This document is the design review that
[architecture.md](architecture.md) §4 invariant 4 requires before any
"remember the password" style feature ships. Nothing here changes code,
the `.gitcloak` format or the security invariants until the open decisions
at the end are settled and the change is made in its own PR.

## 1. Goal and non-goals

**Goal.** A user can unlock a repository by approving a passkey or a FIDO2
security key (Touch ID, Windows Hello, a phone passkey, a YubiKey) instead of
typing the repository password. Unlock keeps today's model: the password is
held in React state only, and is cleared on lock.

**Non-goals.**

- Replacing the password. The password stays the master secret and the
  recovery path. Losing every authenticator must not lose data.
- Passkey as an age recipient (multi-recipient or plugin mode). That would
  change the file format and break the passphrase-only interop promised in the
  README. Files stay plain age passphrase files.
- Server-side key custody. The server must not hold passkey secrets, wrapped
  keys or the password (invariants 1, 3, 5).
- Persistent client storage. Nothing goes into `localStorage`, `IndexedDB` or
  cookies (invariant 2).

## 2. Approach: a passkey-derived key wraps the repository password

The WebAuthn **PRF extension** (`extensions.prf`) lets a credential return a
32-byte secret for a given salt. The secret is deterministic for a
(credential, salt) pair, is only available after user verification, and never
leaves the authenticator. GitCloak uses that secret to wrap the repository
password, and stores the wrapped copy in the repository's `.gitcloak` file.

**Enrollment** (the repository must already be unlocked, so the password is in
memory):

1. `navigator.credentials.create()` with `residentKey: "required"`,
   `userVerification: "required"` and the PRF extension enabled.
2. Run a `navigator.credentials.get()` with a fresh random salt to obtain the
   PRF output. Some authenticators only return PRF output on assertion, so
   enrollment always does this step.
3. Derive a wrapping key from the PRF output (see §3) and wrap the password.
4. Append the entry to `.gitcloak` (a normal save: create or update with `sha`,
   through the existing `save` route).

**Unlock:**

1. `navigator.credentials.get()` with `allowCredentials` taken from the
   `.gitcloak` entries, the stored salt, and `userVerification: "required"`.
2. Derive the wrapping key and unwrap the password, in the Web Worker with the
   other crypto.
3. Check the password with the existing `verifyPassword` against the
   `verification` field. Only a password that passes is loaded into state, the
   same as a typed password.

If the wrong credential is used, or the PRF output is missing, the unwrap or
the verification fails and the UI falls back to the password prompt.

## 3. Wrapping format

Preferred: **age itself**. Derive an X25519 identity from the PRF output
(HKDF-SHA256 with a label such as `gitcloak-passkey-unwrap-v1`), then
encrypt the password to the matching recipient with age's X25519 recipient
stanza, armored like every other GitCloak ciphertext. Decryption uses the same
identity.

Why age and not a hand-rolled AES-GCM wrapper: invariant 4 forbids new
primitives or formats without review. Using the age format keeps one format,
one library (`age-encryption`, already used in the worker) and
one review surface.

**To verify in a spike before any implementation:** that `age-encryption`
(the version pinned in `package.json`) can encrypt to and decrypt with a
caller-supplied X25519 identity from browser code. If it cannot, the fallback
is AES-256-GCM via WebCrypto with the HKDF output as key, which needs an
explicit review.

## 4. Storage in `.gitcloak`

Additive, so 1.0 and 1.1 clients keep working:

```json
{
  "version": "1.2",
  "verification": "...",
  "nameKey": "...",
  "createdAt": "...",
  "passkeys": [
    {
      "credentialId": "<base64url>",
      "prfSalt": "<base64url, 32 random bytes>",
      "wrappedPassword": "<age armor>",
      "createdAt": "<ISO time>"
    }
  ]
}
```

Points to check against the code:

- `addNameKeyToGitCloakFile` already spreads the parsed object, so unknown
  fields survive a 1.0 to 1.1 upgrade. Other rewrite paths must do the same.
- `validation.ts` checks `verification` and `nameKey` on save. It must also
  accept `version: "1.2"` and a well-formed `passkeys` array, and refuse
  anything else. The unit tests for validation must cover the new rejection
  cases.
- Older clients will see an unknown `passkeys` field and an unknown version.
  Confirm they still open the repository and unlock with the password. This
  needs a test against the 1.1 code path.
- Labels for passkeys are left out on purpose. A device name would be public
  metadata.

Metadata that becomes public: the number of passkeys, credential IDs (they are
not secrets), and the time of each enrollment (already visible through the
commit history).

## 5. Security analysis

| Concern | Assessment |
| --- | --- |
| Offline guessing from public `.gitcloak` | The wrapped password is encrypted under a 256-bit key that only the authenticator can produce. The attacker needs the authenticator. No new offline oracle is created. The `verification` and `nameKey` fields are unchanged. |
| Password strength | Unchanged. The password still protects the files directly, and it is the recovery path. Gap 2 (strength rules) matters at least as much. |
| Phishing | Passkeys are bound to the origin (the RP ID). A look-alike site cannot ask for the PRF output. This is the main gain over typing the password. |
| Server | Never sees the PRF output, the wrapping key, the password or the unwrapped data. The only change it stores is ciphertext, through the existing save path. |
| Browser | The password lives in React state only. The PRF output and the derived key are dropped after use (best effort in JavaScript; no guarantee of memory zeroing). No persistence. |
| Forged entries (gap 3) | A collaborator with write access cannot add a passkey entry that unwraps to a different password on the victim's authenticator, because they do not have that authenticator's PRF output. Gap 3 still applies to replacing the whole `.gitcloak` file, which is unchanged by this proposal. |
| Lost authenticator | The password still unlocks. Stale entries can be removed by a normal save. |
| Revocation | Removing an entry stops future passkey unlocks. It does not revoke a device that has already unwrapped the password. Real revocation is password rotation (gap 5). |
| XSS | An XSS can already read plaintext, so passkeys add no new risk. User verification still gates each assertion. |
| Mock backend | Parity: the mock backend stores `passkeys` in its seeded `.gitcloak`, so e2e tests run the same code path. |

## 6. UX

- Unlock dialog: "Unlock with passkey" as the primary action when the
  repository has entries and the browser supports PRF. "Use password" stays
  visible at all times.
- Settings, per repository (only when unlocked): list of passkeys, with
  "Add passkey" and "Remove" actions. Removal is a save and needs no
  password.
- User cancellation of the browser prompt is not an error. It returns to the
  password prompt.
- Error text is fixed and generic (invariant 9): no authenticator details.

## 7. Browser support

PRF is available in recent Chromium (desktop and Android), Safari on macOS and
iOS, and in some Firefox configurations. **This is from memory and must be
checked against current compatibility tables before release.** The app must
detect PRF at enrollment (the `prf.enabled` result and a real PRF output) and
hide the feature where it is not supported. It must never leave a repository
with a passkey entry that cannot be used on the device that created it.

## 8. Implementation plan (later PRs)

1. Spike: age X25519 identity round-trip in the worker; WebAuthn PRF with a
   Chromium virtual authenticator (CDP `WebAuthn` domain, `hasPrf`).
2. `src/lib/passkeys.ts` (WebAuthn and PRF, browser only) and the wrap/unwrap
   functions, next to `filenames.ts`. Nothing imported by `app/api/**`.
3. `.gitcloak` 1.2: the `passkeys` field in `gitcloak.ts`, the validator in
   `validation.ts`, and mock parity.
4. A `usePasskeys` hook, so `client-page.tsx` does not grow (section 6 of the
   architecture).
5. Tests: unit (wrap/unwrap round trip with a fixed PRF vector, tampered
   ciphertext, wrong credential, validator rejections); e2e with the virtual
   authenticator (enroll, lock, unlock by passkey, password fallback, removal,
   unsupported-browser path).
6. Docs: amend invariant 4 with the exception (in the same PR as the code),
   section 6 (format), section 9 (gap 3 note), README security model.
7. Headers: no CSP change (no new origin). Confirm that `Permissions-Policy`
   does not block WebAuthn; the current policy does not list it.

## 9. Alternatives considered

- **Multi-recipient age with a FIDO2 plugin** (for example
  `age-plugin-fido2-hmac`): needs recipient mode, changes the file format and
  re-encrypts every file. Rejected.
- **Wrapped password stored server-side:** needs a database (section 6 forbids
  state) and gives the server a copy of a secret-derived value. Rejected.
- **Wrapped password in browser storage:** forbidden by invariant 2. Rejected.
- **Passkey as a second factor on top of the password:** safer, but the request
  is to unlock without the password. Kept as a possible fallback.

## 10. Decisions needed

1. **Approve the invariant 4 exception**: a password wrapped in the repository
   and unwrapped by a passkey. Recommendation: approve, with this design.
2. **Passkey as an alternative unlock, password kept as mandatory recovery.**
   Recommendation: yes.
3. **PRF required, no fallback to a weaker mechanism.** Recommendation: yes.
   Browsers without PRF see the password flow only.
4. **Is gap 3 (`.gitcloak` pinning) a prerequisite?** This design does not
   depend on it, but the whole-file replacement risk it describes still exists.
   Recommendation: do not block on it, but track it.
5. **Age X25519 wrapping, or the AES-GCM fallback**, once the spike in §3 has
   answered whether the first option works.
