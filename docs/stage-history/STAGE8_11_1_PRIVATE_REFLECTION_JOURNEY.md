# Stage 8.11.1 - Private Reflection Journey

**Baseline:** Complete Stage 8.10.5 source with the original Catalina-compatible `package-lock.json`. The attempted dependency update remains postponed; this release does not resolve npm audit findings. No Prisma schema changes and **no new migration**.

## Delivered

- The existing Dating-scoped browser recording -> transcription -> human review -> approval flow remains in place, with an additional explanation on the recording page about checking the transcript before submitting.
- The review screen now asks the respondent to select a private next step before approving: explore, consider another meeting, pause, end or no next step. An optional, bounded private note can add context.
- The chosen next step is stored **only in the encrypted reviewed AgentArtifact**, not on the canonical Outcome or in plaintext audit JSON. The review page shows the choice and the respondent's **corrected, approved** reflection on later visits. Older approved reviews still load and show that no next step was recorded.
- Review can **narrow** previous matching/learning/disclosure preferences but cannot widen them. A next-step choice, including another meeting, never initiates contact, booking, automatic matching or disclosure. Future situational disclosure consent requires a separate implementation.
- The Stage 8.10.3 integration test now supplies a next step and verifies that it is retrieved after approval. Its existing concurrent approval, failed extraction retry and custody checks remain intact.
- Stage 8.11.1 adds five focused contract tests. Earlier Stage 8.10 source-inspection test was updated to reflect the reviewed-artifact encryption wrapper.

## Installing on your Catalina Mac

Replace project source from this ZIP while keeping your existing local `.env`. If you have local edits, merge instead of blindly overwriting. The lockfile has **not** been upgraded.

```bash
npm ci
npx prisma generate
npx prisma migrate status
npm run check:stage8.11.1
npm run check:stage8.10
npm run check:stage8.10.4:voice
npm run check
npm run build
```

Use your **development** database for the real integration test only after confirming `DATABASE_URL` and setting the usual test fixture IDs and `ALLOW_DATING_DEV_DB_TEST=YES`. The test cleans up only uniquely named fixtures; no reset is needed.

```bash
export DATING_TEST_USER_ID='69335c81-f1b0-4383-96aa-99007d622516'
export DATING_TEST_CONTEXT_SPACE_ID='32e74f61-4249-4768-b524-8c9a24bc3fd9'
export ALLOW_DATING_DEV_DB_TEST=YES
npm run check:stage8.10.3:db
```

## Manual browser acceptance

1. Open `/dating`, select an introduction and open its private reflection screen.
2. Record a voice note (or enter text) and inspect the completed transcript. Check the selected respondent and the permission confirmation.
3. Submit for review, edit an incorrect AI interpretation, choose `Pause and revisit later` and enter a short private note. Approve.
4. Open the same review again; it must show the corrected words and private next step. The Introduction still labels the approved Outcome as **one participant's report**, not mutual confirmation.
5. Repeat with a rejected proposal (no Outcome) and with no earlier disclosure permission; the review screen must not expand permission.
6. Validate a different owner and ContextSpace cannot access the review using the development database integration suite.

## Not included

No actual conversation with real-time spoken Dorian, no scheduling, follow-up agent, two-sided confirmation, automated matching, external notification or disclosure. This milestone completes the existing **asynchronous** voice-reflection review journey and records a private next step. Live microphone/provider testing and the postponed production dependency vulnerabilities remain pre-public-pilot checks.
