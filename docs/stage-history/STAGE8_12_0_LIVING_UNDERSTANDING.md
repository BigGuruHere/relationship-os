# Stage 8.12.0 - Living Understanding and Core Profile Foundation

## Purpose

Relish supports a person living a life in relationship with others. Dorian's individual understanding must precede introductions. The eventual core-profile view can draw upon individual context-scoped, provenance-backed claims, but it must never merge or disclose information across custody contexts without an explicit grant.

## What this pilot implements

- An initial one-line proposed understanding per Dating directory participant, with additional statements as needed.
- A review interface with Confirm, Not sure yet and Reject, an editable statement and append-only encrypted review history.
- Confirmed statements are promoted to existing context-local KnowledgeClaim and KnowledgeEvidence with an originating Interaction. Changing or withdrawing a statement retires that proposal's evidence rather than silently rewriting the earlier source.
- A clear label that the current operator's confirmation **does not** establish that the participant personally confirmed it, nor does it authorise disclosure. Authority is THIRD_PARTY_REPORTED with LOW confidence until an actual participant approval flow is built.
- The initial Dating reflections do NOT automatically promote knowledge. A proposed understanding must be separately reviewed. No globally visible Person profile table is introduced.
- The existing 78 migrations, Introduction, Outcome and review workflows are unchanged. All relevant records use the same Dating ContextSpace.

## Stage 8.12.1 - Mandatory architecture gate

Before adding multiple touchpoints (8.12.2), inspect Introduction, Interaction, Contact, Person, KnowledgeClaim and existing provenance. Decide how Relating owns its history and introductions/touchpoints attach, where individual reflections remain in separate custody, how independently confirmed relationship forms differ from participant interpretations and which forward-only migration or compatibility layer is needed. No expansion of Introduction into a general touchpoint table before approval of this architecture decision.

## Outstanding work

1. Actual participant review/confirmation of their own account: do not mistake an operator review for this.
2. Extraction from Dating reflections into **proposed**, separately reviewable knowledge, including mapping each element to its source and speaker.
3. An access-controlled core profile across contexts, created as permissioned projections rather than a global plaintext dossier.
4. Cross-context reuse and disclosure grants. Not part of this release.
5. Authentication HTTP smoke checks, real microphone/transcription test and deferred security updates before external pilot expansion.

No new migration or dependency upgrade in this release; macOS Catalina compatible lockfile retained.
