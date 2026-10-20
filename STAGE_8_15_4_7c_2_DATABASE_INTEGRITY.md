# Stage 8.15.4.7c.2 - Development Database Integrity and Caller Isolation

## Scope
Adds an explicitly opted-in DEVELOPMENT PostgreSQL verification script for existing provisional callers, along with regression guards and npm commands. Preserves the existing production telephone implementation. This is a test-enablement increment, not a claim that live database isolation or webhook replay testing has already passed.

## Code changes
- `scripts/check-stage8-15-4-7c-2-phone-db.ts`: inspects existing provisional identity-to-custody mappings; inserts disposable sessions; attempts simultaneous duplicates of an existing conversation ID; checks Postgres P2002 uniqueness, distinct sessions, and two-caller custody separation when two existing DEVELOPMENT callers are present; removes temporary sessions in `finally`.
- `tests/core/stage8-15-4-7c-2-database-guard.test.mjs`: verifies opt-in gating, scoped cleanup, and assertions are present.
- `package.json`: adds `check:stage8.15.4.7c.2` and `check:stage8.15.4.7c.2:db`.

## Installation
1. Back up/commit local changes.
2. Extract the complete source ZIP into `C:\Users\teren\Coding\RelationshipOS`, preserving `.env` files and any newer local changes.
3. No Prisma migration required. Do not run `npx prisma migrate dev` for this stage.
4. No local build is required.

## Automated local tests
```powershell
npm run check:stage8.15.4.7c.2
npm run check
```

## Development database verification (optional but important)
Confirm `.env` points to the **Neon DEVELOPMENT** database, not Railway production or Neon production. Do not run if uncertain. The script is intentionally write-capable: it creates temporary session rows and deletes its own rows afterwards.

```powershell
$env:ALLOW_RELISH_PHONE_DEV_DB_TEST = 'YES'
$env:RELISH_DB_ENV = 'development'
node --env-file=.env --import tsx scripts/check-stage8-15-4-7c-2-phone-db.ts
Remove-Item Env:ALLOW_RELISH_PHONE_DEV_DB_TEST
Remove-Item Env:RELISH_DB_ENV
```

Run from PowerShell in the project root. If `DATABASE_URL` is already populated in the shell, verify it is DEVELOPMENT. The script does not auto-detect database purpose from its hostname. It refuses to run without both opt-in variables, and also refuses when `NODE_ENV=production`.

Requires at least one existing provisional telephone caller and an active ElevenLabs binding. A second provisional caller is required to perform the two-caller separation assertion. It never creates or deletes Users, Contacts, Persons, ContextSpaces, transcript sources, or authoritative understanding.

## What has and has not been established
- Local check: six focused static tests passed (three new, three from previous increment).
- Database tests: not run here because no DEVELOPMENT Neon connection was provided. Do not treat them as passed yet.
- `npm run check`: not run here because project dependencies are not installed. Run locally.
- The script tests DB uniqueness constraints and existing row-level identity consistency. It does NOT exercise actual webhook requests, session-resolution token replay, duplicate transcript ingestion, simultaneous first-call identity provisioning, or PostgreSQL custody triggers from production request paths.

## Follow-on acceptance testing
1. Confirm DB script passes with two distinct DEVELOPMENT callers.
2. Replay the same signed webhook through the development proxy and verify exactly one transcript original and one participant source.
3. Attempt mismatched session token/conversation ID and verify fail-closed handling.
4. Test simultaneous first calls for the same new number in DEVELOPMENT only.
5. Confirm cross-caller isolation end to end.
6. Resolve called-number binding before multi-number deployment.

## Status
Increment 8.15.4.7c.2 source and test harness delivered. Full Stage 8.15.4.7c pilot security acceptance is **pending** live end-to-end validation.
