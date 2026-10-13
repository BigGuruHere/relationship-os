# Stage 8.15.1 - Pilot Core, identity and relationship architecture audit

Date: 2026-10-13
Status: **Architecture audit and decisions proposed; implementation intentionally unchanged.**
Source baseline: Relish Stage 8.14.6 complete source uploaded for this review.

## Objective

Prepare a coherent pilot product without breaking Relish Core's reuse across member, networking, dating, broker and independently deployed future apps. Clarify the responsibilities of Person, account, Contact, connecting, Relating, interaction evidence and relationship perspectives. Audit the existing profile/QR/contact-note paths before authorising implementation.

## Architectural decisions recommended for approval

1. **Core versus apps:** Core provides identity, custody, source/evidence, Living Understanding, relationships, permissions, introductions and governed value intelligence. Apps provide workflows and presentation. Core APIs/services should not assume a specific Svelte page, dating, broker or ElevenLabs client.
2. **Identity:** `Person` is the identity node; `User` is an authenticated account; `Contact` is the private representation of a Person within one owner's ContextSpace. Do not unify them or create globally shared personal facts.
3. **No automatic sharing on identity linkage:** Account claiming and contact-to-person linking must never confer access to another user's private notes. Identity resolution must be explicit and conservative. Existing `linkedUserId` is a compatibility bridge, not the canonical identity.
4. **Relationships:** `ContactRelationship` represents owner-scoped assertions/links between contacts; `Relating` is a private multi-participant context; `Touchpoint` is an event. None alone proves a mutual, verified relationship or permission to share. Reuse rather than create a parallel `Relationship` model prematurely.
5. **Perspective:** Distinguish (a) understanding of oneself, (b) a member's private understanding of another person, and (c) the member's understanding of their relationship. Record speaker, observer, subject, epistemic status and custody. Explore a common governed understanding engine, not three duplicate LU implementations.
6. **Source provenance:** Keep user observations as observations, not facts authenticated by the subject. AI and agent speech are context, not independent participant evidence. Preserve originals; corrections must be versioned or append-only where evidence is material.
7. **Capabilities versus contexts:** Roles/capabilities govern actions; ContextSpaces govern purpose and custody. Hiding navigation is not authorisation. Continue enforcing owner/context on Core operations.
8. **Sharing and matching:** Private knowledge, match eligibility, introduction eligibility, recipient-specific disclosure, context sharing and public presentation remain separate permissions. Inference-based outputs must not leak inaccessible information.

## Current code inventory (verified)

| Area | Code | Finding / disposition |
| --- | --- | --- |
| Identity | `prisma/schema.prisma`: `Person`, `User`, `Contact` | Person stores no global name/profile; User has optional unique personId; Contact has optional personId and owner/context custody. Preserve. |
| Auth roles | `User.role`, `UserRole {owner,member,guest}` | An existing, limited role field exists. Do not falsely treat 8.15 as greenfield role creation; audit its semantics before expanding to operator/admin/broker capabilities. |
| Core authorisation | `src/lib/server/core/accessPolicy.ts` and `relationshipRepository.ts` | Access context carries owner, context, actor and purpose; scoped lookups exist. Reuse as baseline and extend with capability checks. |
| Context routing | `src/lib/server/core/contextDomain.ts` | Route domains resolve business/general/dating and server-validate selected ContextSpace ownership. This is NOT a substitute for user privileges. |
| Contact notes | `src/routes/contacts/[id]/interactions/new/+page.server.ts`; `src/lib/server/core/interactions.ts` | Creates encrypted interactions, summary and best-effort private embeddings, linked to contact/person where available. Existing implementation should be retained. |
| Note editing | `src/routes/contacts/[id]/interactions/[iid]/edit/+page.server.ts` | Updates `rawTextEnc` in place. Evidence amendment/immutability needs explicit design, especially after structured knowledge or LU source links exist. |
| Notes to understanding | `src/lib/server/core/knowledge.ts`; LU services | Existing knowledge capture and LU mechanisms are distinct. Standard contact note save does not visibly trigger automatic LU candidate preparation. Need defined handoff with subject/observer semantics. |
| Relational links | `ContactRelationship`, `Relating`, `RelatingParticipant`, `Touchpoint`, `Introduction` in Prisma | Multiple non-equivalent constructs already exist; map semantics before adding any new table. |
| Profiles | `Profile`, `src/routes/settings/profile`, `src/routes/share` | Multiple user-owned profiles, share selection and QR generation already exist. Avoid rebuilding. Profile presently stores intentionally public fields; independent recipient permissions need separate design. |
| Public journey | `src/routes/u/[slug]`, `src/lib/connections.ts`, `src/routes/guest` | Public profile, invite/guest flow and an authenticated mutual-connection service exist. Audit public field exposure, consent and referral continuity through real journeys before declaring ready. |
| Review supervision | `src/routes/general/admin/reviews/+page.server.ts` | Checks logged-in ownership of General context but does not enforce an operator permission. Must enforce role/capability server-side prior to participant pilot. |
| Layout | `src/routes/+layout.server.ts`, `+layout.svelte` | Domain-dependent navigation exists. Owner-only filters for reconnect counters cross ContextSpaces inside a user's account; inspect other legacy routes for similar userId-only filtering. |

## Specific code-level findings to triage before pilot

### P0 - Privilege isolation

- `general/admin/reviews` uses `requireGeneral()` to require the correct domain/context but not an operator/admin capability. Normal members must not see or invoke review actions.
- Establish a named Core capability policy with enforced route, action and service checks. Decide whether `UserRole.owner` is a historical owner-of-account value rather than operator privilege. Migration requirements must follow the audit; do not relabel roles without examining callers.

### P1 - Context scoping and note integrity

- In the legacy contact note create/load and edit routes, `prisma.contact` / `prisma.interaction` queries commonly filter by `userId` and ID without explicit `contextSpaceId`. This deserves cross-context tests under the current request-custody implementation before any assertion of exploitability.
- `src/routes/+layout.server.ts` reconnect count reads all contacts belonging to an owner despite its resolved ContextSpace. Verify intended behaviour and scope or label as aggregate.
- The edit path replaces encrypted source text in-place. If downstream knowledge or LU points at an interaction, its source meaning could change retroactively. Introduce a correction/revision design before using contact notes as authoritative longitudinal evidence.
- The ingestion service catches embedding errors and returns a saved Interaction. That is correct for optional retrieval, but UI/operational diagnostics should not imply guaranteed semantic indexing.

### P1 - Person, contact and account linking

- Validate migration, duplicates, ambiguous matches, provisional person, contact linking, and account claim scenarios. A member linking a previously unregistered contact must never gain access to another owner's records.
- Profile/QR share creates an identity/referral entry point. Audit idempotency, explicit member confirmation and behaviour for guest and preexisting contact identities.

### P2 - Product seams and clarity

- Define a dedicated Core `recordObservation`/interaction pathway that supports observer, subject, relationship context, provenance, and source type without tying it to a specific app route.
- Connect a new contact note to optional *draft* understanding review, distinguish self-understanding from another person's observed qualities and from relationship perspective, and keep approval separate from source saving.
- Defer auto cross-person matching, relationship shared understanding, recipient-specific disclosure and full person-level cross-context LU aggregation until governed permission tests exist.
- Review broad layout/menu exposure and legacy broker-facing routes before opening member pilot.

## Proposed architectural contracts, not database migrations

```
Person (identity only)
  | optional linkage
User (authentication and account ownership)             Contact (owner + ContextSpace + private representation)
  | capability grants                                  | observer-held observations
  +-- App access ---------------------------------------+-- Interaction / immutable evidence
         |                                                 | provenance, epistemic status
         +-- Networking, Dating, Business, Member          +-- Knowledge / LU revision proposals

Relating (one owner's scoped multi-participant history)
  +-- RelatingParticipant (membership, not reciprocal consent)
  +-- Touchpoint (event)
  +-- Introduction (explicit social transaction)
ContactRelationship (one owner's directional or typed assertion)
```

Relationship-perspective conceptual fields: `ownerUserId`, `contextSpaceId`, `observerPersonId`, `subjectPersonIds`, `relatingId?`, `sourceInteractionId?`, `perspectiveType`, `confidence`, `asOf`, `visibilityPolicy`, `revisionId`. **This is a domain proposal, not a request to add these columns now.**

## Suggested implementation sequence after sign-off

1. **8.15.2:** Capability policy/role mapping, server enforcement, denied-access tests for every privileged route/action, no privilege by ContextSpace alone.
2. **8.15.3:** Contact note custody audit and source correction/versioning; relationship-perspective contract and read-only processing prototype; no unsupported assertions of fact.
3. **8.15.4:** Capability-driven member shell with plain-language navigation and privileged tools hidden AND inaccessible.
4. **8.15.5:** End-to-end audit of existing QR, multiple profiles, guest, invite, linking and account-claim paths; reuse the working implementation.
5. **8.15.6:** Inbox operator permission and scalable queue, polish and context-scoped counters.
6. **8.15.7:** Pilot acceptance tests covering unauthenticated, guest, member, operator and broker; cross-owner/context, identity claim, note privacy, QR and regression flows.

## Acceptance criteria for Stage 8.15.1

- [x] Existing identity, notes, Core, relationship and profile concepts inventoried.
- [x] Core versus app boundary stated; custody and capability distinction documented.
- [x] No premature replacement of Person/User/Contact, Relating or contact notes.
- [x] Findings ordered by priority; downstream stage scope proposed.
- [x] Existing 8.14.6 source check run (three static tests passed).
- [ ] Decisions signed off by product owner.
- [ ] DB integration tests, end-to-end browser tests and `npm run check` (not run; no installed dependencies and no configured DB in supplied source).

No Prisma schema, migration, application runtime or test source changed in 8.15.1. This stage is a documented architecture audit; the implementation stages begin with 8.15.2.
