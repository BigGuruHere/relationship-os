# Stage 8.15.4.4 - Account-based Network Participant Onboarding

**Migration required: No.** Database schema and previously applied migration files are unchanged.

## Scope

- The public Personal profile has an explicit **Connect on Relish** route for logged-out visitors.
- `/network/join/[slug]` presents the inviter's public name. Signed-out visitors can register or sign in with a safe invitation return path. Once signed in, they confirm the connection.
- The confirmation provisions the visitor's own General ContextSpace when necessary, then reuses the existing Stage 8.15.4.3 `createNetworkConnection()` write path and its idempotent origin record. The inviter's own General ContextSpace must exist.
- The join endpoint takes neither owner IDs nor context IDs from form submissions. It re-resolves the inviter's Personal profile and uses the authenticated visitor identity. The signed-in visitor must explicitly confirm connection.
- Existing Business profile guest capture remains separate. The existing login/register default behaviour is unchanged without a valid `next` parameter.

## Local commands

```powershell
npm run check:stage8.15.4.4
npm run check:stage8.15.4.3a
npm run check
```

**Do not run `prisma migrate dev` for this stage.** No local build command is required.

## Manual UI acceptance

1. Existing inviter A creates/shares a Personal profile and has a General ContextSpace.
2. In an incognito session, open A's public Personal profile and click **Connect on Relish**.
3. Choose **Create account**, register as new user C, and verify return to the same invitation.
4. Click **Connect**. Verify redirect to Network and reciprocal visibility in A's and C's Network.
5. Visit the invitation again as C, verify **already connected**, and verify no duplicate origin/contact records.
6. Open another incognito session, use the sign-in option with an existing test account, and verify the same invitation is retained.
7. Try to open your own invitation while signed in; connection must be refused.
8. Verify non-personal Business public pages retain the existing lead capture and authentication behaviour.
9. Verify an invalid `next` query on sign-in and registration cannot redirect to an external site.
10. Verify neither side can read the other's private notes, interactions or Living Understanding.
11. Verify guest/member users cannot access `/settings/users`, `/settings/context-spaces` or `/general/people`.

## Verification limits

Four stage 8.15.4.4 source-level tests and four stage 8.15.4.3a regression source-level tests passed during packaging. These tests do **not** prove database, browser or privacy correctness. No dependencies were available to run `npm run check` here. Complete the local compiler and browser tests before deploying or inviting external pilot users.

## Deliberately deferred

- Anonymous/provisional guest identity and account claiming.
- Google OAuth invitation preservation and other identity providers.
- Email verification and comprehensive signup-abuse controls.
- In-app Dorian conversational onboarding and governed Living Understanding intake.
- Full cross-user/legacy API security and audited permission changes.
