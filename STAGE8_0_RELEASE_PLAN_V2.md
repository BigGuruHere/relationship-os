# Stage 8.0 - Revised Release and Migration Plan

## Baseline

This contract is built from the current uploaded Relish source. The existing database is the only live-data migration anchor.

The old Dorian application has no data that needs migration and does not need to remain functional during Stage 8.

## Global safety rules

1. No database reset is part of Stage 8.
2. Relish data continuity is mandatory.
3. Workspace may temporarily pause if that prevents long-lived compatibility debt.
4. No new Core concept ships without naming what it replaces and when the predecessor retires.
5. Cross-workspace access is never enabled by weakening current tenant guards.
6. Network matching later uses permitted projections rather than another workspace's raw records.
7. Dorian old backend is reference-only and is not redeployed unchanged.

## 8.0 - Architecture Contract v2

Documentation only.

Deliverables:

- Core architecture contract v2
- code boundary map v2
- model/table map v2
- retirement register
- revised release sequence

No Prisma, migration or runtime changes.

## 8.0.1 - Relish Trust Safety Harness

Goal: protect the live Relish trust boundaries before structural refactoring.

Tests/fixes:

### Encryption

- round-trip
- deterministic index stability
- different-value separation
- tamper failure
- null/empty behaviour

### Tenant isolation

Representative tests for Contact, Want, Offer and Interaction access/mutation boundaries.

### Approval/staging

- approval-required tool creates pending ApprovalRequest and does not execute protected tool
- ResearchCandidate import requires APPROVED
- ContactEnrichment apply requires APPROVED
- rejected records cannot promote
- approved promotion executes once

Do not build or test a generic approval resume mechanism in 8.0.1 unless product requirements add one.

## 8.1 - Identity + agent access foundation

Goals:

- introduce `Person`,
- link `User -> Person`,
- link `Contact -> Person`,
- use existing `Contact.linkedUserId` relationships as a seed for linked-user identity mapping,
- keep current `Contact.userId` tenant isolation,
- do not auto-merge unrelated Contacts across workspaces,
- begin scoped Core repository/data-context for agent relationship reads.

Retirement target:

`linkedUserId` becomes compatibility metadata only and receives an explicit later removal milestone once all connection/identity flows use Person.

## 8.2 - Provenance + minimal Introduction/Outcome

Goals:

- distinguish authority/provenance from confidence,
- add explicit source/authority support for important relationship intelligence,
- introduce minimal first-class Introduction,
- introduce minimal Outcome,
- add a simple manual Workspace capture flow.

Why early:

Real introduction/outcome data should inform later Match design rather than waiting for an automated matcher.

## 8.3 - Want/Offer consolidation

Goal: finish the old exchange migration rather than add another representation.

Requirements:

- decide canonical Want/Offer representation,
- factor duplicated Want/Offer service logic,
- migrate all remaining ExchangeItem references safely,
- stop ExchangeItem writes,
- verify no live functionality requires ExchangeItem,
- retire ExchangeItem table/relations/compatibility code on explicit acceptance criteria,
- generalise Core lifecycle/authority without making another parallel intent model,
- no automated matching.

## 8.4 - Common Interaction + Knowledge pipeline

Goals:

- channel-neutral Interaction/source ingestion,
- KnowledgeClaim/evidence reconciliation where useful,
- structured updates to objectives/Wants/Offers,
- operational notes remain evidence rather than the primary truth model.

## 8.5 - Agent purpose/access + MemoryProjection

Goals:

- formalise agent persona, purpose and deployment authority,
- separate action permission from data-access permission,
- move relationship-data reads through scoped Core repositories,
- derive agent memory from permitted Core records.

Dorian is not required for this stage.

## 8.5.1 - Relevance layer exploration (not required in migration lineage)

The purpose/domain relevance work remains useful as an attention/retrieval layer, but it is not the custody boundary. The 8.5.1 package was not installed on the active development lineage and is superseded as a required stage. Reintroduce useful relevance/sensitivity classification only after ContextSpace custody is structurally explicit.

## 8.5.2 - Agent access hardening + behavioural isolation tests

Goals:

- remove broad-read/post-query agent filtering,
- build entity selects from data policy before canonical reads,
- keep one tenant-scoped repository predicate for canonical agent reads,
- add executable behavioural isolation tests,
- add a real transactional Postgres isolation check,
- record and verify retirement of the fail-open compatibility implementation.

No schema migration is required.

## 8.6 - ContextSpace custody foundation

Goals:

- add ContextSpace as the explicit custody/trust-context primitive,
- retain User/Account ownership separately from ContextSpace custody,
- create one default ContextSpace for every existing User,
- backfill Core relationship knowledge to that default ContextSpace,
- require `(userId, contextSpaceId)` for Core custody-scoped reads,
- add subject-integrity constraints for important Core knowledge records,
- bind agent runs and inherited bookkeeping to one custody context,
- audit raw SQL and account-level nested reads that bypass normal model scoping,
- no cross-context grants, disclosure, matching or new end-user workflow yet.

## 8.7 - Consent / disclosure foundation

Goals:

- standing/default sharing policy where useful,
- specific DisclosureGrant,
- source ContextSpace + recipient/audience + purpose + scope + stage,
- source consent evidence,
- revocation,
- future agents may request consent conversationally but cannot expand their own authority.

## 8.8 - Manual PotentialMatch

Goals:

- PotentialMatch + MatchParticipant,
- domain/policy version,
- manual matches first,
- learn from Introduction/Outcome history,
- no raw cross-context record visibility.

## 8.9 - Progressive bilateral disclosure

Goals:

- per-side disclosure state,
- recipient-specific grants,
- explicit introduction permission,
- asymmetric disclosure where domain requires it.

## 8.10 - Matchable projections

Goals:

- explicit MatchParticipation scope,
- permitted projection fields only,
- separate network embedding generated from that projection,
- raw private source records and private embeddings remain outside network access.

## 9.0 - Controlled network matching

Goals:

- matcher receives safe projections only,
- domain/purpose-specific scoring,
- agents/workspaces receive only permitted result metadata,
- identities remain hidden until applicable disclosure grant/stage.

## Dorian v2 - intentionally unscheduled

Dorian is added when product/commercial priorities justify it.

Target:

- reuse selected transport/persona code where helpful,
- rebuild auth against Core/Platform,
- no migration of old Dorian database,
- no old backend compatibility requirement,
- use scoped Core APIs for interactions, memory, intents, consent and introductions.

## 9.x - Outcome learning and commercial attribution

Only after enough real Introduction/Outcome history exists:

- match quality learning,
- introduction effectiveness,
- originator/facilitator attribution,
- commercial/economic value where applicable.

## Retirement philosophy

Additive safety is temporary, not a permanent architecture style.

Each transitional bridge must have:

- replacement target,
- stop-write milestone,
- read-compatibility milestone,
- verification criteria,
- removal milestone.

A temporary bridge with no retirement event is not accepted as complete architecture work.
