# Stage 8.12.13.6.2 - Install and test

## Purpose

Targeted read-only patch for the topic-aware Living Understanding revision experiment.

## What changed

- Exact transcript turn text is now displayed visibly under each validated source turn ID.
- Topic discovery is instructed to identify all materially affected existing topics and prefer the narrowest appropriate topic rather than allowing one broad topic to absorb unrelated concepts.
- Topic discovery now returns target-speaker turn IDs for each affected topic.
- Those validated turn IDs are carried into that topic's revision request, so each topic revision is grounded in its own relevant source turns.
- One proposed understanding remains separate for each selected existing topic.
- Existing claims remain conservative: silence in the new source does not retire or change old knowledge.
- Suggested new topics remain suggestions only. Nothing is created automatically.
- The experiment remains fully read-only.

## Database

No migration is included.

## Install

Replace your current source with the complete Stage 8.12.13.6.2 package, preserving your local `.env`.

```bash
cd ~/Coding/RelationshipOS/relationship-os
npm ci
npx prisma validate
npx prisma generate
npm test
npm run check
npm run build
npm run dev
```

Keep these development settings if you are using the experiment:

```dotenv
DATING_REVISION_EXPERIMENT=YES
DATING_REVISION_MODEL=gpt-6-luna
```

## Browser acceptance test

1. Open the same imported Jemima conversation.
2. Open the read-only Living Understanding revision experiment.
3. Authorise topic analysis.
4. Check that Dorian proposes multiple existing topics when the transcript contains materially different areas that fit those topics.
5. Confirm each affected topic displays relevant source turn IDs.
6. Generate selected topic revisions.
7. Confirm each topic has its own proposed understanding.
8. Confirm exact transcript text is visibly shown beneath every valid source turn reference.
9. Confirm partner traits do not get absorbed into `Desired relationship` when `Preferred partner` exists, and readiness concerns do not get absorbed there when `Relationship readiness` exists.
10. Confirm old unmentioned statements remain `UNCHANGED` unless supported evidence proposes otherwise.
11. Confirm no claims, topics, permissions, summaries or status changes are written by the experiment.

## Verification performed while packaging

Focused Stage 8.12.13.5 + 8.12.13.6 tests: 17 passed.

A raw `node --test tests/core/*.test.mjs` run is not a valid full-suite substitute in this packaging environment because several older MJS tests import TypeScript modules directly and require the project's normal `tsx`/npm test runner. Those tests failed to load `.ts` files rather than reporting application regressions. Run `npm test`, `npm run check` and `npm run build` on your Mac with dependencies installed.

No live AI call, database integration test or browser acceptance test was performed in the packaging environment.
