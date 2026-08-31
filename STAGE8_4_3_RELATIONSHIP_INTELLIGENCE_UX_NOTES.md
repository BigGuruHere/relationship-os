# Stage 8.4.3 - Relationship Intelligence UX

## Purpose

Stage 8.4 proved the Core `Interaction -> KnowledgeClaim -> KnowledgeEvidence -> Objective/Want/Offer` model, but exposed too much of that internal pipeline to a human Workspace user. Stage 8.4.3 keeps the architecture and simplifies the operation.

## User-facing changes

### One-step capture from an Interaction

`Add relationship intelligence` now:

1. pre-fills the relationship-intelligence statement from the Interaction summary, or the note text when no summary exists;
2. asks the user to choose the meaning type;
3. keeps authority/confidence/evidence notes under collapsed `Advanced provenance`;
4. performs one reviewed submit.

For `WANT`, `OFFER`, and `OBJECTIVE`, the submit creates the Claim/Evidence and the structured record together. The structured title is derived from the reviewed statement, so the user does not need to type substantially the same information a third time.

For `FACT`, `PREFERENCE`, `CONSTRAINT`, `RELATIONSHIP_STATE`, and `OTHER`, the submit saves the Claim/Evidence only.

The underlying Core records remain separate. This is a UX simplification, not a data-model collapse.

### Universal Claim detail

All Relationship Intelligence claims, including Facts, are now clickable at:

`/knowledge/[id]`

The page exposes Claim status controls:

- Active
- Superseded
- Rejected
- Restore to Active

This makes Facts and other non-structured claims manageable after capture.

### Claim status vs Evidence status

Stage 8.4.3 adds an explicit `status` to `KnowledgeEvidence` using the existing `KnowledgeClaimStatus` values:

- Active
- Superseded
- Rejected

Claim and Evidence status are independent by design.

Example:

- the Claim can remain Active;
- one old Evidence source can be Superseded;
- a newer Evidence source can remain Active.

Retiring the final active Evidence source does **not** automatically retire the Claim. Relish flags the unsupported active Claim for human review instead of making a silent semantic decision.

### Support warnings

An Active Claim with zero active Evidence sources now shows `No active evidence`.

A structured Objective whose linked claims are all Superseded/Rejected shows `No active supporting claims` rather than appearing normally supported.

The Objective page lists its linked Claims with their current Claim status and links to the universal Claim detail page.

## Database migration

Migration:

`20260831201500_stage8_4_3_relationship_intelligence_ux`

It only:

- adds `KnowledgeEvidence.status` with default `ACTIVE`;
- creates the `(userId, claimId, status)` index.

Existing Evidence rows become Active. There are no deletes, table drops, column drops, or relationship-data rewrites.

## Test sequence

Stop the dev server and run:

```bash
npx prisma validate
npx prisma migrate dev
npx prisma generate
npm test
npm run check:stage8.4
npm run check:stage8.4.3
```

Expected Core suite for this release: **72 passed, 0 failed**.

`check:stage8.4.3` treats active claims with no active Evidence as reviewable information rather than a database-integrity failure. It fails only for orphaned or cross-tenant Evidence rows.

## Manual smoke test

1. Create/open a Contact note.
2. Click `Add relationship intelligence`.
3. Confirm the statement is pre-filled from the note/summary.
4. Select Offer and edit the statement once.
5. Click `Create offer`.
6. Confirm both the Claim and Offer exist without entering another Offer title.
7. Create a Fact and return to the Contact.
8. Click the Fact from Active Knowledge and Supersede it.
9. Confirm it disappears from Active Knowledge and appears under the collapsed Knowledge history section.
10. Restore it from the Claim detail page and confirm it returns to Active Knowledge.
11. On an active Claim, Supersede its only Evidence source.
12. Confirm the Claim remains active but shows `No active evidence`.
13. Supersede the Claim itself and confirm it leaves Active Knowledge.
14. For an Objective created from that Claim, confirm the Objective remains a separate persistent record but displays the `No active supporting claims` warning.

## Deliberate non-behaviour

Stage 8.4.3 does not automatically change a Want, Offer, or Objective lifecycle when a supporting Claim is superseded or rejected. Structured records may have been independently confirmed or manually maintained. Relish surfaces the support state and leaves the semantic decision explicit.
