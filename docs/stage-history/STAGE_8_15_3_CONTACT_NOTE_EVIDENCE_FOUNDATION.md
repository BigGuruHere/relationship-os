# Stage 8.15.3 - Contact-note evidence foundation

## Intent

Make the existing private contact-note workflow safer as a source of relationship intelligence. Do not introduce a parallel knowledge engine, universal relationship table, or ungoverned cross-person understanding.

## Delivered

1. The contact-note creation screen now resolves the selected contact using `findCoreContact` and the current CoreAccessContext (`userId` plus `contextSpaceId`). Contact last-contacted updates include both keys.
2. Both editing pathways preserve the original interaction source and write a **new encrypted Interaction** as a correction. `externalRef` records `correction-of:<original interaction UUID>:<new UUID>` in the same user/context. The new note links back to its original in the detail view. No existing evidence link is redirected automatically.
3. The delete-note endpoint has changed from GET to POST with confirmation. Referenced notes cannot be deleted through this endpoint if linked by knowledge evidence, LU versions/revisions/drafts/review dispositions, or operational Want/Offer/Objective/Introduction/Outcome sources. Notes with child corrections are also retained. The application uses explicit ContextSpace scoping.
4. Added a source-contract test: `npm run check:stage8.15.3`.
5. No new migration; no existing migration modified.

## Core architectural rules preserved

- `Person` is identity, not global personal knowledge.
- `Contact` and `Interaction` remain privately owned and ContextSpace scoped.
- A user's observation about a contact is not treated as a confirmed claim about that contact.
- A source and its correction are distinct evidence. Linked knowledge remains anchored to the original until an explicit review decision.
- Private notes do not automatically become matching-eligible, shareable or visible to the contact.

## Known limitations

- This is an **evidence/provenance hardening slice**, not an automatic note-to-LU pipeline. The existing manually reviewed Capture Knowledge action continues to be the available intelligence mechanism.
- The `externalRef` correction link is a lightweight provenance marker, not a first-class revision table. Its structure must remain internal and private.
- Summary edits can still change mutable summaries, separate from the original raw text.
- The deletion reference-check and deletion are separate database queries; a transactional/database-enforced protection for every provenance relationship should be reviewed before high-concurrency use. Existing restrictive foreign keys provide partial protection, but not every optional reference is RESTRICT.
- More legacy note writes and source deletion paths outside these routes may exist. This work does not claim an application-wide immutability policy.
- No automatic person- or relationship-perspective modelling was added. That requires explicit ownership, authority, evidence and permissions design.
- Tests are source-contract checks, not runtime, database, or cross-context integration tests.

## Development verification

In the provided source-only environment, Node source-contract checks passed. The environment did not have installed dependencies or a connected PostgreSQL database. `npm run check`, `npm run build`, Prisma runtime validation, and database tests were **not run**. Run these in the development workspace before deploying.

```powershell
# Install lockfile-pinned dependencies when needed.
npm ci

# No new SQL migrations are introduced by this stage.
npx prisma validate
npx prisma migrate dev
npx prisma generate

# Check new and existing regression coverage.
npm run check:stage8.15.3
npm run check:stage8.15.2.1
npm run check:stage8.15.2
npm run check:stage8.14.6
npm run check
npm run build
```

For live testing, create a note, capture a knowledge claim from it, attempt deletion (expect rejection), correct it, verify original is unchanged, and verify cross-ContextSpace URLs cannot open/correct/delete the note. Verify an unreferenced note can only be deleted using POST.

## Follow-on design

Next work should design and implement an explicit note-to-understanding review intake with three governed subjects:

- **Subject understanding:** assertions about the contact, with reported/asserted/inferred authority.
- **Owner perspective:** what the owner believes or observes about the contact.
- **Relationship perspective:** what the owner experiences, wants or sees as possible in their relationship with that person.

Use the existing KnowledgeClaim/Evidence and longitudinal LU pipeline, preserve source attribution, and require review before authoritative or disclosed changes. Do not merge another person's private notes into their own LU solely because a shared Person ID exists.
