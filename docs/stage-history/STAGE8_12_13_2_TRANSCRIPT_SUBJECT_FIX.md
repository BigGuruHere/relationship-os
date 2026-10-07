# Stage 8.12.13.2: workspace transcript constraint fix

## Root cause
`Interaction_subject_required` from Stage 8.4 required a contact, Person or Company on **every** Interaction. Stage 8.12.13 correctly left all three nullable for a full multi-speaker conversation but did not update the constraint. The PostgreSQL 23514 error occurs before any person-level excerpts are saved.

## Fix
A narrow migration allows only `DATING_CONVERSATION_TRANSCRIPT` originals with `WORKSPACE` source type and the importer external reference prefix to omit an individual subject. All ordinary interactions continue to require a subject. The original's encrypted content remains in the owned Dating ContextSpace, and each included person's excerpt still has its own contact. Existing custody triggers remain intact.

The transcript parser also ignores a **leading** `Conversation Transcript:` export heading as a speaker without removing the heading from the encrypted original. Select "Do not extract this speaker" for `Agent` when speaking to an AI agent. The original transcript still records both sides.

## Safety and compatibility
- **New migration:** `20260927110000_stage8_12_13_2_transcript_subject_constraint`. Apply ONLY to the intended development database first.
- No changes to existing data, encryption keys, lockfile, ordinary CRM write logic or previous migrations.
- Failed original import is expected to have been rolled back by the transaction. Reimport normally once migration is applied; the importer is idempotent when a matching original already exists.
- No person-led sharing, AI-processing consent or cross-context access is added.

## Verification performed during packaging
- 108 JavaScript/MJS regressions passed.
- ZIP integrity verified.
- No dependencies installed here: full `npm test`, `npm run check`, build, migration execution, live DB integration and browser workflow require the user's DEVELOPMENT environment.

## Mac installation
Unzip the replacement ZIP into a NEW folder and compare to your existing project. Back up any uncommitted code and preserve your `.env`, keys, uploads and databases. Never point these commands at production. In the new project folder:

```bash
npm ci
npx prisma validate
npx prisma migrate status
# After CONFIRMING that DATABASE_URL targets the intended development database:
npx prisma migrate deploy
npx prisma generate
npm run check:stage8.12.13.2
npm test
npm run check
npm run build
npm run dev
```

Optionally, only with a known disposable development fixture and explicit authorisation, run the added DB test:

```bash
ALLOW_DATING_DEV_DB_TEST=YES node --env-file=.env --import tsx scripts/check-stage8-12-13-2-transcript-db.ts
```

Requires `DATING_TEST_USER_ID` and `DATING_TEST_CONTEXT_SPACE_ID` already defined in the development environment. Do not set the authorisation flag on production.

In the browser, paste a transcript beginning `Conversation Transcript:` with `User:` and `Agent:` turns. Preview should show exactly User and Agent. Map User to your private Dating contact, choose **Do not extract this speaker** for Agent, confirm retention permission and save. Expect an encrypted original and a private excerpt for User. AI extraction remains a separate opt-in step.
