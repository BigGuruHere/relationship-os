# Stage 8.15.4.7c.1 - Telephone Pilot Hardening: Session Race and Logging

## Scope
Focused first increment of Stage 8.15.4.7c against the supplied 8.15.4.7b.2 source baseline. No Person/User/Contact/ContextSpace redesign, no changed authentication policy, and no schema migration.

## Changes
1. Provisional telephone initiation now catches Prisma P2002 when competing requests attempt to bind the same ElevenLabs conversation ID. The losing request returns `null` and receives the pre-existing generic `UNRESOLVED` response, rather than producing an avoidable HTTP 500 or minting a second usable token. The unique `NetworkDorianSession.conversationId` database constraint remains the authoritative arbiter.
2. Initiation and post-call diagnostics log only presence flags for phone and provider-user identifiers, not their actual values. Request path replaces full URL to reduce accidental query-string disclosure.
3. Refreshed one obsolete Stage 8.15.4.7 test expectation that still described the pre-provisional anonymous flow. Added Stage 8.15.4.7c regression assertions.

## Verification
- Ran `node --test tests/core/stage8-15-4-7b-phone-provisional.test.mjs tests/core/stage8-15-4-7-phone-ingress-safety.test.mjs tests/core/stage8-15-4-7c-pilot-hardening.test.mjs`: 11 passed, 0 failed.
- These tests are static/structural, not live database tests. There were no installed `node_modules`, no Neon connection, and no live Telnyx/ElevenLabs traffic in the review environment.
- **NOT VERIFIED:** Full `npm run check`, live DB concurrency, transaction isolation, provider retries, runtime TypeScript, cross-caller abuse test, actual deployment number binding.

## Database migration
**No migration required.** Do not run `npx prisma migrate dev` for this stage.

## Local installation
1. Back up current project folder or commit your local work.
2. Extract the complete ZIP over your `C:\Users\teren\Coding\RelationshipOS` folder, preserving your existing `.env` files and any files you intentionally changed after the supplied archive.
3. Run `node --test tests/core/stage8-15-4-7b-phone-provisional.test.mjs tests/core/stage8-15-4-7-phone-ingress-safety.test.mjs tests/core/stage8-15-4-7c-pilot-hardening.test.mjs`.
4. Once dependencies are available, run `npm run check` and the relevant local tests.
5. Smoke-test first and returning calls in DEV before deploying to production.

## Remaining 8.15.4.7c acceptance work
- Real Neon database integration tests for concurrent initiation, idempotent webhook replay, cross-caller isolation and boundary checks.
- Called-number-to-binding setup and verification (`CALLED_NUMBER_NOT_BOUND`).
- Session expiry and late post-call delivery policy; resilience of short/empty calls.
- Assess any sensitive diagnostics outside the two modified endpoint fields.
- Review production safety and credentials before external pilot.

**Status:** Partial Stage 8.15.4.7c implementation, not pilot-ready signoff.
