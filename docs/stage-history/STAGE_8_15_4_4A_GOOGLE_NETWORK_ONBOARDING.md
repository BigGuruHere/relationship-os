# Stage 8.15.4.4a - Google Sign-up for Network Invitations

**Migration required: No.** No Prisma migration, schema change, or `prisma generate` required.

## Purpose
Allow a new participant to create a Relish account using existing Google OAuth while preserving the original Network invitation. Return to the invitation for explicit Connect confirmation. Existing password registration and login remain available.

## Changes
- Registration page now offers **Continue with Google** with an allowlisted `next` path.
- Network invitation page offers Google directly alongside account creation and existing-account login.
- Login page passes the valid invitation `next` value to Google.
- Google OAuth start verifies `next` against `safeNetworkJoinReturn`, stores it in a short-lived HttpOnly OAuth cookie and clears prior return context when absent.
- Callback validates the return cookie, clears it with OAuth temporary cookies and returns to the invitation after authenticating. Without a valid invitation, OAuth still redirects to `/`.
- All existing Google account creation/linking and existing authentication checks are reused, including state, nonce, PKCE and ID token verification.

## Local tests
```powershell
npm run check:stage8.15.4.4a
npm run check:stage8.15.4.4
npm run check
```

## Browser acceptance tests
1. Signed in as A, copy A's Personal Network profile URL.
2. In a private browser not signed into Relish, open A's profile and select Connect on Relish.
3. Choose Continue with Google; use a Google account never previously associated with Relish.
4. Confirm return to A's invitation and click Connect explicitly.
5. Confirm A appears in the newcomer's Network and the newcomer appears in A's Network.
6. Repeat using Google on the Create account screen; ensure the original invitation survives.
7. Repeat with an existing Google-linked Relish account, and ensure no duplicate account/connection.
8. Start Google from `/auth/login` without any `next`: should still land at the normal home.
9. As a member, confirm `/settings/users` and privileged ContextSpace routes remain denied.
10. Confirm Business/Dating and email-password signups still work as before.

## Verification status
- Source-level Stage 8.15.4.4a tests: 3 passed.
- Previous Stage 8.15.4.4 source tests: 4 passed.
- Svelte compiler / real Google OAuth / browser integration tests: not run in package environment.

## Scope
This does not introduce provisional guest access, direct Google profile sharing, Dorian or a new identity system. Google Cloud OAuth redirect URI and credentials must already be configured for the current environment. A Google identity is resolved through the existing callback; invitation is not permission to read private information.
