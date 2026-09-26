# Relish Stage 8.12.7 - install and test

This is a **complete source replacement** based on Stage 8.12.6. Keep your `.env`, backing database and a backup of your current code. No database migration was added. The existing Catalina-compatible `package-lock.json` is unchanged.

## Install and run ordinary tests

```bash
cd ~/Coding/RelationshipOS/relationship-os
npm ci
npx prisma validate
npx prisma migrate status
npx prisma generate

npm run check:stage8.12.7
npm test
npm run check
npm run build
```

`npm test` includes the previous `.test.ts` and `.test.mjs` Core suites. The new four diagnostic regression tests are included automatically. Live database integration remains separately protected behind `npm run test:db` and its existing explicit development-database opt-in.

## Enable development-only diagnostics

Add the following to **local development `.env` only** (do not add it in production or commit it to source control):

```bash
DATING_KNOWLEDGE_DIAGNOSTICS=YES
```

With `NODE_ENV` not set to `production`, restart `npm run dev`. Open Dating > People > the person > Personal history, choose **Propose knowledge from this reflection**, explicitly allow AI processing and request suggestions. Expand **Development diagnostics - candidate counts only** above the suggestion list.

For the long reflection used in your previous tests, note the first-pass count, second-pass count, combined distinct-eligible count, duplicates removed, final count and repeated evidence quote count. Also inspect the wording of the proposed statements: the diagnostic checks cannot tell whether Dorian faithfully preserved uncertainty or whether a repeated quote supports different statements.

To switch diagnostics off, remove the environment variable and restart the dev server. The in-memory reports are not added to the database or ordinary logs.

## What to compare

- If explicit uncertainty never appears in the first or second AI pass, improve extraction prompts, examples or model choice.
- If it appears in a pass but not the combined eligible candidates, inspect evidence validation and overlap removal.
- If it survives combined selection but does not appear among the first 12, use subsequent review pages.
- Repeated quotations alone do not prove duplicate *statements*: inspect their editable wording and kind before changing the overlap policy.

## Verification performed in the package-building environment

76/76 JavaScript (`.mjs`) Core tests passed, including the four new targeted tests; three edited TypeScript files passed syntax parsing; ZIP integrity and the exact unchanged lockfile are checked at packaging. `npm test`, the full Svelte/TypeScript check, build, actual AI responses and live PostgreSQL integration must be verified locally after `npm ci`. The packaging environment does not have the project dependencies installed.
