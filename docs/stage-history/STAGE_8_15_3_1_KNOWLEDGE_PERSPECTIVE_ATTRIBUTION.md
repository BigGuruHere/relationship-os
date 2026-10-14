# Stage 8.15.3.1 - Knowledge perspective attribution

## Purpose
Make an explicit distinction between a contact-reported statement, a private observation of the note owner, and the owner's understanding of the relationship. This is a **bounded foundation**, not an automatic note-to-Living-Understanding pipeline.

## Delivered
- Add `KnowledgePerspective` to Core `KnowledgeClaim` with four values: `UNSPECIFIED_LEGACY`, `CONTACT_REPORTED`, `OWNER_OBSERVATION`, and `RELATIONSHIP_PERSPECTIVE`.
- Add a forward-only SQL migration. Existing claims are marked `UNSPECIFIED_LEGACY`, not assumed to represent contact speech.
- In the existing Business Contacts > Interaction > Add relationship intelligence form, require an explicit perspective selection, defaulting to `OWNER_OBSERVATION`.
- Keep perspective separate from claim `kind`, evidence authority/confidence and all privacy/disclosure controls.
- Preserve distinct claims when their statements match but their recorded perspectives differ.
- Display the selected perspective alongside existing knowledge claims in the note detail screen.
- Keep existing encrypted statement and scoped evidence records, with no automatic cross-person LU incorporation.

## Database
Forward migration: `20261013180000_stage8_15_3_1_knowledge_perspectives`.

Run `npx prisma validate`, `npx prisma migrate dev`, and `npx prisma generate` against the development database. Never run `migrate dev` or `db push` against production. Production remains on the established Railway `migrate deploy` workflow. Review other pending migration files before pushing.

## UI acceptance tests

### Test 1 - Contact-reported statement
1. Open **Business > Contacts**, select a development contact, open an Interaction.
2. Click **Add relationship intelligence**.
3. Choose **Something the contact said or reported**.
4. Use an actual attributed statement, e.g. `Jake told me he wants to expand interstate`.
5. Save as `Fact` or another appropriate kind.
6. Confirm the claim appears with **Something the contact said or reported** next to it.

### Test 2 - Owner observation
1. Use a note about the same development contact.
2. Open **Add relationship intelligence**, keep default **My observation or interpretation**.
3. Enter `I think Jake is cautious about partnerships`.
4. Save and check the owner-observation label appears.

### Test 3 - Relationship perspective
1. Select **My perspective on our relationship**.
2. Choose `Relationship state` as kind and enter `I feel our working relationship has become more trusting`.
3. Save and confirm both kind and perspective labels appear.

### Test 4 - Correction source integrity
1. Correct the original note using the existing correction workflow.
2. Confirm the original interaction and previously captured claims are unchanged.
3. Capture a new perspective from the correction if needed; confirm its source is the correction.

### Test 5 - Isolation
Check that knowledge claims remain accessible only to the owning user in their intended ContextSpace; perspective selection is not sharing permission.

## Verification / limits
- Source-contract tests: 3 passed locally; Stage 8.15.3: 3 passed; Stage 8.15.2.1: 2 passed; Stage 8.14.6: 3 passed. Stage 8.15.2 policy tests passed using Node's `--experimental-strip-types` switch.
- No dependency install, Prisma CLI validation, Svelte check, live database migration or browser tests ran in the packaging environment.
- Existing claims are **not** retroactively classified. `UNSPECIFIED_LEGACY` must not be interpreted as a verified contact report.
- No new automatic LU proposals, inference-based matching, cross-participant updates or disclosure permissions are added.
- The existing claim capture still relies on user-entered attribution; it does not independently verify the truth of statements.

## Next work
Before generating cross-person understanding proposals, introduce explicit governed subjects (person, owner's contact perspective, owner's relationship perspective), source eligibility and an approval path. Avoid silently reusing contact-authored or owner-authored knowledge as the contact's self-reported personal LU.
