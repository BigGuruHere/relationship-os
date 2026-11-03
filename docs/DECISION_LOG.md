# Relish: Decision Log

Status: living record of product and architecture choices. Updated 2026-11-02. Links point to detailed earlier rationale where available.

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

## Deferred questions

- How to present a genuinely unified owner People list across current private and legacy business custody without accidental sharing or migration.
- When and how to link a Contact to verified Person/User identity, including consent and assurance level.
- How Dorian should select contextual procedures/instructions while preserving one relationship memory and permissioned disclosure.
- Which relationship opportunities should be surfaced first, and what approval/withdrawal flow makes introductions safe and useful.
- When to retire legacy ContextSpace-first UI and duplicated historical compatibility routes after functionality is accounted for.

## How to add a decision

Record the date, choice, reason, what it supersedes, affected code/interfaces, security/data implications, and whether it is merely approved or also implemented and validated. For a major schema or custody choice, use an additional focused architecture-decision document and link it here.
