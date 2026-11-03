# Relish: Architecture and Trust Boundaries

Status: living technical overview. Checked against the RelationshipOS `development` repository on 2026-11-02. Detailed source code, Prisma schema, tests and deploy configurations remain authoritative.

## Repositories and system responsibilities

| Repository | Responsibility |
| --- | --- |
| `BigGuruHere/relationship-os` | SvelteKit Relish application and domain Core: users, profiles, private Contacts, Interactions, ContextSpaces, permissioned knowledge/understanding, participation and brokerage workflows |
| `BigGuruHere/relish-agent-management` | Manage provider-facing agents, configuration, versions and environment assignments |
| `BigGuruHere/relish-proxy-server` | Route telephone/provider requests to the appropriate Relish environment and session based on managed routing |

Relish is fundamentally a shared Core with application experiences, not three independent copies of relationships or knowledge.

## Stack and environments

- Main app: SvelteKit, TypeScript, Node 22, Prisma 6, PostgreSQL/Neon with pgvector, OpenAI integrations; Railway DEV and PROD.
- Voice/telephone pilot: ElevenLabs and Telnyx, with provider/session routing via proxy. Agent Management is a separate managed surface.
- Local/DEV/PROD have distinct database and deployment boundaries. Never assume a Git branch or successful commit proves a particular Railway service is deployed.
- Application code enforces owner/custody restrictions, encrypted PII handling and server-resolved authority. Existing database integrity checks are part of the security boundary.

Do not copy credentials, export private data or reconfigure live services as a side effect of documentation or routine UI work.

## Conceptual model

- **User** - an authenticated Relish account.
- **Person** - canonical human identity reference where supported. It is not a global sharable dossier.
- **Contact** - the way an owner records and understands a person within entrusted custody. It can remain unlinked and unverified.
- **ContextSpace** - the storage, authority and access boundary for information and interactions; not an exclusive taxonomy of humans.
- **Interaction** - an event, note, conversation or structured receipt with a source, owner, custody and provenance.
- **Living Understanding** - evolving, source-backed interpretations used to help a person and Dorian; it must not bypass operational permissions.
- **Connection / Relating / Introduction / Outcome** - different concepts. Shared presence, an introduction or a candidate match does not assert mutual commitment, connection or disclosure permission.

The initial `private` WORKSPACE for My People is neutral storage. Existing Brokerage ContextSpaces and Contacts remain intact, even though current My People does not display the older Brokerage Contacts in one unified list.

## Current reusable flows

- `/people`, `/people/new`, `/people/[id]`: owner-private new Contacts, retrieval and note history.
- `src/lib/server/core/contacts.ts` and `myPeople.ts`: shared Contact operations and neutral private-home authorization.
- `src/lib/recording/ContactNoteForm.svelte`: reused voice-note recording/transcription/edit/save interface.
- `/u/[slug]`: existing published profile and QR destination; `/u/[slug]/share-details`: opt-in owner-private Contact capture; existing event page can link to the same capture experience.
- `src/lib/server/core/contactCapture.ts`: token, permission, provenance and abuse-protected intake without automatic identity linking.
- `/broker` and existing business routes: retained specialist Brokerage workflows using shared records.
- `/space/[context]`: legacy participant context-specific surfaces. Do not delete them just because a neutral Home screen is introduced.
- Consent-controlled Dorian voice/session routes and operator review/inspection exist, but their live configuration must be confirmed separately.

Use code and tests to confirm exact paths or semantics before editing. This is a map, not an exhaustive inventory.

## Security invariants

- Check authenticated owner and actual ContextSpace custody on every relevant route, job, read and write. Resolve identifiers on the server; reject forged owner/context input.
- Separate source, subject, custodian, certainty and sharing authority. A new identity link must not grant access to another person's historic private notes.
- Do not silently merge, deduplicate or promote Contacts into Relish Users or mutual Connections using a name, email or phone alone.
- Visitors must explicitly choose to submit details. QR capture consent is not Dorian call consent, marketing consent, relationship recognition or blanket sharing permission.
- Dorian cross-perspective reasoning and disclosure require separate authorisation. Preserve human approval/participation in introductions and sharing.
- The telephone pilot uses provisional phone-number continuity; stronger identity verification is a future requirement for sensitive access and disclosure.
- Provider telephone recording has been intentionally disabled for the pilot according to the operator's confirmed configuration; distinguish those calls from user-initiated voice notes and verify actual environment behavior before making legal claims.
- Keep encrypted content, API keys, audio and transcripts out of logs.

## Known architectural seams / future consolidation

- Legacy Brokerage and participant context UI coexist with My People and QR capture. Reuse shared services rather than generating a third Contact system. An experimental owner-only Personal-tagged Brokerage directory bridge was superseded on 2026-11-03 and is being removed. My People returns to its private-only directory pending a deliberate unified-directory design.
- A unified People directory and cross-context associations are directional goals, **not** permission to lift custody barriers or migrate  existing records automatically.
- User, Contact, Person, Connection and profile concepts should be reconciled explicitly and gradually.
- Some transcription job state is process-local in the present pilot; assess reliability before relying on multi-instance delivery.
- Agent routing and context-specific session handling are deliberate infrastructure boundaries, not reasons to duplicate person data in each agent.
- Old documents may describe prior architecture that was later superseded. Use `docs/START_HERE.md` for navigation, then inspect actual current source and tests.
