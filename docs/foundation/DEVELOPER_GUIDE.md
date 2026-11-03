# Developing on the relationship foundation

Date: 2026-11-03. Status: guidance for implementing the target design. Proposed module names are not existing APIs. Read [architecture](ARCHITECTURE.md), [policy](POLICY_AND_PROVENANCE.md) and the relevant [backlog item](IMPLEMENTATION_PLAN.md) before new-domain work.

Use the [physical model](PHYSICAL_MODEL.md) for exact F-202 table/constraint contracts and the [dependency inventory](DEPENDENCY_INVENTORY.md) before changing auth, database guards or cohort routing. The aggregate inventory script is read-only and is not a migration.

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
