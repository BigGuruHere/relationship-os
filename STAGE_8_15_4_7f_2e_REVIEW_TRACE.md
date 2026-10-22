# Stage 8.15.4.7f.2e - Read-only automatic impact review trace

## Scope
- Retain completed **automatic impact** drafts for 30 days instead of one hour. Manual completed drafts still retain their former one-hour expiry.
- Show an existing completed, encrypted impact pipeline trace on the Dorian Conversation Monitor detail page within the existing pilot operator and participant-custody checks.
- Do not recreate discarded AI traces. The initial adoption pathway is different and is **not** archived by this increment.
- Show the already stored impact stages: impact analysis, topic proposal, semantic validation, bounded repair and final candidate.
- Do not expose approval tokens, use a second memory store or modify authoritative revisions.

## Install
Back up/commit before extracting the overlay into the project root. It contains three source files. Check newer local modifications carefully; the overlay was prepared against the latest *available* Stage 8.15.4.7f.2d monitor source, not independently verified against your live checkout.

**Prisma migration: None.** No schema changes.
**Local build: Not required.**

```powershell
# Check application types and Svelte pages.
npm run check

# Start local development as usual.
npm run dev -- --port 8080
```

## Verify
1. Open `/general/admin/dorian-conversations` as the authorised pilot operator.
2. Select a call that produced an automatically applied **impact** revision, not the initial revision.
3. Under *Original automatic impact review*, inspect its saved analysis stages. Cross-check the linked authoritative revision and original transcript.
4. For an initial revision or unavailable/expired draft, verify that the UI explicitly says the trace is unavailable without constructing one.
5. Ensure another user's non-pilot conversations cannot be opened from the monitor.

## Limits and safety
- Automatic impact traces completed before this code was installed may have expired under the earlier one-hour TTL. This change does not restore expired/deleted records.
- This does not add permanent retention of initial-adoption semantic and structural stages.
- The 30-day retention is a provisional development-pilot policy; assess privacy, access, deletion and data minimisation before external pilot rollout.
- The inspector shows persisted analysis payloads which may contain sensitive personal data. Keep the operator route strictly restricted to authorised pilot review.
- No live Neon integration run or full `npm run check` was possible in this environment; verify locally before relying on the changes.
- A later stage still needs authorised next-call Living Understanding retrieval and worker recovery.
