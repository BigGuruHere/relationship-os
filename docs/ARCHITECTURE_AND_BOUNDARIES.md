# Relish: Architecture and Trust Boundaries

Status: living technical overview. Checked against the RelationshipOS `development` repository on 2026-11-02. Detailed source code, Prisma schema, tests and deploy configurations remain authoritative.

## Repositories and system responsibilities

| Repository | Responsibility |
| --- | --- |
| `BigGuruHere/relationship-os` | SvelteKit Relish application and domain Core: users, profiles, private Contacts, Interactions, ContextSpaces, permissioned knowledge/understanding, participation and brokerage workflows |
| `BigGuruHere/relish-agent-management` | Manage provider-facing agents, configuration, versions and environment assignments |
| `BigGuruHere/relish-proxy-server` | Route telephone/provider requests to the appropriate Relish environment and session based on managed routing |

The current implementation shares Core primitives across application experiences. The accepted target now separates the new Relish domain from legacy Brokerage persistence where semantics conflict, while retaining useful infrastructure. This is a planned transition, not an implemented split.

## Accepted target and transition

The [foundation architecture](foundation/ARCHITECTURE.md), [policy contract](foundation/POLICY_AND_PROVENANCE.md) and [decisions D-019 through D-023](foundation/DECISIONS.md) define the new direction. People, relationships and groups are understanding subjects; perspective is independent. Contextual meaning, custody and permissions are separate. New persistence may replace Contact-bound understanding through additive migrations and one authoritative writer per enrolled cohort/capability.

Keep Brokerage on its current model. Preserve its data and current security boundaries; do not reinterpret ContextSpace labels as grants. Reuse credential/session primitives but isolate legacy Lead-linking side effects. Restricted profile sharing must be distinct from public publication. None of these new capabilities is implemented by the documentation package.

See the [stage-2/3 backlog and migration gates](foundation/IMPLEMENTATION_PLAN.md). F-201 now specifies the [physical schema and transaction contracts](foundation/PHYSICAL_MODEL.md), with [source dependency and data inventory](foundation/DEPENDENCY_INVENTORY.md). F-202 adds the custody root and typed subjects to Prisma and an additive migration on its feature branch; [invariants and rehearsal](foundation/F202_INVARIANTS.md) document coverage. Target migration, auth isolation, access services and user-facing activation remain pending. The sections below describe current implementation, not the target schema.

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

## Public profile identity and classification

The Profile model belongs to a User, not directly to a ContextSpace. Each profile has its own `id`, unique `slug`, owner-facing `label`, public `displayName`, publication state and `kind`. Multiple profiles of the same kind are supported by the data model and are exposed by the feature-branch My Profiles manager. The legacy contextual editor still selects an existing profile by kind; its default/oldest-first ordering is intended to keep that contextual profile stable when more profiles are created.

Profile `kind` remains a compatibility input for the existing Business/Friendship/Dating workflows. The private Contact capture adapter stores the exact `sourceProfileId` and an Interaction provenance receipt with profile ID/kind/entry hint. A profile choice does not give Contacts permanent context membership, cross-context visibility or new disclosure rights.

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

## Optional profile creation after contact exchange

Merged into `development` on 2026-11-03 via PR #10 (`841e59c`), with deployment unverified. The existing public profile is screen one; the existing share-details route renders screens two and three. Its explicit `create-profile` POST stores only a 30-minute encrypted HttpOnly draft using the shared encryption helper and a dedicated authenticated-data purpose. This is independent of capture writes. No new endpoint, database model or migration is introduced.

Auth accepts the existing strict Network invite paths plus exactly `/settings/profile?onboarding=1`; Google retains the allowlisted return through its existing OAuth state/cookie flow. The draft proves neither email/phone ownership nor a relationship. Password signup and newly provisioned Google profiles in this flow start unpublished; existing profiles remain unchanged. The owner-scoped editor shows optional prefills and requires a save/publication choice before making entered contact fields public. Drafts expire and are cleared after successful save. Existing credential verification and Network consent boundaries remain in place; this does not introduce a new email-verification mechanism.

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

- Legacy Brokerage and participant context UI coexist with My People and QR capture. Reuse suitable services; a replacement new-domain model is permitted only through the documented foundation transition, without competing active writers. An experimental owner-only Personal-tagged Brokerage directory bridge was superseded on 2026-11-03 and is being removed. My People returns to its private-only directory pending a deliberate unified-directory design.
- A coherent new Relish People directory and relationship associations are directional goals. Brokerage aggregation is not required; no custody barrier or legacy record may be migrated automatically.
- User, Contact, Person, Connection and profile concepts should be reconciled explicitly and gradually.
- Some transcription job state is process-local in the present pilot; assess reliability before relying on multi-instance delivery.
- Agent routing and context-specific session handling are deliberate infrastructure boundaries, not reasons to duplicate person data in each agent.
- Old documents may describe prior architecture that was later superseded. Use `docs/START_HERE.md` for navigation, then inspect actual current source and tests.

## F-203 provisioning boundary (merged, DEV operator-confirmed)

See [account provisioning isolation](foundation/F203_PROVISIONING.md) for transaction locks, enrollment-state behavior and acceptance evidence. All auth paths reuse `createSession`; no automatic enrollment is enabled. Future enrollment transitions must use the same account advisory lock. PREPARED suppresses automatic legacy claims while retaining legacy public routing. ACTIVE/SUSPENDED private routes fail closed until the foundation adapters are available. F-204 must add repository authorization and transactional state/epoch checks before activation.

## F-204 owner access boundary (merged, 2026-11-05)

Read [F-204 access and usage](foundation/F204_ACCESS.md) before adding a foundation caller. Resolve authority from authenticated server locals and use repository projections. Never accept owner/vault/purpose from request payloads as authority. Private operations recheck enrollment/epoch and vault lifecycle under account/root locks. Prepared access is internal-only; serialized access handles, agent identities, memberships and context labels grant nothing. Evidence/statement/job adapters remain gated pending their own policy tests. No route activation is included.

## Private evidence and understanding

F-205 introduces purpose-specific owner operations for recording notes, inspecting excerpts, recording statements and reading current understanding. Preserve exact UTF-16 anchors across revisions, explicit owner admission and use-time checks on each support. Follow the [F-205 service contract](foundation/F205_EVIDENCE.md).
