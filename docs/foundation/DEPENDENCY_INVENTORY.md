# F-201: existing dependency and data inventory

Date: 2026-11-04. Baseline: development `d789464b67dd36524e637e8c35f3610f5ffce278` (PR #13 merge). Source inspection only unless explicitly noted. The repository contains 103 Prisma models and 106 migration SQL files at this baseline; these are file counts, not deployed migration or database row counts.

## Inventory coverage and limits

The source inventory below covers foundation-relevant models, authority enforcement, authentication, capture, notes, understanding and background/provider boundaries. It is not an audit of every route in the application. No DATABASE_URL or DIRECT_URL is configured in this execution environment. No database query, record export, decryption or migration was performed. Do not infer an empty database from the reported lack of real new-product users.

| Evidence | Result |
| --- | --- |
| Development source and migration history | Inspected at the baseline above |
| New-domain schema | F-202 merged via PR #15; operator-confirmed DEV deployment/migration and rehearsal are recorded in [the evidence](F202_INVARIANTS.md). PROD remains unverified. |
| DEV/PROD schema and migration parity | Unverified |
| User/Profile/Contact/Interaction counts | Unverified |
| Private vs Brokerage custody volumes | Unverified |
| Legacy identity-link anomalies | Unverified |
| Backup/restore and deletion readiness | Unverified; release gate, not source-code assumption |
| Read-only inventory query | Prepared in [inventory-readonly.sql](../../scripts/foundation/inventory-readonly.sql); not executed against a database |

Run the aggregate script on each explicitly authorised target with a read-only role and a consistent snapshot. It selects fixed labels/counts only, uses timeouts and ends with ROLLBACK. No names, IDs, contact values or transcripts are output. Missing tables/columns/timeouts invalidate the run. Record environment, date, deployed commit, operator and result completeness; keep actual inventory results access-controlled. Do not commit connection strings or operational record exports. Actual counts and anomaly assessment are required before target migration or cutover, but do not prevent designing and rehearsing an additive schema on isolated fixtures.

## Retain, adapt, isolate or replace

| Area | Actual dependency | Decision / next task |
| --- | --- | --- |
| User, Session, OAuthAccount, MagicToken, Profile | Account/session/profile ownership | Retain; new enrolment dispatch belongs in F-203, not client redirects |
| Person, User.personId | Legacy neutral identity node; registration and Google provision Person | Retain for compatibility; FoundationSubject is independent and no legacy match is promoted to verified identity |
| ContextSpace and default-space User trigger | New User gets legacy default custody through SQL; UI hooks resolve domain space | Preserve trigger in F-202. Empty legacy space on new account is compatible metadata, not a foundation vault |
| Contact and related commercial records | Private/CRM fields, Lead/contact account links, deals and companies | Legacy authority unchanged. New person directory maps to FoundationSubject PERSON only through explicit cutover |
| Interaction, KnowledgeClaim/Evidence | Owner/context/Contact and optional Person references | Reuse parsing, encryption and provenance concepts; new evidence has its own versions/segments |
| Relating/RelatingParticipant | Existing private multi-participant history; Contact/company participants | Preserve; new relationship subject/membership does not silently repoint these IDs |
| GovernedUnderstandingScope | SELF/PERSON_VIEW/RELATIONSHIP_VIEW but Contact/Relating custody FKs | Retain legacy. New statement subjects replace dependency on Contact-bound LU for foundation consumers |
| LU revisions/topic identities/topic versions | Required contactId and compound custody keys | No in-place nullable-column conversion. New statement versions and supports are separate persistence |
| Public Profile | Public fields, slug, user ownership, isPublished | Reuse profile URLs/editor. Restricted sharing requires later explicit grants/projections |
| Browser onboarding/share receipts | Bounded encrypted cookies, no identity authority | Preserve UX; never use as secure claim proof |

## Entry-point and side-effect matrix

| Source path | Current behaviour relevant to transition | Required boundary |
| --- | --- | --- |
| `src/routes/auth/register/+page.server.ts` | Creates User, nested Person/profile, then calls linkLeadsForUser | Establish enrolment policy before legacy claim; preserve unpublished onboarding review |
| `src/routes/auth/login/+page.server.ts` | Authenticates and invokes legacy Lead linker | Enrolled accounts cannot trigger legacy reciprocal claims merely by login |
| `src/routes/auth/google/callback/+server.ts` | Provisions account/profile and invokes same linker | Resolve server enrolment through callback/account; retain OAuth state validation |
| `src/routes/api/auth/magic-link/+server.ts` | Magic-link flow invokes linker | Cover this API as well as the `/auth/magic` page; do not assume there is one auth entry point |
| `src/routes/auth/magic/+page.server.ts` | Separate magic-token path | Test provisioning/session path even though direct linker call is in the API flow |
| `src/routes/api/guest/claim-linkedin/+server.ts` | Calls linkLeadsForUserFlexible with submitted LinkedIn URL | Explicit legacy gate; new-domain identity must not use URL equality as claim evidence |
| `src/lib/leads/link.ts`, `src/lib/leads/reciprocal.ts` | Claims pending Leads by indexes, updates original-owner Contact.personId/linkedUserId, creates reciprocal Contacts | Keep only within legacy workflow. Audit shared callers, not just one registration function |
| `src/hooks.server.ts`, `src/lib/server/core/contextDomain.ts` | Session/capability checks, domain ContextSpace selection and AsyncLocalStorage custody | Add explicit foundation access resolution for selected routes; preserve legacy route capabilities |
| `src/lib/db.ts`, `src/lib/server/core/contextSpace.ts` | Prisma extension scopes listed legacy models; inherited children and named cross-owner operations have specific guards | New models are not automatically protected. New guard registry and transaction/nested-write tests required in F-204 |
| `src/lib/server/core/contactCapture.ts` | Public owner resolution, advisory lock, receipt idempotency, rate limits, private Contact + Interaction transaction | Route from profile owner's persisted enrolment, retain protections, write only one model |
| `src/routes/u/[slug]/share-details/+page.server.ts`, `src/lib/server/profileOnboarding.ts` | Three-screen sharing/signup convenience | Adapt service boundary; no new forms, no identity inference |
| `src/routes/people/[id]/notes/new/+page.server.ts` | Saves Interaction with STORED_ONLY and no embedding | Preserve admission default when writing new Source/Version; no automatic AI use |
| `src/lib/recording/ContactNoteForm.svelte`, `src/routes/people/api/` | Shared recorder, chunk upload, transcription polling and diagnostics | Retain UX; audit owner/domain on chunks/jobs/results and summary calls before switching saves |
| `src/lib/server/core/noteRevisions.ts` | Legacy note revisions and evidence/custody handling | Reuse lessons; don't write new versions back into legacy note lineage |
| `src/lib/server/datingTranscriptImport.ts`, `src/lib/server/knowledgeSuggestionQuality.ts` | Speaker/turn excerpts and exact quote validation | Adapt segment anchors and attribution checks; not a general sharing permission system |
| `src/lib/server/core/automaticLivingUnderstanding.ts`, `phoneUnderstandingAutomation.ts`, `conversationIngestion.ts` | Existing LU/voice ingestion pipeline | Remains legacy until a specific adapter migrates it; preserve existing session destination |
| `src/lib/server/core/agentDataAccess.ts`, `agentMemory.ts`, `scopedRepository.ts` | Existing agent entity permissions and scoped retrieval | Do not include new tables in agent projections implicitly |

## Migration hazards confirmed in source

- `20260831123000_stage8_1_identity_agent_access_foundation`: seeded Person from User and populated Contact.personId through existing linkedUserId. Those historical links are not new claim evidence.
- `20260901073000_stage8_6_context_space_custody_foundation`: creates default ContextSpace on User insertion and enforces many owner/context/reference rules. Source-level field definitions alone do not capture these triggers.
- `20260901165000_stage8_6_context_default_alignment`: default custody compatibility is migration-managed. Do not disable it to simplify new-domain signup.
- `20261002010000_stage8_13_0_longitudinal_living_understanding_foundation`: contact-scoped longitudinal understanding and integrity rules. Do not repoint LU foreign keys during the first additive migration.
- `20261014160000_stage8_15_3_5_governed_understanding_scopes`: typed subject checks, compound references and source-custody triggers already exist. Reuse the enforcement pattern, not incompatible table semantics.

All named folders are under `prisma/migrations/`. Read their SQL during implementation and verify target applied state. Do not edit already-applied migration files. Add new ones and preserve the original chain.

## Data ownership and migration matrix

| Data | Authoritative system during stages 2-3 | Treatment |
| --- | --- | --- |
| Credentials/sessions/public Profile | Existing shared account layer | Retain IDs and URLs; additive enrolment only |
| Brokerage Contacts/Interactions/deals/companies | Existing legacy model | No migration, no new-domain writer |
| Existing private My People records | Legacy until explicit per-owner handoff | Inventory first; no silent empty replacement directory |
| New enrolled owner's People/notes/capture | Foundation after activation | One vault, one writer; public capture uses destination owner's routing |
| Existing Dorian/Network sessions and LU | Existing legacy model | No automatic redirection based on new UI enrolment |
| Private Contact.personId/linkedUserId | Legacy asserted links | Preserve in legacy; import only as unverified provenance if explicitly migrating |
| Later verified new-domain account links | Future FoundationIdentityLink | Claim proof/reversal, not copied legacy assurance |

Any later private-record migration needs a typed, protected mapping for each migrated kind, source IDs and idempotency. Do not put a permissive generic legacy entityId into the domain model. F-202 is additive without backfill, so it needs no mapping table. Define exact mapping FKs with the migration that needs them.

## F-202 acceptance fixture inventory

Use synthetic records with: two owners, one owner having private plus business ContextSpaces; a user with legacy Lead/reciprocal records; an owner with no private home; two unverified similarly named people; a multi-participant relationship; a multi-speaker source; a corrected note; a Contact-bound LU revision; and existing public profiles. Do not copy live private content into test fixtures.

Verify legacy counts and IDs before/after migration, including defaults/triggers. Test a user with both Brokerage access and foundation enrolment. Add direct-SQL cross-vault reference attempts, typed subject misuse, NULL-shaped lineage, concurrent version append, derivation cycles, replay and withdrawal/deletion state checks. Existing focused tests provide behavioural baselines: `tests/core/contact-capture.test.ts`, `my-people.test.ts`, `core-access-policy.test.ts`, `identity-foundation.test.ts`, `profile-onboarding.test.mjs`, and relevant stage8 custody/understanding suites. Existing failures must be assessed, not silently rewritten to pass.

## Remaining environment evidence

F-201 source inventory and physical design are delivered; operational inventory is blocked by unavailable DB access. Before any target migration, fill the aggregate inventory results, applied-migration parity, anomaly assessment and backup/restore evidence. Before cohort activation, also complete F-203 through F-206 and stage-3 operational gates. No database counts or live behaviour are claimed by this document.
