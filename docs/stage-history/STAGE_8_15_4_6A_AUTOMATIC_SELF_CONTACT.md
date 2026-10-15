# Stage 8.15.4.6a: Automatic Self-contact Compatibility Bridge

## Purpose
Remove the requirement for a Network participant to manually create a linked self-contact before starting Dorian, without introducing a second Person identity or changing the existing interaction/Living Understanding pipeline.

## Implementation
- Added `src/lib/server/core/networkSelfContact.ts` with `ensureNetworkSelfContact()`.
- Validates that the authenticated account owns the `general` ContextSpace and has a canonical `User.personId`.
- Reuses one self-linked Contact, repairing only a missing `personId` link. Rejects mismatched canonical identities.
- Creates a new encrypted, minimal Contact when none exists, linked to the same User and Person. Uses the existing `[userId, contextSpaceId, linkedUserId]` uniqueness constraint to resolve concurrent creation.
- Hooks both shared Dorian session launch and participant-owned Dorian entry into the same compatibility helper.
- No new Person, account, migration, permissions or Living Understanding pipeline created.

## Important boundaries
- This is a technical compatibility Contact inside the participant's *own* General ContextSpace, not a publicly visible Person identity, relationship or consent to share.
- A missing canonical Person identity or inconsistent self-contact fails closed rather than silently creating an unverified identity.
- Creating the Contact does not prove the ElevenLabs widget can launch or its signed callback returns the session token. These remain live tests.
- The Contact is not presently hidden from every legacy Contact admin view. We are only keeping it out of the purpose-built Network connection list, which is derived from connection records.

## Local commands
**Migration required: NO.** No database migration is introduced.

```powershell
npm run check:stage8.15.4.6a
npm run check:stage8.15.4.6
npm run check
```

## Acceptance tests
1. Authenticate as a new user with a canonical `personId` and their own General ContextSpace. Open Network > Dorian, click Start session. Verify one self-contact is created, with `linkedUserId = User.id` and `personId = User.personId`.
2. Start Dorian again. Verify the same self-contact is reused; no duplicate appears.
3. Verify the inviter's ContextSpace and records remain unchanged.
4. With a test user having a different `personId` on an existing self-contact, verify launch is blocked rather than changing that identity link.
5. Verify a user with no canonical `Person` link does not receive a session, and diagnose onboarding identity provisioning separately.
6. For two users, verify independent session records and post-call transcripts stored only under the matching user and General ContextSpace.
7. Check ElevenLabs webhook signatures, session-token round-trip, valid conversation ID matching and duplicate callback handling before any outside pilot.

## Test status
- 4 source-level tests for this stage passed.
- 3 previous shared-Dorian source tests passed.
- Prisma/client compilation, DB-backed concurrency/ownership and live ElevenLabs tests not run here.

## Deliberate architecture checkpoint
After 3–5 consenting pilot participants have completed first and return conversations, review whether Contact compatibility should be replaced by direct `User`/`Person` and `GovernedUnderstandingScope` references. Do not migrate identity or LU source custody without database integration tests and migration planning. Revisit identity linking, evidence/revisions, cross-ContextSpace authorisation, and product usability before expanding pilot.
