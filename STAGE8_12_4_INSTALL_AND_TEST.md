# Relish Stage 8.12.4 - Dorian-assisted Knowledge Extraction

## Scope
From a Dating person's **personal reflection**, the operator can opt in to AI processing, receive up to 12 proposed individual knowledge elements, edit each, and independently choose Save proposal, Confirm as operator, Not sure yet, Reject, or Do not save. Save all reviewed choices in one submission. The original reflection and its custody are preserved. The model is not authorised to disclose any data. AI-proposed origin is distinguished from operator confirmation. Existing manual proposals continue to work.

**Limitations:** Initial extraction supports personal reflections recorded in Dating → People; introduction/voice/touchpoint review extraction will require a separate integration. The 12-element cap is an early-pilot limit. Repeated sequential submissions are deduplicated against the same source and type/statement; concurrent identical batches are not yet covered by a database-level unique constraint. An unavailable provider leaves the manual form operational.

**Privacy:** AI processing sends selected private reflection text to the configured OpenAI API only after explicit operator opt-in. Ensure you have appropriate authority to do this and review applicable data handling before using others' sensitive personal information. Operator confirmation is not the participant's verification or disclosure permission.

**Database:** No new migrations. Existing 79 migration directories unchanged. Catalina-compatible `package-lock.json` unchanged. No dependency updates in this release.

## Installation - Mac / Catalina

1. Keep a copy of local edits and your `.env` before replacing the project with the Stage 8.12.4 source.
2. From Terminal:

```bash
cd ~/Coding/RelationshipOS/relationship-os
npm ci
npx prisma validate
npx prisma migrate status
npx prisma generate
npm run check:stage8.12.4
npm run check:stage8.12.3
npm run check:stage8.12.2
npm run check
npm run build
```

If migrations are pending, verify this is the **development** database before taking any migration action. Decline any unexpected database reset.

## Configure AI

Set `OPENAI_API_KEY` in your local `.env` for this pilot. The default model is `gpt-4o-mini`; optionally set `DATING_KNOWLEDGE_MODEL` to a compatible JSON-mode model. Do not commit your key. The selected private reflection is sent to the provider only after you check the explicit opt-in box.

## Browser acceptance

```bash
npm run dev
```

1. Go to Dating → People, open a person and add a **personal reflection** containing several clearly distinct observations.
2. From the personal reflection, choose **Propose knowledge from this reflection**.
3. The Living Understanding screen should display **Dorian-assisted knowledge suggestions** above the manual entry form.
4. Check permission to process the selected reflection and click **Suggest knowledge from reflection**.
5. Verify that each suggested element has a verbatim supporting passage. Correct an inaccurate statement, independently choose Confirm, Save proposal, Not sure yet or Reject for several others, and choose Do not save for one.
6. Press **Save reviewed suggestions** once. Current knowledge should include only operator-confirmed items. Unconfirmed and rejected records remain separately reviewable in Existing statements, and no skipped item is recorded.
7. Check a saved suggestion's History. Original proposal should be labelled **Suggested by Dorian**; a review should still be attributed to the **operator**.
8. Re-run extraction against the same reflection. Saving the same text/type should not add additional proposals in ordinary sequential use. Try a different person to verify the first person's private material isn't visible.
9. If the provider is not configured or unavailable, the UI should explain that suggestions were unavailable and allow manual entry.

## Test status and outstanding verification

The included Stage 8.12.4 source-structure checks plus the previous 8.12.3 checks pass in the packaging environment. They do **not** establish that the live model request, Svelte/TypeScript compilation, full PostgreSQL workflow or Safari browser experience work. Run `npm run check`, `npm run build`, and the browser acceptance steps on your Mac. Continue to treat the deferred dependency vulnerabilities as pre-external-pilot work.
