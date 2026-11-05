# Developing on the relationship foundation

Date: 2026-11-03. Status: guidance for implementing the target design. Proposed module names are not existing APIs. Read [architecture](ARCHITECTURE.md), [policy](POLICY_AND_PROVENANCE.md) and the relevant [backlog item](IMPLEMENTATION_PLAN.md) before new-domain work.

Use the [physical model](PHYSICAL_MODEL.md) for exact F-202 table/constraint contracts and the [dependency inventory](DEPENDENCY_INVENTORY.md) before changing auth, database guards or cohort routing. The aggregate inventory script is read-only and is not a migration.

Read [F-202 invariants and rehearsal](F202_INVARIANTS.md) before changing Prisma or foundation migrations. Prisma cannot represent all CHECKs, partial indexes and deferred triggers; preserve and test the SQL contract. `npm run check:foundation:schema` always uses synthetic embedded PostgreSQL and never DATABASE_URL.

## Before a change

1. Fetch latest development, read AGENTS and living docs, inspect actual affected source. Find existing functionality and state the precise gap.
2. Identify the stage/backlog item and whether this is legacy behaviour, an adapter or new-domain behaviour. Do not silently switch a legacy consumer to new persistence.
3. Name subjects, perspective, custodian, sources and intended operation. Determine who can authorise it. An AI agent's configuration is not user permission.
4. Specify migration/cohort behaviour and failure handling before route implementation. Use one authoritative writer and retry-safe identifiers.

## Worked implementation patterns

### Add a note

The route resolves the authenticated account and its domain enrolment, locates the owner-private person/relationship subject through the repository, validates input, then calls evidence ingestion. The service records source version, custody and subject association in a transaction. It returns an owner-scoped reference. Retries cannot create duplicates. A submitted owner ID or relationship membership is never authority. Reuse the existing recording UI and adapt its save boundary.

### Derive an interpretation

The worker obtains an explicit processing scope, selects authorised source versions/segments and records perspective, subjects, uncertainty and derivation. For “Betty might prefer advance notice,” record whether Mark observed this, Betty declared it or Dorian inferred it. Do not turn the inference into Betty's preference or shared agreement. References returned to the UI are independently access-checked.

### Share a field

Resolve whether the information is already public or restricted. For restricted data, verify issuing authority, select an explicit field/projection and recipient, and record the grant/update mode and receipt. Future fields are excluded unless authorised. Read current permitted shared values alongside the recipient's private overrides; do not overwrite private notes or preferred contact details. This pattern belongs to stage 4, not the first capture release.

### Withdraw permission

Revoke/version the grant, enqueue invalidation atomically when derivatives exist, stop newly affected reads/deliveries and reassess dependencies. A pending job rechecks before publishing. Retain only policy-permitted audit metadata; do not promise recall of a downloaded contact file. Distinguish this from correcting a statement or deleting a record.

### Understand a relationship

Select the relationship as subject and keep perspective explicit. Mark's private observation remains in his custody. A joint statement requires acknowledgements of that exact version. An AI hypothesis has provenance and uncertainty. Linking Betty's account must not expose Mark's source, even if both references concern the same relationship.

## PR and stage evidence

Include: backlog ID; existing capability and gap; user-visible result; changed authority/data path; migration and rollback requirements; tests actually run; failures/limitations; documentation updated; rollout scope. Comment non-obvious and security-sensitive code.

Update architecture for model/boundary changes, decisions for accepted tradeoffs, implementation backlog for completed items, and CURRENT_STATE for observed status. Do this in the same PR as the implementation. At merge/deployment update the corresponding status and environment evidence. Do not copy old test totals as new validation.

Use Node 22 and the repository's current check/test commands. Target behaviour and adversarial authority cases, not tests that merely mirror source strings. Re-evaluate existing baseline failures rather than weakening security coverage. Run real database constraint/migration tests for schema work and device tests for browser/OS handoffs. Documentation-only changes require link, consistency and diff checks, not a claimed runtime test pass.

## Release record template

- Stage/backlog IDs and scope:
- Branch and implementation commit:
- Schema/migration version and rehearsal evidence:
- Automated checks and unresolved failures:
- Manual/device checks and operator:
- Cohort/domain routing and authoritative writer:
- Backup/restore and rollback/roll-forward procedure:
- Merged commit/date:
- DEV deployed commit/date and smoke evidence:
- PROD deployed commit/date and smoke evidence:
- Known limitations, support owner and next gate:

Leave unknown fields explicitly unverified. No automatic deployment, migration execution, external messaging or participant invitation follows from completing this checklist.

## F-203 provisioning boundary (merged, DEV operator-confirmed)

See [account provisioning isolation](F203_PROVISIONING.md) for transaction locks, enrollment-state behavior and acceptance evidence. All auth paths reuse `createSession`; no automatic enrollment is enabled. Future enrollment transitions must use the same account advisory lock. PREPARED suppresses automatic legacy claims while retaining legacy public routing. ACTIVE/SUSPENDED private routes fail closed until the foundation adapters are available. F-204 must add repository authorization and transactional state/epoch checks before activation.

## F-204 owner access boundary (merged, 2026-11-05)

Read [F-204 access and usage](F204_ACCESS.md) before adding a foundation caller. Resolve authority from authenticated server locals and use repository projections. Never accept owner/vault/purpose from request payloads as authority. Private operations recheck enrollment/epoch and vault lifecycle under account/root locks. Prepared access is internal-only; serialized access handles, agent identities, memberships and context labels grant nothing. Evidence/statement/job adapters remain gated pending their own policy tests. No route activation is included.

## Private evidence and understanding

F-205 introduces purpose-specific owner operations for recording notes, inspecting excerpts, recording statements and reading current understanding. Preserve exact UTF-16 anchors across revisions, explicit owner admission and use-time checks on each support. Follow the [F-205 service contract](F205_EVIDENCE.md).

## Capture during a storage handoff

Resolve the profile owner and check its enrollment under the account lock on the same transaction connection used for private-home creation, Contact and receipt. Take the profile lock second and recheck publication before persisting. Before enabling other private writers for a cohort, rehearse the complete handoff and recovery. See [F-206](F206_REHEARSAL.md).

## People pages

Follow [P-301](P301_PEOPLE.md) for server-controlled domain dispatch and bounded encrypted directory search. A route must resolve fresh owner authority, and a failed foundation operation must never fall through to legacy storage. Extend the exact enabled route set only alongside the corresponding repository and isolation tests. Keep the directory response explicit when search covers one page rather than the whole vault.

## Public exchange

Follow [P-302](P302_EXCHANGE.md) for visitor capture. Keep route consent/token/origin checks, use the existing dispatch adapter, and never construct an owner FoundationAccess from Profile.userId. Only the capture repository invokes `withPublicCapture`; no callback result may become a visitor response. Preserve atomic person/receipt creation and use STORED_ONLY admission. Later claim and sharing features need their own explicit authorization.

## P-303 notes and draft processing

Follow [P-303](P303_NOTES.md). Reuse ContactNoteForm and existing upload/provider transport. Stable form keys identify retry attempts, not people. Keep full-text note retrieval under READ_NOTES and leave READ_SEGMENT payload restrictions intact. Explicit PROCESS_DRAFT checks run before and after provider work, outside database transactions; they grant no stored-source analysis permission. Jobs must bind server-issued domain/vault/epoch and reauthorize polling. Do not treat process-local jobs as durable or silently route failed foundation writes to legacy storage.
