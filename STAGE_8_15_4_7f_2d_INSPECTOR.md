# Stage 8.15.4.7f.2d - Read-only Living Understanding Inspector

## Scope
Adds a saved-revision inspector to the existing Dorian Conversation Monitor detail page. This is an overlay intended for the current local project with its additional pilot admin pages.

- Starts from the 8.15.4.7f.2c.2 monitor custody fix and preserves the Contact.id fix.
- Reads only the authoritative LivingUnderstandingRevision linked to the selected source Interaction.
- Displays the revision's topic text, prior-revision text (if any), change status, operation label and counted source links.
- Reuses read-only pilot operator authorisation and participant custody rules. No approval, editing or sharing capability is introduced.
- Does not invent intermediate AI reasoning or imply transient drafts are persisted.

## Install
Back up or commit first, then extract the overlay in the root of your existing RelationshipOS project, replacing the matching two files. Keep all .env files and local pilot review pages.

**Prisma migration: NO.**
**Local npm build: NOT REQUIRED.**

Run:

```powershell
# Verify current SvelteKit and TypeScript code.
npm run check

# Start the local development application.
npm run dev -- --port 8080
```

Open `http://localhost:8080/general/admin/dorian-conversations`, select the call with an applied revision, and inspect the new section in the conversation detail.

## Acceptance tests
1. An applied conversation shows the exact linked revision number and its saved topic understanding.
2. A subsequent revision shows previous and current values; unchanged topics remain marked unchanged.
3. A pending call does not claim any saved revision details.
4. A non-operator is denied; a different caller's data is not accessible by guessing a URL.
5. Confirm revision provenance, especially when a topic's source evidence was created by a different earlier conversation.

## Limits and security
This is a read-only display of persisted authoritative revision snapshots and their linked source identifiers. It does NOT display every intermediate manual review step, because those may be transient or not saved. It has not been validated against the user's live Neon database or their newest local checkout. Operator access must remain restricted to explicitly authorised pilot environments and participants. The shared `PILOT_PHONE_REVIEW` custody rule remains read-only. The lookup is limited to a revision already linked to the selected imported call.

Auto-worker operation and next-call memory retrieval are not changed in this stage.
