# Stage 8.2 - Provenance + Minimal Introduction/Outcome

## Purpose

Stage 8.2 starts collecting two kinds of evidence needed before automated matching:

1. where important relationship intelligence came from and what authority it has;
2. real introductions and their outcomes over time.

This release does not add PotentialMatch, disclosure grants, cross-workspace access, Dorian integration, or automated matching.

## Provenance

Want and Offer now keep `confidence` and `authority` as separate axes.

Authority values:

- `LEGACY_UNSPECIFIED`
- `SELF_DECLARED`
- `THIRD_PARTY_REPORTED`
- `WORKSPACE_RECORDED`
- `PUBLIC_SOURCE`
- `INFERRED`
- `SYSTEM_DERIVED`

Source types:

- `MANUAL`
- `INTERACTION`
- `PUBLIC_RESEARCH`
- `AGENT`
- `IMPORT`
- `SYSTEM`
- `OTHER`

New Want/Offer fields:

- `authority`
- `sourceType`
- `sourceInteractionId`
- encrypted `sourceNoteEnc`
- `confirmedAt`

Existing Wants/Offers are deliberately migrated as `LEGACY_UNSPECIFIED`. Stage 8.2 does not guess who originally stated historical information.

New manual Want/Offer writes default to `THIRD_PARTY_REPORTED` + `MANUAL`, and the Workspace create/edit UI exposes Authority, Source, Last confirmed and an encrypted provenance note.

Agent-generated company acquisition criteria are marked `SYSTEM_DERIVED` + `AGENT`. Market Lead conversions are marked `THIRD_PARTY_REPORTED` + `MANUAL` with an encrypted source note.

## Introduction

`Introduction` is a real connection event, not a proposed match.

It stores:

- date/status;
- encrypted reason/context;
- encrypted notes/evidence;
- provenance authority/source;
- optional facilitator Contact;
- two sides through `IntroductionParticipant`.

Each side may reference a Contact, Company, or both. The database enforces one A side and one B side, and each participant must reference at least a Contact or Company.

Introduction deliberately has no `PotentialMatch`, `ExchangeItem`, Want or Offer foreign key in 8.2. This keeps the model independent while 8.3 consolidates Wants/Offers and later matching is learned from real evidence.

## Outcome

Outcomes are appendable observations rather than one mutable final result.

An Outcome can record:

- status;
- whether the introduction was useful;
- whether the relationship continued;
- commercial vs non-commercial result;
- optional commercial value in the existing `$m` input convention;
- encrypted result/notes/evidence;
- provenance authority/source;
- date.

Multiple Outcomes may be recorded against one Introduction as the relationship develops.

## Workspace UI

A new `/introductions` Workspace area allows manual Introduction creation.

`/introductions/[id]` shows the connection and lets the user:

- update Introduction status;
- append Outcome records;
- see provenance and accumulated outcome evidence.

## Migration

Migration:

`20260831150000_stage8_2_provenance_introductions_outcomes`

The migration is forward-only and non-destructive. It does not delete or rewrite existing relationship records.

Development:

```bash
npx prisma migrate dev
npx prisma generate
npm test
npm run check:stage8.2
```

Do not reset the database.

## Tests

Stage 8.2 adds Core tests for:

- authority vs confidence separation;
- non-destructive legacy provenance defaults;
- encrypted Want/Offer provenance notes;
- manual write provenance defaults;
- first-class Introduction independence from matching/ExchangeItem;
- A/B participant integrity;
- tenant validation of Introduction references;
- tenant validation of Outcome parent Introduction.

The Stage 8.1 test suite remains in place.

## Manual smoke test

1. Open an existing Want and confirm it shows `Legacy / unspecified` authority.
2. Edit that Want, choose an authority/source, add a provenance note and save.
3. Create a new Want and confirm it defaults to Third-party reported + Manual entry.
4. Repeat one Offer provenance edit/create.
5. Open Introductions and record a connection between two Contacts, Companies, or Contact/Company combinations.
6. Open the Introduction and record an Outcome.
7. Confirm the Outcome remains visible after refresh.
8. Add a second Outcome to confirm history is appendable rather than overwritten.
9. Run `npm run check:stage8.2` and confirm the final PASS line.

## Not included

- KnowledgeClaim reconciliation pipeline (8.4)
- Want/Offer/ExchangeItem consolidation (8.3)
- PotentialMatch
- disclosure/consent workflow
- cross-workspace matching
- Dorian v2
