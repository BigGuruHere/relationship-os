# Relish: Decision Log

Status: living record of product and architecture choices. Updated 2026-11-03. Links point to detailed earlier rationale where available.

These entries preserve **why**, not every implementation detail. If a decision is reconsidered, add a dated supersession note instead of deleting the earlier record. An implemented feature can lag an agreed direction.

| ID | Decision | Status and rationale |
| --- | --- | --- |
| D-001 | Relish is a person-first Relationship OS; Dorian enriches human-to-human relationships instead of substituting for them. | Accepted direction. Product meaning and quality of relationships govern architecture. |
| D-002 | Keep one shared Core with specialist apps and agent channels layered on top. | Accepted direction. Prevent duplicate domain authority in Brokerage, Dating, voice and future experiences. See [Stage 8 roadmap](stage8/STAGE8_9_MULTI_APP_RELATIONSHIP_INTELLIGENCE_ROADMAP.md). |
| D-003 | People are not exclusively assigned to Business/Friendship/Dating; information and interactions have contexts and custody. | Accepted direction, not yet fully reflected in the UI. The private My People home is neutral storage. |
| D-004 | Contact, Person, User and mutual Connection are separate concepts. | Accepted. QR capture creates a private Contact only; neither user account nor reciprocal connection is inferred. |
| D-005 | Provenance differs from relationship classification and disclosure permission. | Accepted. Source profile/event is recorded independently of any eventual association. |
| D-006 | No silent sharing or merging of private perspectives between participants, even if they connect or have linked identities. | Accepted hard trust constraint. Dorian's permitted reasoning scope and disclosure rights are separate. |
| D-007 | Reuse existing Contact/Interaction services and existing QR/profile interfaces; do not create parallel Contact systems. | Accepted delivery rule. Now part of [`AGENTS.md`](../AGENTS.md). |
| D-008 | Keep legacy Brokerage Contacts and workflows intact while validating new My People flows; do not force immediate migration. | Accepted incremental strategy. A unified directory is future work subject to explicit custody design. |
| D-009 | First pilot identity continuity by phone can be provisional; stronger checks are needed for sensitive access later. | Accepted pilot trade-off, not permission for unrestricted cross-context retrieval or disclosure. |
| D-010 | Recordings are switched off in telephone providers for the current pilot; consent and personal-information policy remain mandatory. | Operator-confirmed configuration, not automatically verified by source code. See legal documents for published terms; do not assume voice notes use identical retention. |
| D-011 | Dorian's source-backed understanding may update automatically for the pilot, while operator inspection/audit and privacy controls remain important. | Accepted direction as the pilot evolved; review mechanisms must not be lost. |
| D-012 | Keep current user experience small: existing QR capture -> private Contact -> owner voice note; hide Dorian invitation temporarily rather than deleting it. | QR capability and Dorian visibility UI change merged into Development, with live deployment and browser validation still to be confirmed. |
| D-013 | Codex normally branches from latest `development`, then commits and pushes on its own branch without automatic merges or production deployment. | Accepted standing Git practice. See `AGENTS.md` for precise constraints. |
| D-014 | Living documents replace large bootstrap prompts as the current project reference; keep old stage files as history, not competing active specifications. | Working documentation decision proposed on 2026-11-02; subject to review before merging documentation branch. |

| D-015 | For the present owner-only pilot, classify legacy Business Contacts as Personal using existing context-local tags and display selected Contacts in My People without moving or duplicating them. | Superseded by D-016 on 2026-11-03. This temporary solution reached Development but is being reversed; it never moved Contacts or changed custody. |
| D-016 | Do not maintain the temporary Personal-tag bridge from legacy Brokerage to My People. For the current small pilot, add desired personal Contacts afresh while retaining old Brokerage records. | Accepted 2026-11-03. Restore My People private-only listing, remove the owner organiser feature, and leave historical Brokerage data and tags untouched. The long-term cross-context relationship architecture remains open. |

| D-017 | A Relish User may create multiple independently labelled public profiles, including more than one Business, Friendship or Dating profile. Type is a secondary classification, and origin profile remains provenance rather than a permanent relationship category. | Accepted for pilot 2026-11-03. Reuses `Profile.label`, slug, kind and existing capture provenance. Context-specific legacy workflows remain compatible. Implementation on `feature/multi-labelled-profiles-20261103` pending tests and merge. |

| D-018 | Use three visitor-facing screens: public profile/Save contact, optional private detail sharing, then optional creation of the visitor's own Relish profile. | Accepted 2026-11-03; merged into `development` via PR #10 (`841e59c`) on 2026-11-03. Deployment unverified. Reuses existing public profiles, vCard, capture, auth and editor. Replaces the capture-first visitor presentation in D-012, while Dorian invitations remain hidden. Saving a contact and sharing details require no account. Signup drafts are temporary and unverified; no identity linking or private-data sharing is implied. New signup profiles stay unpublished until owner review. |

## Foundation direction accepted 2026-11-03

Detailed rationale, alternatives, consequences and supersession are in [foundation decisions](foundation/DECISIONS.md). These are accepted design choices; runtime implementation is pending.

| ID | Decision | Status and rationale |
| --- | --- | --- |
| D-019 | Separate new Relish domain semantics from legacy Brokerage; selectively reuse infrastructure and interfaces. | Supersedes the shared-persistence requirement in D-002, blanket replacement-model restriction in D-007 and consolidation expectation in D-008. Legacy preservation and reuse-before-build remain mandatory. |
| D-020 | Contextual meaning, custody and authorisation are independent. | Refines D-003/D-005. Existing ContextSpace enforcement remains until deliberately replaced. |
| D-021 | Relationships are durable understanding subjects; perspectives and acknowledgement remain distinct. | Refines D-004/D-006. No global shared narrative or access follows from participation. |
| D-022 | Reusable understanding retains evidence, versioned derivation and operation-specific permissions. | Refines D-005/D-006/D-011. Public profiles differ from restricted recipient sharing. |
| D-023 | Build the foundation, then onboard through gated useful releases and update documentation in every material change. | Extends D-013/D-014; replaces the earlier roadmap priority order. No implicit production approval. |

D-024 (2026-11-04) fixes the first physical schema design: explicit foundation vault/enrolment, typed subjects, separate perspectives and versioned evidence, while retaining shared User and legacy Person. See [the decision](foundation/DECISIONS.md) and [physical specification](foundation/PHYSICAL_MODEL.md). Status: implementation design on F-201 branch, not implemented schema.

Earlier entries above preserve the historical decisions; D-019 controls their explicitly superseded portions.

## Deferred questions

- Whether future user evidence justifies optional legacy Brokerage directory integration; it is not a foundation requirement.
- When and how to link a Contact to verified Person/User identity, including consent and assurance level.
- How Dorian should select contextual procedures/instructions while preserving one relationship memory and permissioned disclosure.
- Which relationship opportunities should be surfaced first, and what approval/withdrawal flow makes introductions safe and useful.
- When to retire legacy ContextSpace-first UI and duplicated historical compatibility routes after functionality is accounted for.

## How to add a decision

Record the date, choice, reason, what it supersedes, affected code/interfaces, security/data implications, and whether it is merely approved or also implemented and validated. For a major schema or custody choice, use an additional focused architecture-decision document and link it here.

## 2026-11-05: Foundation preparation isolates automatic legacy claims

F-203 implements the accepted separation of account identity from private-domain enrollment. PREPARED is already an internal foundation cohort for automatic identity-claim side effects: it suppresses legacy lead/reciprocal-contact claims even though its public People/capture routing remains legacy until activation. This avoids acquiring legacy identity links while testing the new domain. No signup automatically prepares or activates an account. See [F-203](foundation/F203_PROVISIONING.md) for implementation status and transaction/rollback obligations.

## 2026-11-05: Foundation access is an expiring server capability

F-204 implements the accepted owner-private boundary with runtime-issued handles and transaction-time state/epoch checks. Relationship membership, attributed perspectives, semantic contexts and serialized job data cannot grant access. All new-domain services use the shared guarded Prisma client; legacy custody remains separate. Prepared rehearsal has no route caller. Evidence/AI/disclosure capabilities stay denied until implemented and tested in their own stages. See [F-204](foundation/F204_ACCESS.md).

## D-025 Reciprocal saving after exchange

Accepted product direction on 2026-11-07. After Mark and Betty exchange details, each should receive the shared details in their own My People. Signup through that exchange completes the visitor's automatic saving. A future automatic-add preference defaults to enabled and applies to future additions. Account association requires verified claim proof. Ongoing updates use separate permission. Private notes retain owner custody. D-004 and D-018 remain applicable to identity and private access, with reciprocal saving now explicitly designed in [S-401](foundation/S401_EXCHANGE_DESIGN.md).

## D-026 Phone or email assurance for an exchange

Accepted 2026-11-07. Support either phone or email verification using a channel actually supplied in the exchange. Implement SMS first through the existing Telnyx transport. Add email to the same challenge service afterward. A successful claim records channel, method and verification time. Caller-ID recognition remains provisional and sensitive actions may require fresh assurance. This revises S-401's initial email-first proposal.
