# Stage 8.6 - ContextSpace Custody Foundation

## Purpose

Stage 8.6 separates account ownership from knowledge custody.

- `Person` answers who the identity is.
- `User` remains the account/owner/tenant.
- `ContextSpace` answers where relationship knowledge is held.

This release is structural only. It does not add cross-context sharing, consent, matching, progressive disclosure, or a context-switching user interface.

## Compatibility strategy

Every existing User receives exactly one default `ContextSpace` whose `id` is the existing `User.id`.

All existing context-owned rows are backfilled to that deterministic default space. This preserves current Workspace behaviour while making a future second context structurally distinct.

Existing application code may continue to operate against the default Workspace. `ContextSpace.id` now has a Prisma UUID default, so future non-default spaces receive independent UUIDs unless an id is deliberately supplied. The deterministic default Workspace still explicitly uses `User.id`.

The existing sentinel default on context-scoped `contextSpaceId` columns is retained only as a compatibility tripwire for legacy Prisma create inputs. The database trigger now rejects null or sentinel custody rather than converting either value to `userId`. Migration backfill remains explicit and happens before the continuing write guard is installed.

## Ownership versus custody

Stage 8.6 deliberately retains both fields:

- `userId` - who owns/controls the record
- `contextSpaceId` - which trust/custody context contains the record

Core canonical reads now require both values. `userId` is not removed or redefined as ContextSpace.

## Context-scoped records

Custody is added to current Workspace relationship records including Contacts, Companies, Interactions, Claims, Objectives, Wants, Offers, Introductions, Outcomes, Deals, Projects, Tasks, Market Leads, agent staging/results, agent runs/artifacts, Tags, and custom Lead Sources.

Tags and custom Lead Sources become context-local so a future Dating/other context does not silently inherit Business Workspace metadata merely because the same account owns both spaces.

## Workspace query hardening

Stage 8.6 adds a request-scoped custody context using `AsyncLocalStorage`.

Authenticated Workspace requests enter the user's default ContextSpace. Prisma queries against context-owned models are automatically narrowed to `(userId, contextSpaceId)` before execution.

Legacy code that supplies only the current `userId` therefore remains compatible but is narrowed to the active/default ContextSpace. Outside a request custody context, context-scoped Prisma operations now fail closed unless a directly scoped operation names an explicit owner. Creates require explicit `userId` plus explicit `contextSpaceId`; reads/updates/deletes/upserts require a top-level `where.userId`. Inherited-custody models have no independent owner column and therefore require an explicit `runWithWorkspaceCustody(...)` boundary outside requests.

Prisma `$allOperations` only intercepts top-level operations. Nested relation reads do not pass through the interceptor. Their custody safety therefore comes from the database relationship guards described below, not from nested interceptor calls.

Inherited tables that do not carry their own custody columns are narrowed through their parent relations when they are queried as top-level models:

- `AgentStep` -> `AgentRun`
- `AgentRunEntity` -> `AgentRun`
- `ContactTag` -> Contact + Tag
- `TagAlias` -> Tag
- `InteractionEmbedding` -> Interaction

Nested agent-run reads rooted from account-level `AgentDefinition` are explicitly filtered because nested relation filters are not supplied automatically by the top-level Prisma query extension.

## Core repository boundary

The shared Core repository predicate is now:

`entity id + workspace user id + context space id`

A same-owner record in another ContextSpace must return not found through the Core repository.

## Agent custody

Every `AgentRun` carries a `contextSpaceId`.

Tools load the run and inherit its ContextSpace. Future agents can therefore be bound to a Dating/Friendship/etc. ContextSpace without relying on the model or prompt to remember its custody boundary.

`AgentRunEntity` remains a polymorphic bookkeeping link, but Stage 8.6 adds a database guard that resolves its target and proves the target belongs to the same owner and ContextSpace as the run. Unknown target types fail closed.

## Raw SQL and derived data

Prisma extensions cannot scope raw SQL, so Stage 8.6 explicitly updates current raw SQL paths for:

- Interaction semantic search
- Interaction embedding writes
- Tag vector matching
- Tag embedding writes
- Want/Offer embedding writes
- summary/tag suggestion queries

These now include `contextSpaceId` in addition to `userId`.

## Database integrity guards

The migration adds database-level safeguards that:

1. ensure a ContextSpace belongs to the row's `userId`;
2. prevent silent reassignment of existing context-owned rows to another owner/ContextSpace;
3. block cross-context foreign-key relationships between scoped records;
4. block cross-context Contact/Tag links;
5. validate polymorphic `AgentRunEntity` targets against the run ContextSpace;
6. preserve Contact -> Person subject consistency for Interactions, Objectives, KnowledgeClaims, Wants and Offers;
7. retain the existing Stage 8.4 required-subject constraints for Interaction, Objective and KnowledgeClaim.

The migration audits existing relationships before installing the continuing write guards. If an existing inconsistency is found, migration aborts rather than guessing.


### Nested-read relationship boundary specification

Nested relation selects are not independently intercepted by Prisma `$allOperations`. Their cross-context safety depends on these database invariants. The schema/migration audit found **111 direct foreign keys between directly context-scoped models, and all 111 are covered by `relish_enforce_context_reference`**:

- `AgentArtifact`: `agentRunId -> AgentRun.id`
- `AgentToolCall`: `agentRunId -> AgentRun.id`
- `ApprovalRequest`: `agentRunId -> AgentRun.id`
- `CompanyContact`: `companyId -> Company.id`; `contactId -> Contact.id`
- `CompanyContactNote`: `companyContactId -> CompanyContact.id`; `companyId -> Company.id`; `contactId -> Contact.id`
- `CompanyNote`: `companyId -> Company.id`
- `CompanyRelationship`: `companyAId -> Company.id`; `companyBId -> Company.id`
- `CompanyTag`: `companyId -> Company.id`; `tagId -> Tag.id`
- `Contact`: `leadSourceId -> LeadSource.id`
- `ContactEnrichment`: `agentRunId -> AgentRun.id`; `researchCandidateId -> ResearchCandidate.id`; `companyId -> Company.id`; `contactId -> Contact.id`
- `ContactRelationship`: `contactAId -> Contact.id`; `contactBId -> Contact.id`
- `DealCompany`: `dealId -> Deal.id`; `companyId -> Company.id`
- `DealContact`: `dealId -> Deal.id`; `contactId -> Contact.id`; `companyContactId -> CompanyContact.id`
- `DealContactNote`: `dealContactId -> DealContact.id`; `dealId -> Deal.id`; `contactId -> Contact.id`
- `DealNote`: `dealId -> Deal.id`; `contactId -> Contact.id`
- `Interaction`: `contactId -> Contact.id`; `companyId -> Company.id`
- `Introduction`: `sourceInteractionId -> Interaction.id`; `facilitatorContactId -> Contact.id`
- `IntroductionParticipant`: `introductionId -> Introduction.id`; `contactId -> Contact.id`; `companyId -> Company.id`
- `KnowledgeClaim`: `contactId -> Contact.id`; `companyId -> Company.id`; `objectiveId -> Objective.id`; `wantId -> Want.id`; `offerId -> Offer.id`
- `KnowledgeEvidence`: `claimId -> KnowledgeClaim.id`; `sourceInteractionId -> Interaction.id`
- `MarketLead`: `leadSourceId -> LeadSource.id`; `contactId -> Contact.id`; `companyId -> Company.id`; `dealId -> Deal.id`; `projectId -> Project.id`; `workstreamId -> ProjectWorkstream.id`; `wantId -> Want.id`; `offerId -> Offer.id`
- `MarketLeadNote`: `marketLeadId -> MarketLead.id`
- `ModelInvocation`: `agentRunId -> AgentRun.id`
- `Objective`: `sourceInteractionId -> Interaction.id`; `contactId -> Contact.id`; `companyId -> Company.id`
- `Offer`: `sourceInteractionId -> Interaction.id`; `contactId -> Contact.id`; `companyId -> Company.id`; `dealId -> Deal.id`; `projectId -> Project.id`; `workstreamId -> ProjectWorkstream.id`; `companyContactId -> CompanyContact.id`
- `OfferNote`: `offerId -> Offer.id`
- `OpportunityScore`: `agentRunId -> AgentRun.id`; `researchCandidateId -> ResearchCandidate.id`; `companyId -> Company.id`; `contactId -> Contact.id`; `dealId -> Deal.id`
- `OpportunityScoreFactor`: `opportunityScoreId -> OpportunityScore.id`; `researchCandidateId -> ResearchCandidate.id`; `companyId -> Company.id`; `contactId -> Contact.id`; `dealId -> Deal.id`
- `Outcome`: `introductionId -> Introduction.id`; `sourceInteractionId -> Interaction.id`
- `ProjectDeal`: `projectId -> Project.id`; `workstreamId -> ProjectWorkstream.id`; `dealId -> Deal.id`
- `ProjectNote`: `projectId -> Project.id`; `workstreamId -> ProjectWorkstream.id`
- `ProjectWorkstream`: `projectId -> Project.id`
- `Reminder`: `contactId -> Contact.id`
- `ResearchCandidate`: `agentRunId -> AgentRun.id`
- `ResearchSource`: `agentRunId -> AgentRun.id`; `researchCandidateId -> ResearchCandidate.id`; `companyId -> Company.id`; `contactId -> Contact.id`
- `Tag`: `mergedIntoId -> Tag.id`
- `Task`: `assignedToContactId -> Contact.id`; `waitingOnContactId -> Contact.id`; `contactId -> Contact.id`; `dealId -> Deal.id`; `dealContactId -> DealContact.id`; `projectId -> Project.id`; `workstreamId -> ProjectWorkstream.id`; `marketLeadId -> MarketLead.id`; `wantId -> Want.id`; `offerId -> Offer.id`; `companyId -> Company.id`; `companyContactId -> CompanyContact.id`; `dealCompanyId -> DealCompany.id`
- `Want`: `sourceInteractionId -> Interaction.id`; `contactId -> Contact.id`; `companyId -> Company.id`; `dealId -> Deal.id`; `projectId -> Project.id`; `workstreamId -> ProjectWorkstream.id`; `companyContactId -> CompanyContact.id`
- `WantNote`: `wantId -> Want.id`

No direct foreign key between two directly context-scoped models is unguarded.

Inherited-custody relations are handled as follows:

- `AgentStep.agentRunId -> AgentRun.id` - custody is inherited solely from `AgentRun`.
- `AgentRunEntity.agentRunId -> AgentRun.id` - custody is inherited from `AgentRun`, plus the polymorphic target is validated by `relish_enforce_agent_run_entity_context`; unknown target types fail closed.
- `TagAlias.tagId -> Tag.id` - custody is inherited solely from `Tag`.
- `InteractionEmbedding.interactionId -> Interaction.id` - custody is inherited solely from `Interaction`.
- `ContactTag.contactId -> Contact.id` and `ContactTag.tagId -> Tag.id` - the special `ContactTag_context_reference_guard` requires both parents to share a ContextSpace.

This list is the actual database boundary specification for nested reads in Stage 8.6.

### Fail-closed non-request callers found and corrected

The audit identified these current non-request or request-bootstrap callers that required explicit custody treatment:

- `scripts/backfill-embeddings.ts` - now enumerates account-level `ContextSpace` records and enters each one with `runWithWorkspaceCustody` before reading Interactions or writing embeddings. The script was also updated to the current `upsertInteractionEmbedding(userId, interactionId, text)` API.
- `scripts/check-stage8-5-2-isolation.ts` - uses a raw `PrismaClient`, so the interceptor does not apply, but the new database trigger requires its temporary context-scoped test rows to provide explicit deterministic default `contextSpaceId` values.
- `scripts/check-stage8-6-context-space.ts` - inherited `AgentStep` and `AgentRunEntity` operations now enter explicit custody so the database verification reaches the intended relationship guards.
- `src/lib/leads/link.ts` - authentication callbacks may begin before request custody exists, so lead claiming now enters the claimant's current/default custody explicitly. Deliberate writes to a prior lead owner's Contact remain explicit and are listed below for 8.7 review.

### Cross-owner and public-custody write paths retained for 8.7 review

Stage 8.6 does not introduce consent or grants. These existing flows can create or update contextual data for an owner other than the human initiating the action, or can write into an owner's custody without an authenticated active custody owner:

- `src/routes/u/[slug]/+page.server.ts` -> `createMutualConnection(...)` in `src/lib/connections.ts` - a logged-in visitor connecting to another public profile creates/updates one Contact representation in each user's default custody. The other profile owner's write is cross-owner relative to the active visitor.
- `src/lib/leads/link.ts` - when a lead is claimed after authentication, it updates the Contact originally owned by each `Lead.ownerId` to attach the claimant's `linkedUserId`/`personId`. That Contact may belong to a different owner from the active claimant.
- `src/lib/leads/reciprocal.ts` - lead claiming can create or update the reciprocal Contact representation in the claimant/recipient custody from another user's public profile. This is an explicit inter-user transfer flow even when the recipient equals the active claimant.
- `src/routes/u/[slug]/lead/+page.server.ts` - an unauthenticated public lead form creates/fetches a Contact in the profile owner's default custody. There is no authenticated active custody owner for the submitter, so the target `contextSpaceId` is now named explicitly.
- `src/routes/api/leads/+server.ts` - an invite-token lead submission creates/fetches a Contact in `invite.ownerId` default custody, again potentially without an authenticated active custody owner, so the target `contextSpaceId` is now named explicitly.

These paths are intentionally not converted into consent/disclosure workflows in 8.6. They are the concrete input set for deciding the scope of 8.7.

## Migration safety

Migration:

`20260901073000_stage8_6_context_space_custody_foundation`

The migration is forward and data-preserving. It contains no `DELETE FROM`, `TRUNCATE`, or `DROP TABLE` statements.

It does change selected uniqueness rules from account-wide to ContextSpace-local where that is required for future independent contexts, including Tags, linked Contacts, Interaction external references and Lead Sources.

## Tests

The Core suite retains behavioural same-owner/different-context isolation and now also checks the fail-closed non-request interceptor rules. The revised source-level Core suite passes 117/117 tests, including 21 Stage 8.6 tests. The interceptor mutation test was run by deliberately removing the fail-closed assertion call: five custody tests failed, then the Stage 8.6 suite returned to 21/21 after restoration.

`npm run check:stage8.6` is the real PostgreSQL verification. It now:

- verifies every existing User has a deterministic default ContextSpace;
- verifies all directly scoped tables point to a ContextSpace owned by the same `userId`;
- creates one owner with two explicit ContextSpaces plus a non-default ContextSpace whose UUID is generated independently from the owner id;
- proves Core reads cannot cross between those spaces;
- proves inherited AgentStep/AgentRunEntity reads cannot cross spaces;
- proves omitted, explicit-null and sentinel `contextSpaceId` writes are rejected by the database trigger;
- proves invalid cross-owner/cross-context writes are rejected;
- proves an AgentRun cannot link an entity from another ContextSpace;
- proves Contact/Person subject mismatches are rejected;
- removes the temporary verification rows.

The migration source test was also mutation-tested by temporarily restoring the old `NEW.contextSpaceId := NEW.userId` trigger body: the Stage 8.6 migration guard test failed, then passed again after restoration. This is supplementary only. A real PostgreSQL run is still required to behaviourally validate and mutation-test the trigger itself. The packaging environment used for this revision has no PostgreSQL server/Neon credentials and cannot reach npm, so that database execution is deliberately left as an installation gate rather than represented as already passed. The transactional `npm run check:stage8.6:mutation` script is included for that dev/local gate.

## Local install sequence

Stop the development server, then run:

```bash
npx prisma validate
npx prisma migrate dev
npx prisma generate
npm test
npm run check:stage8.6
ALLOW_STAGE86_MUTATION_TEST=true npm run check:stage8.6:mutation
npm run check
npm run dev
```

`prisma migrate dev` should apply only:

`20260901073000_stage8_6_context_space_custody_foundation`

It should not ask for another migration name. If it does, stop with Ctrl+C and inspect the drift rather than creating an ad-hoc migration.

## Expected visible behaviour

There is intentionally no ContextSpace switcher in 8.6. Existing users remain inside their one default Workspace ContextSpace, so normal Workspace behaviour should look unchanged.

The architecture is now ready for a later consent/disclosure model to move specifically permitted information between contexts without making ContextSpace itself imply disclosure.

## Packaging validation

For the revised package, the complete source-level Core suite was executed directly with Node TypeScript stripping: **118 passed, 0 failed**. The Stage 8.6 subset was **22 passed, 0 failed**. The fail-closed interceptor was mutation-tested: removing the assertion caused **5 failures**, and restoring it returned the Stage 8.6 subset to **22 passed, 0 failed**. A source mutation of the SQL trigger body caused the migration guard test to fail as expected; the real PostgreSQL mutation check remains an installation gate.

A schema-to-migration relationship audit found **111 direct context-scoped foreign keys, 111 guards, 0 missing guards**.

The package environment could not resolve `registry.npmjs.org`, so the revised dependency tree could not be installed here. It also has no PostgreSQL server or user Neon credentials. Therefore `npx prisma validate`, `npx prisma generate`, the full `npm test`, Svelte/TypeScript checks, migration execution, `npm run check:stage8.6`, and the real trigger mutation check remain mandatory installation gates. Do not skip them.

## Prisma inverse-relation validation correction

A first external `npx prisma validate` run against the revised package exposed three missing inverse relation fields on `ContextSpace` for `Tag`, `CompanyTag`, and `LeadSource`. No migration SQL had executed because Prisma stopped at schema validation. The schema now contains `ContextSpace.tags`, `ContextSpace.companyTags`, and `ContextSpace.leadSources`.

A regression test now enumerates every model with a direct `contextSpace ContextSpace` relation and proves that `ContextSpace` contains the inverse array relation. It currently verifies **44 direct ContextSpace models with 0 missing inverse relations**. This test was mutation-tested by temporarily removing `ContextSpace.tags`; the test failed and identified `Tag` as missing, then passed after restoration.



## Post-install Prisma default alignment correction

The first development application of Stage 8.6 exposed a Prisma migration-generation mismatch around the ContextSpace sentinel defaults. The live datasource diff showed only `Task.contextSpaceId`, `Want.contextSpaceId`, and `WantNote.contextSpaceId` missing the sentinel database default, while `prisma migrate dev --create-only` proposed resetting the same default on all 44 context-scoped fields plus dropping the `ContextSpace.updatedAt` database default.

The root cause was the Prisma schema representation. A simple string sentinel had been represented as `@default(dbgenerated(...))`. Prisma documents that `dbgenerated()` strings can mismatch after database normalization/casting and cause Migrate to continue proposing migrations. All 44 sentinel fields now use the ordinary static Prisma form:

```prisma
contextSpaceId String @default("00000000-0000-0000-0000-000000000000")
```

The already-applied main 8.6 migration is intentionally unchanged. Its SHA-256 in this package is:

`05779d38aefa40928c23855fc802c32be0d2af2e58d45899c718f1c01bb39474`

A forward alignment migration is added instead:

`20260901165000_stage8_6_context_default_alignment`

It does only four operations:

- drops the database default from `ContextSpace.updatedAt`, matching Prisma `@updatedAt`;
- restores the sentinel default on `Task.contextSpaceId`;
- restores the sentinel default on `Want.contextSpaceId`;
- restores the sentinel default on `WantNote.contextSpaceId`.

On a fresh database, the three `SET DEFAULT` statements are harmless repetitions after the main 8.6 migration. On the already-migrated development database, they repair exactly the live datasource differences reported by Prisma.

A new source regression test verifies all 44 `contextSpaceId` fields use the static sentinel default and none use `dbgenerated`. It was mutation-tested by changing one field back to `dbgenerated`; the Stage 8.6 suite failed as intended and passed after restoration. The source-level Core suite now passes **119/119**, with **23/23** Stage 8.6 tests.


## Runtime custody correction - lazy PrismaPromise execution

A real development `npm run check:stage8.6` run exposed a runtime edge in `runWithWorkspaceCustody`. Prisma query methods return lazy `PrismaPromise` thenables. The original helper returned the callback result directly from `AsyncLocalStorage.run()`, so a callback such as `() => prisma.agentStep.create(...)` could leave the custody scope before Prisma actually executed the query. The fail-closed interceptor then correctly rejected the operation as having no active workspace custody context.

`runWithWorkspaceCustody` now awaits the callback result *inside* the `AsyncLocalStorage` boundary. This keeps custody active while a lazy PrismaPromise executes and still clears the context after completion. Existing request, authentication lead-link, embedding-backfill and verification callers remain compatible because they already consume the helper asynchronously.

A behavioural regression test now uses a deliberately lazy thenable to prove custody is present at execution time and absent afterward. The invariant was mutation-tested by temporarily restoring direct-return behaviour: the new test failed as intended, then passed after the hardened helper was restored. The complete source-level Core suite now passes **120/120**, including **24/24** Stage 8.6 tests.

This correction changes runtime TypeScript only. It does **not** modify either Stage 8.6 migration and requires no additional database migration.


## Trigger mutation harness correction - raw SQL `updatedAt`

A real development `npm run check:stage8.6:mutation` run exposed a test-harness issue rather than a custody failure. The mutation harness intentionally inserts a `Contact` with raw SQL so that it can omit `contextSpaceId` and observe the deliberately weakened trigger. `Contact.updatedAt` is Prisma-managed with `@updatedAt`; it has no PostgreSQL default. Because raw SQL bypasses Prisma Client, the harness also omitted that required column and PostgreSQL raised `23502 NOT NULL` before the custody trigger mutation could be meaningfully exercised.

The harness now supplies `CURRENT_TIMESTAMP` for `Contact.updatedAt` while continuing to omit `contextSpaceId`. This leaves the row otherwise valid and isolates the exact invariant under mutation: whether a missing/sentinel ContextSpace is silently rewritten to the owner default. The whole trigger mutation and all temporary rows still run inside one transaction and are force-rolled back.

A source regression test now verifies that the raw Contact insert supplies `updatedAt`. The test was mutation-tested by temporarily removing that field, which caused the Stage 8.6 suite to fail on the intended assertion. After restoration, the source-level Core suite passes **121/121**, including **25/25** Stage 8.6 tests.

This correction changes only the mutation-test harness and its regression test. It does **not** modify application runtime code, `schema.prisma`, or either Stage 8.6 migration.
