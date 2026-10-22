# Stage 8.15.4.7f.2c - Dorian Conversation Monitor (operator read-only increment)

## Delivered

- New `/general/admin/dorian-conversations` page for completed and pending imported telephone conversations.
- Links into read-only call detail showing summary, participant-specific transcript and exact originating authoritative revision when an explicit `LivingUnderstandingRevisionSource` exists.
- Keeps applied conversations visible rather than treating them as vanished from the pending review inbox.
- Requires signed-in General context User with owner role; limits sessions to ElevenLabs provider bindings owned by that operator and that ContextSpace; reads participant data via existing named read-only `PILOT_PHONE_REVIEW` cross-custody policy.
- No automatic approval or Living Understanding persistence changes.

## Important limitations

- Current baseline was built from the last uploaded Stage 8.15.4.7f.2b archive, **not the operator's latest checkout**. Use the overlay ZIP to preserve the newer local pilot-review page.
- Lists up to 250 recent agent sessions, looking up to 250 source interactions per participant. Optimisation/pagination is later work.
- Only imported participant evidence can appear. Calls with no participant speech or missing webhook are excluded.
- Shows the authoritative revision number and original source evidence, but does **not yet reproduce each intermediate semantic attribution/review stage** or provide access to the participant's private revision editor. Those require carefully scoped read-only application APIs.
- `PENDING` means no explicit source-to-revision link was found, not necessarily that a worker is presently running.
- Not yet tested against the live Neon development database or SvelteKit compilation.
- No next-call private understanding handoff, worker recovery or automatic scheduling changes here.

## Installation

Back up or commit local files. Extract the overlay ZIP into the RelationshipOS root while retaining local `.env`, your `pilot-phone-reviews` route and all other local updates. Do not use the baseline ZIP to overwrite your newer checkout.

**Prisma migration: No.**

**Local build: Not needed.**

Run:

```powershell
# Check all SvelteKit and TypeScript changes.
npm run check

# Start the development server.
npm run dev -- --port 8080
```

Then open:

`http://localhost:8080/general/admin/dorian-conversations`

Inspect a call that was automatically imported and approved. It should appear under All and Applied to understanding, with a link to its detail page and the actual revision number sourced from `LivingUnderstandingRevisionSource`.

## Acceptance / follow-up checks

- Owner account can open the monitor.
- Non-owner / unauthenticated callers cannot access the monitor or deep-link into details.
- Automatically approved call remains visible after approval.
- Revision number corresponds to this exact source (not the latest unrelated revision).
- Two provisional callers remain in separate ContextSpaces.
- Verify review artifact retention and design a secure historical read-only view of topic attribution, comparison and approval steps.
- Run the live phone tests and confirm results; no database integration tests were run during packaging.
