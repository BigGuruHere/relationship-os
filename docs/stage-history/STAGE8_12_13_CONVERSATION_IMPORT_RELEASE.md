# Stage 8.12.13 - Conversation transcript import

## Scope delivered

Dating > People > **Import conversation** opens `/dating/conversations/import`. Paste a labelled transcript or select a local `.txt` or `.md` file. Preview labels and deliberately map each speaker to an existing Dating person or skip extracting that speaker. Confirm permission to retain the transcript before importing.

The whole source is retained encrypted in a private, custody-local `DATING_CONVERSATION_TRANSCRIPT` Interaction. Only the mapped speaker's verbatim turns are separated into individually encrypted, private `CONVERSATION_EXCERPT` sources under their own Contact. The existing source-review workflow accepts these excerpts as evidence, with operator attribution retained. Open each resulting excerpt, separately opt in to AI extraction, review supported suggestions and explicitly assign confirmed claims to topics. A raw transcript is not automatically passed to AI on import; nothing is automatically participant-confirmed or disclosed.

The import is idempotent for identical transcript and speaker mappings in the same owner/ContextSpace. It uses an advisory transaction lock and checks ownership before writing. It does not create a new Person or new relationships and does not expose one person's excerpt to another person's understanding. Up to eight distinct speaker labels, 600 turns and 60,000 characters are accepted. Long individual turns over 4,800 characters must be divided; long speaker contributions are divided into 4,800-character maximum excerpt chunks (up to 16 each, 50 total).

## Limits and next improvement

This is an **externally transcribed conversation** workflow, not in-app recording or real-time dialogue. Speech-to-text, automatic speaker diarisation, participant self-confirmation, automatic comparison classifications and bulk all-speaker AI processing are not provided. Exact speaker attribution must be checked by the operator, and only explicit labelled turns are accepted. User-provided transcripts are untrusted data. A speaker's statement about another person remains a report from that speaker. A participant's conversation consent must be obtained as applicable before importing, and AI-processing consent is requested separately when the operator opens an excerpt for extraction. The UI currently asks the operator to open each excerpt separately.

## Changed files

- `src/lib/server/datingTranscriptImportPolicy.ts` - strict label parser, identity mapping and bounded speaker excerpt generation.
- `src/lib/server/datingTranscriptImport.ts` - encrypted original and scoped excerpt persistence, idempotency.
- `src/routes/dating/conversations/import/+page.server.ts` and `+page.svelte` - preview, mapping, permission and import interface.
- `src/lib/server/datingLivingUnderstanding.ts`, `datingPersonHistory.ts` and the person/history/understanding UI - evidence and history support for imported excerpts.
- `tests/core/stage8-12-13-transcript-import.test.mjs`, `package.json` - permanent deterministic regression tests and focused script.

No migration, `.env` or lockfile changes. Full TypeScript, Svelte compilation, DB trigger integration and browser acceptance remain unverified until run on a designated development machine.
