# Foundation implementation and user rollout

Date: 2026-11-03. Status: stage 1 documentation delivered on a feature branch; stages 2-7 planned. No new schema, migrations or runtime changes in this deliverable. Work items below are repository backlog identifiers, not GitHub issue numbers or claims of implementation.

## Release sequence and evidence gates

| Stage | User outcome | Engineering work | Release gate |
| --- | --- | --- | --- |
| 1: design | Clear direction | Domain, decisions, policy, implementation backlog and developer guidance | Documentation reviewed and merged; physical design questions explicitly queued |
| 2: foundation | Internal proof, no new-user rollout yet | Additive schema, identity/auth isolation, policy, evidence and subject services | Private end-to-end slice plus adversarial custody tests and migration rehearsal |
| 3: invited pilot | Share details, remember a person, record and retrieve a note | Adapt current UI onto one new authoritative domain path | Mobile DEV journey, failure recovery, restore rehearsal and privacy operations verified |
| 4: continuing sharing | Claim exchange and receive authorised profile updates | Secure claims, directional grants, restricted projections, unlink/revoke | Full lifecycle and abuse/race tests; no private-note exposure |
| 5: private understanding | Recall useful information across one's relationships | Evidence-backed statements, correction, private retrieval; owner-private relationship understanding | Source inspection/correction works; retrieval boundaries verified |
| 6: relationship understanding | Explore relationship patterns and commitments | Selected contributions, separate perspectives, versioned joint acknowledgement | No inference presented as agreement; no hidden disclosure |
| 7: permissioned discovery | Explore support and introductions across accounts | Approved discovery projections and introduction protocol | Current permission at search and delivery; withdrawal and usefulness demonstrated |

Stages are dependency gates, not dates. Invite a small, explicitly selected cohort at stage 3; expand after support and observed failures are manageable. Existing pilot flows remain available, with their current limitations, while stages 1-2 are built. Do not represent legacy cohorts as using the new foundation. Dorian voice infrastructure can continue independently, but new ingestion must not silently write both domain models.

## Stage 2 backlog: base architecture

| ID | Dependency | Source touchpoints / proposed work | Acceptance evidence |
| --- | --- | --- | --- |
| F-201 Physical design and inventory | Stage 1 | Inspect `prisma/schema.prisma`, migrations, `src/lib/server/core/{identity,accessPolicy,contextSpace,relationshipRepository}.ts`, all auth claim hooks. Draft exact model/constraint mapping and legacy/new ownership matrix. Inventory data counts/ownership with authorised non-content queries, not exports. | Reviewed model diagram and field definitions; custody, typed subjects, relationship participation, identity-link reversal and deletion semantics specified; no destructive assumptions |
| F-202 Additive schema and migration rehearsal | F-201 | New foundation primitives in Prisma/migrations: private people, protected person/relationship subjects, perspectives, source versions and segments; minimal statement/derivation support. Reuse User/Person only where semantics fit. Defer full discovery/grant machinery to its stage. | Migration applies to isolated representative DB, constraints reject invalid references, restore/retry demonstrated; legacy rows/IDs unchanged |
| F-203 Isolate account provisioning | F-201, before cohort activation | `src/routes/auth/register`, `login`, `google/callback`, magic-link and identity-claim entry paths; `src/lib/leads/link.ts`; `src/hooks.server.ts`. Explicit server-side cohort/domain dispatch and idempotent new-domain provisioning. | Password/Google/other supported entry paths tested; new cohort does not trigger legacy reciprocal-contact claims; legacy behaviour deliberately preserved |
| F-204 Domain policy and repositories | F-202 | Proposed `src/lib/server/foundation/` policy/people/relationships/evidence modules; reuse encryption primitives and existing custody test cases. | All reads/writes/jobs resolve authority on server; forged IDs and cross-owner references fail, including relationship member metadata |
| F-205 Evidence and understanding subject slice | F-204 | Adapt concepts from `core/interactions.ts`, `noteRevisions.ts`, `datingTranscriptImport.ts`, `knowledgeSuggestionQuality.ts`; do not repoint legacy LU tables without migration design. | One source can concern a person and a relationship; perspective distinct from subject; correction preserves anchors; segment cannot reveal parent source |
| F-206 Internal integration and transition rehearsal | F-203, F-205 | Thin route/service integration using representative accounts; pin an authoritative storage path per cohort. | Create person -> source -> supported statement -> read/correct; unauthorised second account denied; legacy Brokerage/capture regression evidence; documented rollback |

F-201 must settle physical naming, whether existing Person is reused, subject-reference constraints, encryption/index strategy, account/record deletion, and how new-domain account membership is persisted. These are bounded implementation decisions, not gaps to fill through ad hoc route code. Bring changes to accepted product semantics back for a decision. Development database migration execution and any live deployment still require the authorisation specified in AGENTS.md.

## Stage 3 backlog: simplest usable release

| ID | Dependency | Existing surface to adapt | Acceptance evidence |
| --- | --- | --- | --- |
| P-301 Directory and person details | F-206 | `src/routes/people`, existing directory/notes UI; adapt service boundary rather than duplicate pages | Manual create/search/open works with owner scope; no compulsory context label; uncertain duplicates remain distinct |
| P-302 Public exchange intake | F-206 | `src/routes/u/[slug]`, `share-details`, `core/contactCapture.ts`, `profileOnboarding.ts` | Three-screen flow, vCard, Send/Skip, consent, abuse controls and repeat-visit behaviour preserved; one authoritative capture write; no accidental account link |
| P-303 Notes and retrieval | P-301 | `src/lib/recording/ContactNoteForm.svelte`, relevant recording/upload/transcription endpoints, evidence service | Text/voice edit-save-refresh works; recording/transcription/storage failures recover without false success or duplicate notes |
| P-304 Profile/auth continuity | F-203, P-302 | `/profiles`, `/settings/profile`, `/share`, auth return/draft flow | Existing public URLs and independent profile selection work; new signup profile remains unpublished until review; draft grants no identity authority |
| P-305 Operations and privacy readiness | P-301..304 | Account/record access-removal paths, structured redacted diagnostics, backup/restore and support runbook | Account export/deletion behaviour and retention explained/tested; real restore rehearsal; no raw private data in logs; operator can diagnose failure |
| P-306 DEV acceptance and invited rollout | P-305 | Existing tests and browser scripts, expanded for actual new-domain operations | Node 22 checks; relevant integration/security tests; iOS/Android QR/download/notes checks; separate legacy Brokerage regression; explicit deployment approval and release record |

Start user feedback with task completion, time to first saved person/note, repeat retrieval, failures/duplicates and qualitative usefulness. Collect only necessary telemetry; do not record private note content. Expand based on verified outcomes rather than a fixed signup target. A serious access violation, unrecoverable data loss or unsafe claim behaviour stops expansion and the affected capability.

## Migration and rollback strategy

1. Inventory existing data and dependent jobs; preserve legacy Brokerage by default. Keep authentication identity separate from domain enrolment.
2. Use additive migrations first. Rehearse on isolated representative data and record backup/restore evidence before authorised DEV execution.
3. Activate new-domain routing for explicitly enrolled accounts/capabilities; persist the choice server-side. Anonymous captures resolve the profile owner's domain, not a caller-provided flag.
4. For any migrated private pilot record, retain a protected legacy-to-new mapping, original IDs/provenance, counts and verification evidence. Copy idempotently under a controlled write pause or explicit handoff; then select one writer. Brokerage is excluded unless separately requested.
5. Before new writes, rollback can disable the cohort switch. After new writes, do not route users back to stale legacy storage: disable affected writes, retain access through the compatible reader where safe, and roll forward or perform a separately tested reverse migration. Never drop new tables as routine rollback.
6. Keep compatibility adapters until consumers and background jobs are accounted for. Retirement is a separate approved task with retention and restoration decisions.

## Documentation and stage completion

Each item updates current state and this item's status in the same implementation PR. Record branch/commit, tests actually run, migration requirement, rollout/cohort scope and remaining limitations. At merge update the integration status; at deployment record environment, deployed commit, migration version, smoke evidence and rollback route. Merge is not deployment.

Use the [developer guide](DEVELOPER_GUIDE.md) for PR evidence. Stages 4-7 get a source-grounded backlog before implementation; they are not permission to build the full future system during stages 2-3.

## Stage register

| Stage | Designed | Implemented | Validated | Merged | DEV / PROD |
| --- | --- | --- | --- | --- | --- |
| 1 | This documentation package | Documentation only | Documentation checks recorded in PR | Pending | No deployment applicable |
| 2 | Logical design; F-201 physical design pending | No | No | No | Not deployed |
| 3 | Backlog and gates | New-domain path not implemented; legacy UI exists | No new-domain validation | No | Not deployed |
| 4-7 | Direction and gates only | No | No | No | Not deployed |
