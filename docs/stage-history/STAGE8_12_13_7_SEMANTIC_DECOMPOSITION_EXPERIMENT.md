# Stage 8.12.13.7 - Semantic decomposition experiment

## Purpose

This development-only, read-only experiment tests a revised Relationship OS memory model:

1. Preserve immutable source history.
2. Maintain a coherent Living Understanding per semantic topic.
3. Create atomic knowledge only where independent operational control may matter.

Atomic knowledge is therefore not treated as the complete memory of the person. It is proposed selectively for information that may need independent verification, matching, permissioning, retrieval, disclosure or action.

## What changed

- The first model pass decomposes one private source into all materially distinct enduring areas of understanding.
- Each area is mapped to the narrowest suitable existing topic where possible.
- If no suitable topic exists, the model may suggest a new realm/topic. The experiment does not create it.
- Relationship goals, partner qualities, family intentions, readiness concerns and values are explicitly discouraged from being collapsed into one broad topic merely because they appear in the same conversation.
- A second pass produces one coherent proposed Living Understanding for each selected area.
- Existing topic statements are still explicitly accounted for and remain unchanged unless directly supported evidence justifies a proposed change.
- A separate operational-knowledge layer proposes only a small set of independently controllable units.
- One operational unit can link to several semantic areas without duplicating the unit.
- Exact evidence remains anchored to validated target-speaker turn IDs and is resolved locally from the authorised source.

## Privacy and custody boundaries

- The experiment remains behind `DATING_REVISION_EXPERIMENT=YES` and is unavailable in production.
- Explicit operator authorisation is required before each AI call.
- Source access remains scoped by user, Dating ContextSpace and person/contact before private content is exposed.
- Agent turns may provide context but cannot validate knowledge about the selected person.
- Hidden form state never carries source-turn text. Only bounded proposal metadata and turn IDs are carried, then revalidated server-side.
- No topic, understanding, knowledge unit, confirmation, permission or sharing rule is written to the database.

## Intended test with the Jemima transcript

A good result should separate concepts such as:

- Desired relationship
- Preferred partner
- Relationship readiness
- Family / Children
- Relationship values

The names do not have to be predefined. Existing narrow topics should be reused; missing topics should be suggested rather than created automatically.

The operational knowledge list should be materially smaller than the full nuanced understanding. For example, a desire for a committed relationship or probably wanting children may warrant independent control, while every reflective nuance does not automatically require its own permanent statement.

## Verification performed in packaging environment

- `npm run check:stage8.12.13.7`: 22/22 focused tests passed.
- `node --experimental-strip-types --test tests/core/*.test.mjs`: 139/139 JavaScript/MJS regression tests passed.
- `node --experimental-strip-types --check` passed for the changed TypeScript server files.
- `npm test` could not run because the packaging environment does not have the project's `tsx` dependency installed.
- No live model call, database test, Svelte check, production build or browser acceptance test was run in the packaging environment.

## Database

No Prisma schema change and no database migration are included in this stage.
