# Stage 8.14.1 - Provider-Aware Conversation Ingestion Foundation

## Purpose

Stage 8.14.1 turns the existing Stage 8.12.13 transcript-import pilot into the canonical conversation-ingestion path that later provider adapters, especially ElevenLabs, can feed without creating a second transcript system.

The first adapter remains manual paste/file import. The persisted source is now provider-aware and turn-aware.

## Architectural result

The flow is:

Conversation provider or manual import
-> provider-independent encrypted conversation source
-> stable ordered speaker turns
-> person-specific private conversation source
-> initial or longitudinal Living Understanding workflow

The Living Understanding engine does not care whether the conversation arrived by manual paste, file upload, a future ElevenLabs webhook or a future ElevenLabs API pull.

## New core conversation envelope

`src/lib/server/core/conversationIngestion.ts` defines:

- generic conversation transcript and person-source channels
- provider metadata (`ELEVENLABS`, `MANUAL`, `OTHER`)
- ingestion methods (`MANUAL_PASTE`, `FILE_UPLOAD`, `ELEVENLABS_WEBHOOK`, `ELEVENLABS_API`, `OTHER`)
- stable conversation metadata validation
- hashed provider external-reference identity
- provider-independent encrypted conversation payload construction

Provider conversation IDs are retained inside the encrypted payload, but the plaintext `Interaction.externalRef` contains only a SHA-256 digest of that provider ID.

## Stable speaker turns

Speaker-labelled imports now receive durable ordered turn IDs:

- `T001`
- `T002`
- `T003`
- ...

The encrypted parent conversation stores the full raw transcript plus these turns. Person-specific sources store the IDs of the turns spoken by that person.

For new conversation sources, the Living Understanding pipeline reuses the persisted turn IDs. Legacy Stage 8.12 conversations are still supported by reparsing the original encrypted transcript.

## Speaker evidence rule

The full conversation remains contextual source.

Only the mapped person's own turns are direct evidence about that person. Agent/assistant turns can remain in the parent conversation as context without becoming first-person evidence.

## Compatibility

New imports write the generic channels:

- `CONVERSATION_TRANSCRIPT`
- `PERSON_CONVERSATION_SOURCE`

Readers remain backward compatible with legacy:

- `DATING_CONVERSATION_TRANSCRIPT`
- `DATING_PERSON_REFLECTION`

No old conversation or Living Understanding data needs migration.

## Idempotency

When a provider conversation ID is supplied, identity is based on the scoped provider + hashed external conversation ID.

When no provider ID exists, identity falls back to the exact transcript plus explicit speaker mapping.

The importer also checks the legacy Stage 8.12 fingerprint so re-importing an old manually imported transcript after upgrade does not create a duplicate source.

## Operator workflow

The existing `/dating/conversations/import` surface now collects optional source metadata:

- provider
- agent name
- external conversation ID
- occurred date/time

When entered from a person's page using `?personId=...`, common labels such as `User`, `Participant` and `Caller` preselect that person, while `Agent`, `Assistant` and `Dorian` default to context-only.

After import, Relish checks whether the participant has an authoritative Living Understanding and presents the correct next action directly:

- no baseline -> Create initial Living Understanding
- baseline exists -> Review impact on Living Understanding

## Privacy and authority

Import permission remains separate from:

- AI-processing permission
- matching permission
- disclosure permission

Import itself performs no model call.

## Future ElevenLabs adapter

Stage 8.14.2 can resolve a caller/person and map an ElevenLabs completed-conversation payload into this same source model using:

- `provider = ELEVENLABS`
- `ingestMethod = ELEVENLABS_WEBHOOK` or `ELEVENLABS_API`
- provider `externalConversationId`
- stable speaker turns

No Living Understanding redesign should be required.

## Database

No Prisma schema migration is introduced in Stage 8.14.1. Existing `Interaction` custody, encryption and provenance are used.

## Verification performed in packaging environment

- `npm run check:stage8.14.1` - 74/74 tests passed
- focused transcript/ingestion regression set - 19/19 tests passed
- `node scripts/check-migration-integrity.mjs` - 81/81 deployed migrations unchanged

The packaging environment does not contain the project's installed `node_modules`, so full `npm run check` must be rerun in the development checkout. The Stage 8.14.0.5 baseline supplied by the operator was already 0 errors / 0 warnings before this update.
