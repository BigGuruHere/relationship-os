# Stage 8.15.3.5 - Governed Relationship and Understanding Foundation

## Purpose

Establish future-proof **identity of a governed understanding destination**, without replacing current authoritative Living Understanding, `ContactRelationship`, or `Relating` services and without transferring another user's private knowledge to a shared `Person`.

## Existing structures reused

- `Person`: neutral identity only, no global profile or shared dossier.
- `User`, `Contact`, `ContextSpace`: independent custody and a user's private representation of a person.
- `Relating`, `RelatingParticipant`, `Touchpoint`: local relating history; presence does not establish mutual consent or relationship quality.
- `Interaction`, `KnowledgeEvidence`, `KnowledgeClaim`: evidence and attributed observations.
- `LivingUnderstandingRevision` and related topic versions: existing authoritative longitudinal engine, deliberately unchanged.

## Additive schema foundation

One forward-only migration: `20261014160000_stage8_15_3_5_governed_understanding_scopes`.

`GovernedUnderstandingScope` identifies **whose view** (user), **where** (ContextSpace), and **what subject** (`SELF`, `PERSON_VIEW` of a private Contact, or `RELATIONSHIP_VIEW` of a private Relating). The subject-shape constraint rejects ambiguous or mixed kinds.

`GovernedUnderstandingScopeSource` associates a source Interaction with any number of independently governed scopes, without cloning the Interaction or automatically approving any understanding. Duplicate links to the same scope are rejected.

Database constraints and triggers reject a Contact or Relating in another custody tuple, a ContextSpace whose owner differs from the scope user, a source Interaction in another user or ContextSpace, and later reparenting of a linked source.

Existing LU records and current application workflows are not migrated or reclassified. This is a **foundation**, not an alternate LU engine. There is no auto-proposal, new UI, or cross-account propagation. The source-admission check in the current LU pipeline continues to govern actual inclusion, and permissions for matching and disclosure remain separate.

## Important modelling decisions

1. Each person's relationship perspective is a *separate* governed scope, even when two owners ultimately refer to the same Person identity.
2. A shared Person link never unlocks contact notes or understanding in another account.
3. A source may affect multiple subjects **within its original custody**; different users require their own authorised evidence or an explicit future governed transfer mechanism.
4. `ContactRelationship` (a typed contact link) and `Relating` (history container) are not conflated with claims of mutual acceptance.
5. Historical facts and interpretations need not be identical; new AI functionality will interpret specific sources only after admission and explicit routing.

## Development installation

Confirm `.env` targets **development Neon**, not production. Back up dev before migration.

```powershell
# Validate locally installed Prisma, without downloading a new major version.
npx --no-install prisma validate
# Apply committed migration using the existing development workflow.
npx --no-install prisma migrate dev
npx --no-install prisma generate
# Source-level regression tests.
npm run check:stage8.15.3.5
npm run check:stage8.15.3.4
# Required local release gates.
npm run check
npm run build
```

If Prisma asks to create an unexpected migration, proposes a reset, or displays drift, **stop** and inspect the diff before accepting. No deployed migration should be edited. Railway's `start:with-migrations` will apply this additive migration on deployment, so review it and back up production first.

## Manual verification

- [ ] `prisma validate` succeeds on Prisma 6.16.1.
- [ ] `prisma migrate dev` applies the sole new migration without drift or a reset request.
- [ ] `npm run check` reports 0 errors and 0 warnings.
- [ ] `npm run build` succeeds.
- [ ] Existing Business contact notes, saved-note admission, note correction and evidence view still function.
- [ ] Existing General/Dorian LU history and review continue to work.

## Database integration acceptance (requires a dev harness)

- [ ] Create owner A with ContextSpace A and owner B with ContextSpace B; create different Contacts pointing to the **same** Person ID.
- [ ] Create PERSON_VIEW scopes separately for A and B; verify both can coexist without sharing sources or LU.
- [ ] Create a RELATIONSHIP_VIEW scope for an A-owned Relating and SELF scope for A.
- [ ] Link an A-owned Interaction to more than one A-owned scope. Verify a second link to the same scope is rejected.
- [ ] Try linking B's Interaction to A's scope. Database must reject it.
- [ ] Try constructing A's scope with B's Contact or Relating. Database must reject it.
- [ ] Try using B's ContextSpace with A's userId. Database must reject it.
- [ ] Try changing `userId` or `contextSpaceId` of a linked Interaction. Database must reject it.
- [ ] Confirm an ineligible CRM note is **not** sent to authorised LU revision merely because it has a scope-source association.
- [ ] Confirm legacy LU versions and provider conversation ingestion remain unchanged.

## Verification in packaging environment

- Stage 8.15.3.5 source contract tests: **3 passed**.
- Stage 8.15.3.4 source regression tests: **3 passed**.
- Prisma validation, migrate dev, Svelte/TypeScript, build, and live database tests: **not run** (npm dependency installation timed out).

## Remaining boundaries and next stage

This release only establishes registry and custody constraints, not production-ready services for creating scopes and assigning source links. New API/service paths must enforce source admission and operator/member permissions and should prefer transactions with explicit subject resolution. A follow-up real database integration suite is needed before any untrusted pilot uses the new tables. Existing LU remains contact-scoped, and the adapter mapping scopes to immutable LU versions is still future work.

Next: Stage 8.15.4 member-facing product shell, following local validation of this migration and custody tests.
