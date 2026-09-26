# Stage 8.12.9 - Install and test

This complete ZIP replaces Stage 8.12.8. Preserve your existing `.env`, database, user uploads and any uncommitted local changes. The Catalina-compatible `package-lock.json` is unchanged. **No new database migration** is required, provided Stage 8.12.8 has already been deployed to your development database.

## Mac commands
```bash
cd ~/Coding/RelationshipOS/relationship-os
npm ci
npx prisma validate
npx prisma migrate status
npx prisma generate
npm run check:stage8.12.9
npm test
npm run check
npm run build
npm run dev
```

If Stage 8.12.8 was not migrated, deploy its existing migration against your **development** database before testing. Never reset production data for this UI change.

## Browser walkthrough
1. Dating > People > select an existing person > Personal reflections > Add reflection. Save it. You should return to Personal Reflections with the just-saved entry highlighted rather than being taken into a long Living Understanding overview.
2. Click **Review reflection and suggest knowledge** on that entry. Confirm the page starts with the original reflection and focused suggestions, without all existing knowledge and topic cards above the form.
3. Explicitly check the model-processing consent and generate suggestions. Review that the editable knowledge **statement** appears before the **supporting passage**. Confirm one, defer one, skip one and save. Confirm that the result returns to Living Understanding and explains how to organise the statements.
4. Create a topic if needed. Use **Assign a statement to a topic**. Select one statement and confirm the prominent card shows its full wording and existing assignments before you choose a topic. Assign it; verify that statement remains selected and the topic now appears among its assignments. Attempt assigning again: the topic must be disabled.
5. Assign that same statement to a second topic and then remove only one topic assignment. Its underlying knowledge and evidence must remain unchanged.
6. Open **All current knowledge** and **Existing proposals and review history** only when needed.
7. Confirm the original reflection is still present under Personal History.

## Verification limits
The packaged source passed 85 standalone JavaScript tests. The packaging environment could not install dependencies from an offline npm cache (zod@4.1.8 was not cached); `npm test` including the TypeScript suite, Svelte type-check/build, and live database/browser tests must run on your Mac. No database test is included in ordinary `npm test`; explicitly authorise the development database before `npm run test:db` per the prior guide.
