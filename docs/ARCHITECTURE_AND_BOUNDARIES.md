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

Auth accepts the existing strict Network invite paths plus exactly `/settings/profile?onboarding=1`; Google retains the allowlisted return through its existing OAuth state/cookie flow. P-304 binds the encrypted draft to the newly authenticated account and exact initial profile after session issuance. Existing accounts without their own bound draft return to My Profiles. Drafts do not establish credential or relationship authority, and the onboarding return does not invoke legacy lead claims. Password signup and newly provisioned Google profiles in this flow start unpublished; existing profiles remain unchanged. The owner-scoped editor shows optional prefills and requires a save/publication choice before making entered contact fields public. Drafts expire on the original timer and are cleared after a matching successful save or logout. Share and QR/vCard preview resolve the same owner-selected profile and use live QR rendering. See [P-304](foundation/P304_PROFILE_CONTINUITY.md). Existing credential verification and Network consent boundaries remain in place; this does not introduce a new email-verification mechanism.

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

## Capture during a storage handoff

Resolve the profile owner and check its enrollment under the account lock on the same transaction connection used for private-home creation, Contact and receipt. Take the profile lock second and recheck publication before persisting. Before enabling other private writers for a cohort, rehearse the complete handoff and recovery. See [F-206](foundation/F206_REHEARSAL.md).

## P-301 People route adaptation

[Private directory contract](foundation/P301_PEOPLE.md) documents the first user-facing foundation adapter. Server enrollment selects the existing People page storage path. ACTIVE directory routes skip legacy custody resolution and call F-204-authorized subject services. Manual name/email/phone details reuse encrypted `FoundationSubject.detailsEnc`. Search decrypts bounded owner-only pages with explicit continuation. Legacy manual Contact creation now retains its account lock through commit. Notes/capture require their separate P-303/P-302 adapters, and no cohort activation ships here.

## P-302 public intake boundary

[Public exchange intake](foundation/P302_EXCHANGE.md) adapts the existing sharing action for ACTIVE destination owners. Policy resolves the published profile and verifies the browser-bound token without impersonating the owner. The guarded PUBLIC_CAPTURE transaction permits new private person/evidence records, opaque receipt checks and bounded profile counts, with lifecycle/publication locks and stored-only admission. Legacy/PREPARED captures retain their original model. No identity link or continuing-sharing permission follows from a submission.

## P-303 private note boundary

[Private notes](foundation/P303_NOTES.md) reuse existing People and recording surfaces. READ_NOTES opens owner-private current note text without widening segment-only readers. PROCESS_DRAFT grants no stored-data access. Provider calls recheck lifecycle and epoch before/after work; transcript jobs bind user/domain/vault/epoch. Storage is encrypted and STORED_ONLY. Audio transport remains process-local with one-hour expiry and explicit recovery limits. No activation or migration ships in this stage.

## P-305 private vault operations

The offline support service uses the same account/vault locks as foundation writers. Its review, control and erasure scopes are separated from browser authority. Suspension advances the epoch; transactional erasure removes the scoped graph and retains an empty locked vault and suspended enrollment. Archived subjects retain their content for review. The shared account and legacy/provider data require separately scoped closure actions. See [the support and restore runbook](foundation/P305_PRIVACY_OPERATIONS.md).

## P-306 internal DEV account

The existing owner account page can create one fresh foundation test login when the DEV origin and explicit database binding match. The account and its ACTIVE private roots commit together. No existing account changes storage, and the test profile starts unpublished. See [P-306 DEV setup](foundation/P306_DEV_TEST_ACCOUNT.md).

## Planned exchange settlement

[S-401](foundation/S401_EXCHANGE_DESIGN.md) defines a narrowly authorized transaction across two private vaults for verified exchange settlement. Reciprocal entries contain the shared snapshots. Account associations and future directional update permissions remain separate authorities. S-402a persistence is merged; [S-402b service](foundation/S402_EXCHANGE_SERVICE.md) is on feature/s402b-sms-claims. Narrow internal exchange scopes permit cross-vault settlement and metadata-only dependency lookup while ordinary readers remain owner-scoped. Pilot dispatch and privacy share an exchange advisory lock. Recipient evidence is encrypted in recipient custody. S-403/S-404 add browser and recovery integration; ongoing disclosure remains separate.

S-401 now specifies channel-aware assurance bound to the exact exchange and authenticated account, with SMS delivery first through the direct Telnyx sender. Record method and verification time for later Dorian use. Email delivery is a follow-on transport.

S-403 adds a fixed exchange auth return and encrypted browser continuation. New-account DEV admission is atomic with signup and requires a separate explicit activation flag, exact DEV binding and a bounded credential-email allowlist. It does not enroll existing accounts or establish verified identity. The browser adapter calls S-402 services; offline privacy authority remains unavailable to routes. See [S-403 boundaries and activation](foundation/S403_EXCHANGE_BROWSER.md).

## Accepted account assurance correction, 2026-11-07

[S-405](foundation/S405_ACCOUNT_CHANNELS_AND_EXCHANGE.md) separates account-owned channel assurance from vault-owned account associations and exchange receipts. Authenticated owned-profile confirmation needs no channel challenge. A guest claim needs its exact continuation plus usable proof for a channel submitted there. Neither authority grants private-note access, a mutual Connection, ongoing updates or account merging. Account registry/verification/dispatch persistence is planned, not implemented by S-405a. Existing SMS, crypto, session checks, lifecycle locks and profile UI are reused. No existing email/profile/OAuth data is silently backfilled as verified. Account-channel deletion and vault erasure are distinct operations; legacy Brokerage remains unchanged.
