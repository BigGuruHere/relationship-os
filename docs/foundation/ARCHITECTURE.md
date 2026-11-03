# Relish relationship foundation design

Date: 2026-11-03. Status: target design for staged implementation, not implemented schema or a deployment claim. Direction approved through the product discussion; the stage-2 [physical model](PHYSICAL_MODEL.md) now specifies concrete tables and service boundaries. Migration SQL and runtime implementation remain pending. Source baseline: development `77a8b2b58232b9413d57b86e853bf478bbee0492`.

## Purpose and scope

Relish helps people understand themselves, other people, relationships and the ways relationships affect one another. A relationship can have patterns, tensions, commitments, possibilities and conditions for flourishing that are not reducible to either participant's individual wants. Represent it as a subject of understanding without attributing consciousness to it or treating an AI interpretation as its authoritative voice.

Build the new domain inside the existing SvelteKit application initially. Preserve useful infrastructure and interfaces; permit replacement of structures whose boundaries conflict with this design. Keep legacy Brokerage operating on its current model. No new repository, microservice fleet, global graph platform, forced legacy migration or production reset is part of this design.

## Domain model and glossary

Names below describe conceptual responsibilities. Concrete F-202 names and constraints are specified in [PHYSICAL_MODEL.md](PHYSICAL_MODEL.md); neither document is an implemented Prisma schema.

| Concept | Meaning and invariant |
| --- | --- |
| Account | Authentication principal and account administration. Login does not prove a past relationship or grant access to another person's records. |
| Person reference | Reference to a human, without a global dossier. Private unverified records do not require a globally resolved identity. |
| Identity link | Evidence-backed, scoped assertion connecting a private reference, exchange or account. Records assurance, provenance, time and status; supports correction/unlinking. |
| Private person record | Owner's directory entry and private choices about someone. May exist without an account, classification or verified identity. |
| Relationship subject | Durable reference to a relationship involving two or more people. Can exist privately before mutual acknowledgement. Relationship identity is not a permission boundary or proof that participants agree. |
| Participation | A person's involvement in a relationship, with role, temporal relevance, source and acknowledgement status where applicable. Membership metadata is protected information. |
| Understanding subject | Person, self, relationship or group that a statement concerns. A statement can concern several subjects. Self resolves to a person in a particular perspective. |
| Perspective | Whose observation, experience or interpretation is represented. Separate from subject, speaker, recorder and custodian. |
| Custody | Administration/storage boundary for entrusted information. Independent of semantic contexts. Existing ContextSpace security remains authoritative until an explicit replacement is implemented. |
| Context association | Meaning or circumstance attached to information, interactions or relationship aspects. Multiple contexts can coexist; a label change never grants access. |
| Boundary or commitment | A sourced statement about limits, preferences or agreements, including who expressed or acknowledged it and its validity. A private expectation is not a joint agreement. |
| Source version | Immutable version of recorded evidence, subject to deletion/retention controls. Corrections create a successor rather than silently changing what prior interpretations referenced. |
| Evidence segment | Stable anchor into a source version, such as turn IDs, text spans or audio times. Preserves speaker and qualifications needed to interpret the excerpt. |
| Understanding statement | Supported assertion or inference with subject(s), perspective, authority, confidence, status and temporal relevance. |
| Derivation | Version-specific dependency between evidence/statements and a derived statement, summary or recommendation. |
| Exchange event | Receipt of a particular sharing action and its provenance. Does not imply continuing grants or a mutual connection. |
| Sharing grant | Current authority for a specified operation, resource selection, purpose and audience, with constraints and expiry/revocation. |
| Presentation | Public profile, restricted shared view, readable understanding or recommendation assembled from eligible information. |

## Relationship identity and perspectives

Mark, Betty and their relationship are three distinct understanding subjects. Mark's view of the relationship, Betty's view, a jointly acknowledged view and Dorian's hypothesis remain distinguishable. Joint acknowledgement applies to a specific statement/version, not all past or future relationship information. A participant can withdraw acknowledgement without rewriting history.

Start with custodian-scoped relationship references. Do not impose global uniqueness on a pair of people: the same people may share a family relationship and a project arrangement, and groups may change membership. Associations between independently held relationship references require evidence and explicit workflow; they never merge perspectives or grant access. Unverified participation must not notify another person or reveal the private relationship record.

Understanding subjects should not be implemented as unchecked polymorphic IDs. F-201 selects a typed FoundationSubject registry with discriminator CHECKs and composite custody foreign keys. Subject associations and derivations must enforce custody/authorised reference constraints as well as foreign-key existence. A relationship label, member list or source pointer can itself disclose sensitive information.

## Information flow

1. Capture an interaction using a server-resolved custodian and source identity.
2. Store a version and identify relevant evidence segments, retaining speaker attribution and qualifications.
3. Create statements about one or more subjects with an explicit perspective and derivation.
4. Evaluate authority for each proposed use, including AI processing.
5. Build a presentation from eligible information; disclose only through a separately authorised operation.
6. Reassess dependent outputs after correction, changed circumstances or withdrawal.

For example, “I enjoy mentoring, but can only help occasionally while my sister is receiving treatment” cannot become an unconditional offer. A participant-approved discovery statement might say “Open to occasional mentoring; confirm availability.” Receiving that statement does not grant access to the transcript or the sister's circumstances.

## Proposed implementation boundaries

Proposed home: `src/lib/server/foundation/`, with focused modules introduced only when their backlog item is implemented. Existing `core/` remains authoritative for legacy flows. Route code calls application services rather than writing new domain tables directly.

| Boundary | Responsibilities |
| --- | --- |
| Identity | Account association, claim proof, assurance, unlinking and replay protection |
| People and relationships | Private directory, subject references, participation and private associations |
| Evidence | Source versions, segment anchors, corrections and source retention |
| Understanding | Statements, perspectives, derivations, readable projections and reassessment |
| Policy | Actor/resource/action/purpose/audience decisions, grant status and fail-closed enforcement |
| Exchange and sharing | Receipts, restricted projections, grant lifecycle and account claim handoff |
| Legacy adapters | Explicit interfaces to existing recording, public profiles, credentials and legacy services |

Use one authoritative write path per cohort and capability. Avoid permanent dual writes between legacy Contacts and new private person records. Keep server-resolved custody and encryption for sensitive content and metadata; deterministic lookup indexes require a documented necessity. Profile public fields remain public until explicitly unpublished; restricted sharing needs a distinct projection and access check.

## Source-grounded reuse assessment

| Existing implementation | Retain or adapt | Structural gap |
| --- | --- | --- |
| `prisma/schema.prisma`: User, Person | Credential principal and identity-reference concepts | Evidence-backed links and reversible claiming |
| Contact, ContextSpace; `src/lib/server/core/myPeople.ts`, `contacts.ts` | Owner checks, capture behaviour, private directory UI | Contact includes commercial fields; custody and LU depend on Contact/space tuples |
| `src/lib/server/core/contactCapture.ts` | Consent, token, abuse checks, provenance receipt | No secure account claim or continuing reciprocal sharing |
| Profile; `src/routes/u/[slug]`, `src/routes/settings/profile` | Public presentation, QR/vCard and editor UI | Public visibility differs from recipient-specific grants |
| `src/lib/server/profileOnboarding.ts` | Temporary draft and return-visit convenience | Cookies are not identity proof or continuing permissions |
| Relating, GovernedUnderstandingScope | Private relationship history and subject-scope concepts | Persisted LU revisions/topics still require Contact; generic scope is not generic persistence |
| KnowledgeClaim, KnowledgeEvidence | Authority, perspective, status, confidence and evidence concepts | Reusable versioned segment identities and governed dependencies |
| `src/lib/server/datingTranscriptImport.ts`, `knowledgeSuggestionQuality.ts` | Speaker/turn excerpts and quote validation | These are partial fine-grained provenance, not a general permissioned information system |
| `src/lib/server/core/agentDataAccess.ts` | Existing agent access enforcement | Entity-level controls do not express per-information purpose/recipient permission |
| `src/lib/leads/link.ts`, auth routes | Keep legacy behaviour behind explicit legacy boundary | Login/register/Google and other identity entry paths can perform legacy claim side effects |
| `src/lib/recording/ContactNoteForm.svelte` | Recording/editing UX | Adapt save/retrieve boundary; do not duplicate recorder |

These are inspected source capabilities, not claims of live deployment or new tests. See [POLICY_AND_PROVENANCE.md](POLICY_AND_PROVENANCE.md) for target invariants and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for rollout.

## Required design scenarios

- An unregistered visitor exchanges details, then securely claims that exact exchange without accessing the sharer's notes.
- A person shares two profiles in separate directions without duplicate verified person entries; uncertain duplicates remain reviewable.
- Mark privately records a relationship observation; Betty cannot discover it through membership or identity linkage.
- Both contribute selected material; an AI relationship hypothesis is not represented as agreement.
- One source concerns Mark, Betty and their relationship without copying it into three independent truths.
- A relationship changes form or ends without automatically deleting either participant's private history.
- A correction/withdrawal affects summaries and pending introductions, while an independently supported statement can remain valid.
- Brokerage retains its records and workflows throughout new-user rollout.

## Scope limits

This design does not authorise database changes or claim that profile sync, secure claims, generic relationship understanding or cross-account discovery exists today. The first implementation supplies foundation primitives and a private meeting-to-note experience. Shared relationship analysis and cross-account discovery remain later gated capabilities.
