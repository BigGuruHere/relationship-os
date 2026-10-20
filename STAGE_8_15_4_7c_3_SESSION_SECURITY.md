# Stage 8.15.4.7c.3 - Session Security and Two-Caller Custody

## Scope
This is a small, pilot-focused hardening increment based on 8.15.4.7c.2. It does not perform the deferred person-centred architectural redesign.

## Changes
- Session resolver now rejects empty/whitespace-only and oversized conversation IDs before a session can be claimed.
- Added an opt-in development PostgreSQL test for token lookup, session-to-conversation binding, expiration state and two-caller custody checks when a second real provisional caller already exists.
- Added structural regression checks for token/session safeguards and safe database test cleanup.
- Existing advisory-lock transcript storage and evidence attachment logic is retained unchanged.

## Important limits
- The database script tests the stored state and database queries, rather than invoking the signed ElevenLabs HTTP webhook end-to-end. In particular, it does not prove full webhook retry idempotency or actual token rejection through the HTTP endpoint.
- The cross-caller check is skipped if only one provisional caller exists in the DEVELOPMENT database. The script does not create real provisional identities.
- No production database queries were run in the development environment used to produce this package.
- The user should verify the complete webhook retry flow with two real or carefully controlled test calls before inviting external pilot participants.

## Installation
1. Commit or back up the current working project.
2. Unzip the complete archive. Copy the CONTENTS of `relationship-os-master` into `C:\Users\teren\Coding\RelationshipOS`, replacing existing project files. Do not nest the folder.
3. Keep local `.env` and credentials intact.
4. Run `npm run check:stage8.15.4.7c.3`, then `npm run check`.
5. No Prisma migration is required. Do not run `npx prisma migrate dev` for this increment. No local production build is required.

## Optional development database test
Confirm the `.env` and any existing PowerShell `DATABASE_URL` are pointing at DEVELOPMENT. The Node `--env-file` argument does not override an already-set environment variable.

```powershell
# Explicitly permit writing temporary sessions to the DEVELOPMENT database only.
$env:ALLOW_RELISH_PHONE_DEV_DB_TEST = 'YES'
$env:RELISH_DB_ENV = 'development'

try {
    # Run guarded development database tests.
    node --env-file=.env --import tsx scripts/check-stage8-15-4-7c-3-session-security.ts
}
finally {
    # Remove the temporary permissions even if a test fails.
    Remove-Item Env:ALLOW_RELISH_PHONE_DEV_DB_TEST -ErrorAction SilentlyContinue
    Remove-Item Env:RELISH_DB_ENV -ErrorAction SilentlyContinue
}
```

A single existing provisional caller supports three tests. A second caller unlocks the separate cross-context custody check.

## Manual live checks before pilot
1. Make a call from the existing development telephone number. Confirm initiation and import.
2. Make a second call, confirm continuity, and verify the imported source belongs to the same context.
3. Use a different telephone number to create a second provisional participant. Check that the User, Contact, Person and ContextSpace identifiers differ in redacted diagnostic outputs.
4. Re-run the guarded development database test to verify the two-caller isolation check.
5. Verify the webhook is idempotent on an authorised duplicate delivery, and rejects a missing/mismatched session rather than writing into the agent deployment owner's context. Do not replay signed payloads containing credentials outside a controlled DEVELOPMENT environment.

## Verification at package creation
`node --test tests/core/stage8-15-4-7c-3-session-security.test.mjs tests/core/stage8-15-4-7c-2-database-guard.test.mjs`: 6 passed, 0 failed.
`npm run check` and the Neon development-database test were not run in the packaging environment due to unavailable installed dependencies and database credentials.

## Migration required
No.

## Next
Close out any live webhook retry or cross-caller failures before Stage 8.15.4.7d (Conversational Continuity). Keep the 3-5-person external pilot as the overriding priority.
