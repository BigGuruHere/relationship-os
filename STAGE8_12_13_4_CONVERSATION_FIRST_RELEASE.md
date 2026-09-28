# Relish Stage 8.12.13.4 - Conversation-first extraction

## Changes

- A new transcript import creates a **single private review source for each included speaker**, rather than exposing 4,800-character excerpt boundaries as separate reflections. Skipped speakers receive no person-level knowledge source.
- The complete original is retained encrypted in its existing `DATING_CONVERSATION_TRANSCRIPT` record. Each included speaker's statements are separately encrypted in the owned, same-space person source. Existing custody guards remain required.
- On an explicitly authorised knowledge-extraction request, the backend retrieves the scoped parent conversation and supplies both sides to Dorian as context, while the evidence validator checks quotes solely against the included person's source. Agent text is not independent evidence about the user.
- Longer conversations use internal context windows without adding extra records or review links. Unusually long single turns are broken into internal model windows while remaining intact in the stored source.
- The review page offers an expandable view of the entire original conversation. AI consent states clearly that the whole conversation, including excluded speakers' dialogue as context, will be processed.
- Literal evidence retrieval recovers a continuous original source passage despite some speech-to-text joined-word errors such as `alsobring` / `also bring`. It does not join separate quotations, accept unsupported paraphrases or turn contextual agent text into the selected person's evidence.
- Model instructions discourage conversational instructions and duplicate or unqualified claims. The development-only rejected-candidate inspection remains available.

## Compatibility and scope

- No new database migration. The Stage 8.12.13.2 `Interaction_subject_required` migration must already be present for transcript imports to succeed.
- A versioned import fingerprint deliberately allows one new consolidated import of a transcript previously imported under Stage 8.12.13.3; repeated imports within this release remain idempotent. Earlier split excerpts are not deleted or automatically merged.
- Historical reflections and existing Stage 8.12.13.3 imports remain readable with their existing behaviour; reimport the same transcript to exercise the new workflow.
- The conversation source is still an operator-reviewed pilot. Source quoting and deterministic regression tests cannot guarantee semantic accuracy. Confirm each proposed claim before retaining it.
- Existing `package-lock.json` and environment files are unchanged. Do not copy local secrets into the source ZIP.

## Verification

117 JavaScript/MJS deterministic regressions passed, including 5 new conversation-first tests. `npm test` could not execute because the offline environment lacks `tsx`; `npm run check` could not execute because it lacks `svelte-kit`. Real database, migrations and browser workflows were not exercised in this packaging environment.
