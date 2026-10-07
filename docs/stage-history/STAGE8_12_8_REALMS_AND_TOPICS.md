# Stage 8.12.8 - Realms and Topics

## Purpose

Living Understanding is no longer restricted to a flat list of active knowledge. An operator can create stable, private topics inside life realms and explicitly assign any existing *active* claim to one or several topics. The original `KnowledgeClaim` and `KnowledgeEvidence` remain canonical; topic links never duplicate statements or source reflections.

The initial realm vocabulary is: Romantic relationships, Friendships and social life, Work and business, Family, Lifestyle and interests, Values and life direction, and Other and emerging. These keys are intentionally expandable and are not an assertion that every person's life fits the same list. A topic (such as Preferred partner, Relationship readiness or Desired relationship) is operator-named, encrypted and private to one contact in one Dating ContextSpace.

## How to use

Open Dating > People > the person > Living Understanding. Under **Realms and topics**, choose a realm and create a named topic. Under **Assign existing knowledge**, choose an active statement and select a topic. Repeat to link the same statement to another topic. Remove from this topic unlinks the organisation only, leaving the claim and its source evidence intact. The current flat list and all earlier proposal/edit/history controls remain visible.

A local phrase-based hint can suggest a realm for an unassigned statement. Hints are not AI confirmations or assignments. The user must create/choose a topic and explicitly assign each statement. No existing statements are automatically migrated to realms.

## Data and custody

The additive schema has `UnderstandingRealm`, `UnderstandingTopic`, and `UnderstandingTopicClaim`. Every record requires explicit `userId`, `contextSpaceId` and `contactId`. Prisma relation boundaries and PostgreSQL composite foreign keys prevent cross-person topic associations. The claim-topic table additionally checks same-person claim ownership in a trigger to prevent cross-person links through a same-space claim ID. Old Stage 8.6 owner and immutable-custody triggers protect all three new tables. All realm/topic labels are encrypted at rest; stable realm keys and HMAC topic name indices are the only new cleartext classification metadata.

**Assignment is an operator action only.** It does not elevate a statement to participant-confirmed, imply sharing consent, or cause copying between ContextSpaces. The current UI shows only active claims under each topic. Earlier claims and reflections continue in the underlying existing history. Automatic reconciliation of changed claims is reserved for a later stage.

## Permanent tests

`npm test` includes `stage8-12-8-realms-topics.test.mjs` and the updated Stage 8.6 schema/custody inventory. `npm run check:stage8.12.8` runs the focused new tests. `npm run test:db` includes `check-stage8-12-8-realms-topics-db.ts`, which is gated by `ALLOW_DATING_DEV_DB_TEST=YES` and the existing development-only Dating fixture IDs. The integration script creates disposable people and tests topic creation, idempotent and multiple assignments, cross-person rejection at service and SQL boundaries, unlink without knowledge deletion and fixture cleanup. Do not point these scripts at a production database.

## Deliberately deferred

AI-selected topic assignment, automatic topic update/supersession, person-led confirmation, fine-grained disclosure and cross-context matching are *not* introduced in Stage 8.12.8. The existing dependency security review is separate.
