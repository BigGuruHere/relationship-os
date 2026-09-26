# Stage 8.12.5 - Mac install and test

Keep your current `.env` and any Mac-only local changes before replacing source. The package contains the Stage 8.12.4 Catalina-compatible dependency lockfile and **no new migration**.

```bash
cd ~/Coding/RelationshipOS/relationship-os
npm ci
npx prisma validate
npx prisma migrate status
npx prisma generate
npm run check:stage8.12.5
npm run check:stage8.12.4
npm run check:stage8.12.3
npm run check
npm run build
```

If `migrate status` reports an unexpected migration or reset, stop and inspect. There is no new migration to apply for this stage. Do not run a forced dependency upgrade on Catalina.

## Live browser comparison

1. Start `npm run dev` and sign in to your local Dating workspace.
2. Go to Dating > People > select the test person > Personal History. Select the **same long personal reflection** from the earlier test, then choose *Propose knowledge*.
3. Confirm that `.env` has a valid `OPENAI_API_KEY`, that you're using an appropriate test reflection, and opt in to model processing.
4. Click *Suggest knowledge from reflection*. For a reflection of 600+ characters, the extractor ordinarily makes two provider requests. If the coverage request fails, the first-pass results are still returned.
5. Inspect for individually meaningful proposed elements covering personal interests (beach, tennis, music), professional life, social and romantic wants, time-specific goals, and uncertainty about relationship readiness. No fixed number is guaranteed.
6. Check each quotation against the original source. Correct broad/incorrect interpretations before confirming; defer uncertain items and skip anything misleading.
7. Save the reviewed suggestions. Confirm that active knowledge only contains operator-confirmed items; original reflection and proposal history should remain unchanged, and no disclosure is granted.

If model processing fails, use the manual *Add an understanding* workflow and inspect server logs without pasting private provider payloads into public channels.
