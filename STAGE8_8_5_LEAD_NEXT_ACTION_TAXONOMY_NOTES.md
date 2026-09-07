# Stage 8.8.5 - Reusable Lead Next Action Taxonomy

## Purpose

Stage 8.8.5 makes `MarketLead.nextAction` a creatable Workspace vocabulary while preserving the fast inline workflow introduced in 8.8.4.

The user can choose a common Next Action or type a new one. A custom value is saved on the lead and remembered as a reusable option for later leads in the same ContextSpace.

## Default options

The initial built-in options are:

- Initiate contact
- Initial follow-up
- Await response
- Nurture contact
- Research / find details
- No further action

These defaults are application constants and do not require seed rows.

## Creatable dropdown behaviour

The lead Details panel and the full Edit Lead form use the same creatable dropdown source.

If the user types a new action such as:

`Send information pack`

Relish:

1. normalises whitespace;
2. validates a maximum length of 120 characters;
3. saves the value to `MarketLead.nextActionEnc` as before;
4. stores the reusable label in `LeadNextActionOption` if it is not a built-in option;
5. makes it available in the Next Action dropdown on future lead loads in that ContextSpace.

Case-only and whitespace-only variants do not create duplicates.

## New model

`LeadNextActionOption` is Workspace/context scoped:

- `userId`
- `contextSpaceId`
- `labelEnc`
- `labelIdx`
- timestamps

The label is encrypted at rest. `labelIdx` is a deterministic scoped HMAC used only for equality/deduplication.

Uniqueness is enforced by:

`userId + contextSpaceId + labelIdx`

The model is included in the Stage 8.6 Prisma custody interceptor and has database owner and custody-reassignment triggers.

Custom options in one ContextSpace do not become options in another ContextSpace belonging to the same owner.

## Current values from before 8.8.5

The current lead's existing Next Action is merged into the displayed option list even if it predates this release. Nothing is hidden or rewritten.

## Scope deliberately not expanded

Stage 8.8.5 does not change:

- Contact Attempt
- Priority
- Buyer or Seller status
- Notes
- lead identity/contact details
- other uses of `nextAction` on Deals, Tasks or relationship threads

The reusable taxonomy is being proven on MarketLead Next Action first.

## Migration

New migration:

`20260907144000_stage8_8_5_lead_next_action_options`

It creates only the new `LeadNextActionOption` table, indexes, foreign keys and custody triggers.

All 74 migration files inherited from 8.8.4 are byte-for-byte unchanged.

## Verification completed before packaging

- Full Core source suite: 162/162 passing
- Stage 8.8.5 focused suite: 7/7 passing
- Stage 8.6 custody suite: 25/25 passing after intentionally updating the direct ContextSpace model count from 45 to 46
- Stage 8.7 through 8.8.5 focused regression set: 41/41 passing
- Mutation proof: case-insensitive option deduplication was deliberately weakened and the Stage 8.8.5 suite failed; the source was restored and returned to 7/7 passing
- Existing migrations changed: 0
- New migrations: 1

A real PostgreSQL checker is included as `npm run check:stage8.8.5:db`. It creates temporary data, verifies custom-option persistence/deduplication and same-owner/different-ContextSpace isolation, then cleans up.
