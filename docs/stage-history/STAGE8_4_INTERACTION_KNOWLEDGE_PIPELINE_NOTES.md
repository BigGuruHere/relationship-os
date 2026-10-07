# Stage 8.4 - Common Interaction + Knowledge Pipeline

## Purpose

Stage 8.4 establishes the first common Relish Core pipeline for turning source interactions into reviewed relationship intelligence without introducing automated AI extraction yet.

The release deliberately separates:

1. **Interaction** - source evidence such as a Workspace note today, and later an agent conversation, email, calendar event, import or API event.
2. **KnowledgeClaim** - one canonical reviewed statement about a relationship subject.
3. **KnowledgeEvidence** - appendable provenance showing which source interactions support that claim.
4. **Objective / Want / Offer** - structured Core objects that can be created from a reviewed claim when appropriate.

Operational notes remain useful evidence. They are no longer required to be the primary representation of relationship meaning.

## What changed

### Channel-neutral Interaction

`Interaction` now supports:

- optional Workspace `contactId`
- optional canonical `personId`
- optional `companyId`
- `sourceType`
- optional external source reference

At least one accessible Contact, Person or Company subject is required.

Existing Contact interactions are preserved. Where an existing Contact already has a Stage 8.1 `personId`, the migration backfills that Person onto the Interaction.

The existing Contact note creation route now writes through `createCoreInteraction()` rather than creating `Interaction` directly. This is the first common ingestion seam that later agents/connectors can call.

### Person continuity for Wants and Offers

`Want.personId` and `Offer.personId` are added as nullable canonical subject links and are backfilled from existing Contact identity bridges where possible.

This does **not** widen access. `userId` remains the Workspace custody boundary.

This allows a future Person-scoped interaction to promote a reviewed Want/Offer without requiring a synthetic Workspace Contact solely to satisfy the schema.

### KnowledgeClaim

A claim records one canonical reviewed statement with:

- claim kind: Fact, Objective, Want, Offer, Preference, Constraint, Relationship State or Other
- encrypted statement
- scoped deterministic statement index for equality reconciliation only
- authority
- confidence
- subject identity/context
- status: Active, Superseded or Rejected
- optional link to one promoted Objective, Want or Offer

Claim text is application-encrypted. The deterministic index is scoped to the claim statement field and is only used to identify exact repeated statements within a Workspace subject context.

### KnowledgeEvidence

Evidence records preserve source history separately from the current claim assessment.

If the same active claim is captured again from another Interaction, Relish reuses the canonical KnowledgeClaim and appends another KnowledgeEvidence record rather than creating a duplicate claim.

Capturing the same claim from the same Interaction again does not duplicate evidence.

### Objective

`Objective` is now a first-class Core object for persistent higher-level outcomes that can generate multiple Wants over time.

It uses the neutral `IntentStatus` lifecycle and existing importance/confidence semantics, but remains conceptually different from Want and Offer.

### Reviewed promotion

From an Interaction detail page, a user can manually capture a claim and then promote compatible claim types:

- `OBJECTIVE` -> Objective
- `WANT` -> Want
- `OFFER` -> Offer

Promotion is type-safe and links the structured record back to the KnowledgeClaim. Existing canonical Want/Offer services are reused rather than introducing another intent representation.

## Deliberately not included

Stage 8.4 does **not** include:

- automatic LLM extraction of claims
- agent-autonomous promotion into Objective/Want/Offer
- PotentialMatch
- network matching
- disclosure grants
- progressive disclosure
- Dorian integration
- cross-Workspace access

The manual workflow is intentional. It lets us validate what deserves to become persistent knowledge before agents automate extraction later.

## Private embeddings

Existing Interaction embeddings are still generated for private Workspace semantic search.

They are explicitly treated as sensitive derived data and **must not** be reused as future cross-network matching embeddings. Future network matching must use permission-controlled match projections and separate network-safe embeddings.

## Migration

Migration:

`20260831193000_stage8_4_interaction_knowledge_pipeline`

The migration is forward-only and data-preserving:

- no DELETE
- no TRUNCATE
- no DROP TABLE
- existing Interaction rows remain intact
- existing Contact-based interactions are backfilled with Person identity only where Stage 8.1 already established it
- existing Wants/Offers are backfilled with Person identity only where their Contact already has one

## Local migration and validation

Stop the development server first.

```bash
npx prisma migrate dev
npx prisma generate
npm test
npm run check:stage8.4
npm run dev
```

Expected migration:

`20260831193000_stage8_4_interaction_knowledge_pipeline`

Prisma should not ask for another migration name.

Expected Core test result:

`60 passed, 0 failed`

Expected integrity-check final line:

`PASS: Stage 8.4 common Interaction/Knowledge pipeline is internally consistent.`

Do not reset the database if migration reports an unexpected condition.

## Suggested manual smoke test

1. Open an existing Contact and confirm existing notes, Wants, Offers and provenance remain intact.
2. Add a new Contact note/voice interaction and open its Interaction detail page.
3. Capture a `FACT` claim with Authority = Workspace recorded and Confidence = Medium.
4. Return to the Contact and confirm it appears in **Relationship intelligence** separately from the raw note.
5. From a second Interaction for the same Contact, capture the exact same claim kind + statement. Confirm the Contact shows one active claim with two evidence sources rather than two claims.
6. Capture an `OBJECTIVE` claim, promote it, open the Objective and edit its neutral lifecycle/status.
7. Capture a `WANT` claim and promote it. Confirm the resulting Want retains provenance and the Contact/Person subject bridge.
8. Capture an `OFFER` claim and promote it. Confirm the same behaviour.
9. Mark a claim Superseded or Rejected and confirm it no longer appears in the Contact's active relationship-intelligence list.
10. Confirm normal Contact interaction search continues to work.

## Validation performed while packaging

- existing Stage 8 safety/identity/provenance/consolidation tests plus new 8.4 tests: 60 passed, 0 failed in isolated source-level validation
- changed TypeScript syntax validation passed
- changed Svelte TypeScript script syntax validation passed
- migration inspected for destructive statements
- `package-lock.json` unchanged from 8.3

The packaging environment did not have the project's installed Prisma/Svelte dependency tree, so Prisma CLI validation and the full `npm run check` could not be run there. Local `migrate dev`, `prisma generate`, `npm test` and `check:stage8.4` are therefore the authoritative final validation before production.
