# Stage 8.1 - Identity + Agent Access Foundation

## Purpose

Stage 8.1 begins the structural extraction of Relish Core while preserving all existing Relish data and the current Workspace tenant boundary.

The release has two goals:

1. Introduce a neutral `Person` identity node that subsumes the role already started by `Contact.linkedUserId`.
2. Move agent access to canonical relationship records behind a fail-closed, tenant-scoped Core repository boundary.

Dorian is not migrated in this release. The old Dorian codebase remains reference material only.

## Identity model

### New `Person`

`Person` is intentionally identity-only. It does not contain global name, email, phone, profile, Want, Offer, or other private relationship facts.

A `User` may reference one `Person` through `User.personId`.

A tenant-owned `Contact` may reference a `Person` through `Contact.personId`.

`Contact.userId` remains the current Relish tenant ownership boundary and is not weakened by Person identity.

### Existing data migration

The migration is non-destructive:

- creates one Person for every existing User;
- uses the existing User id as the initial Person id for those existing accounts;
- sets every existing `User.personId`;
- maps `Contact.personId` for Contacts whose existing `linkedUserId` points to a current User;
- leaves ordinary/unlinked Contacts unchanged;
- leaves orphan legacy `linkedUserId` values unmapped rather than guessing;
- keeps `Contact.linkedUserId` in place as a compatibility bridge.

No Users, Contacts, Companies, Wants, Offers, Deals, Interactions, Projects, Tasks, or other relationship data are deleted or merged.

### Future User creation

All current User creation paths now create a Person at the same time:

- password registration;
- Google sign-in when creating a new User;
- magic-link account creation;
- guest User creation from the public lead flow.

Mutual connections, claimed leads, and reciprocal contact creation now populate `personId` alongside `linkedUserId`.

## Agent access foundation

New Core access files:

- `src/lib/server/core/accessPolicy.ts`
- `src/lib/server/core/relationshipRepository.ts`
- `src/lib/server/core/identity.ts`

An agent Core access context now contains:

- current workspace/tenant User id;
- agent definition id;
- explicit purpose.

It fails closed if the agent identity or purpose is missing.

Canonical Contact, Company, Deal, and Project reads in agent tools are routed through the scoped Core repository. The repository always adds the current `userId` to the lookup.

Agent tools that create records with canonical foreign keys now verify those references first. This applies to:

- `read_entity_context`;
- `create_task`;
- `create_contact_enrichment`;
- `create_research_source`;
- `create_opportunity_score`.

This prevents an agent from attaching a Task, enrichment, research source, or score to a Contact/Company/Deal/Project from another Relish tenant even if it somehow receives that record id.

This is the first access seam only. It does not enable any cross-user or cross-agent data sharing.

## Tests

Stage 8.0.1 had 16 Core safety checks.

Stage 8.1 adds 13 more checks covering:

- User/Contact Person bridge structure;
- migration backfill behaviour;
- no destructive SQL in the identity migration;
- all User creation paths creating Person;
- linked-user connection paths populating Person;
- workspace-scoped Core predicates;
- agent identity and purpose fail-closed behaviour;
- agent canonical reads using the Core repository;
- agent canonical foreign-key writes using the Core repository;
- no direct Contact/Company/Deal/Project reads remaining in the agent tool directory.

Run:

```bash
npm test
```

Expected total after Stage 8.1:

```text
29 passed
0 failed
```

A normal dependency install was not available in the packaging environment, so the full project `npm run check` was not executed there. TypeScript syntax checks passed for all changed files, and the 29 safety tests were run in isolated transpiled validation.

## Migration

New migration:

```text
20260831123000_stage8_1_identity_agent_access_foundation
```

In development:

```bash
npx prisma migrate dev
npx prisma generate
```

Do not reset the database.

## Post-migration integrity check

Stage 8.1 includes a read-only database verification command:

```bash
npm run check:stage8.1
```

It verifies:

- every User has a Person;
- Person count is not below User count;
- Contacts whose `linkedUserId` points to a current User also have `personId`;
- those Contact Person links agree with the linked User Person.

Legacy `linkedUserId` values pointing to Users that no longer exist are reported as informational and are not guessed or modified.

Expected final line:

```text
PASS: Stage 8.1 identity bridge is internally consistent.
```

## Manual Workspace smoke test

After migration and tests:

1. Start Relish with `npm run dev`.
2. Open several existing Contacts, including normal unlinked Contacts.
3. Open a Contact that represents another registered Relish user if one exists.
4. Confirm Contacts, Companies, Deals, Wants/Offers, Tasks, Projects and Workstreams still load normally.
5. Run an existing agent that reads a Contact or Company and confirm it can read records from your own Workspace.
6. If practical, create an agent-generated Task attached to one of your own Contacts and confirm it saves normally.

There should be no visible UI change from Person identity in this release.

## Retirement status

`Contact.linkedUserId` is not removed in Stage 8.1.

Its retirement condition is now explicit:

1. all account/contact identity consumers read `personId` or a Person-aware identity service;
2. new account-link writes no longer depend on `linkedUserId` as authority;
3. existing linked records are verified/reconciled;
4. no live feature requires `linkedUserId` for identity resolution.

Only then should a later release stop writing and remove `linkedUserId`.

## Not included

Stage 8.1 does not add:

- global Person profile fields;
- cross-workspace Person data visibility;
- Dorian integration;
- cross-user matching;
- agent-to-agent data sharing;
- consent/disclosure rules;
- KnowledgeClaim/provenance objects;
- Introduction or Outcome tables;
- Want/Offer consolidation.

Those remain later stages of the approved Stage 8 architecture.
