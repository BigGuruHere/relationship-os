# Relationship foundation architecture decisions

Date: 2026-11-03. Status: accepted product direction with proposed implementation boundaries; runtime implementation pending. These records explain the new direction and preserve earlier decision history in [the decision log](../DECISION_LOG.md).

## D-019: Separate the new Relish domain from legacy Brokerage assumptions

Context: Contact and surrounding persistence carry commercial workflow and custody assumptions. There are no reported real new-product users, but existing legacy records remain valuable. The owner explicitly permits Brokerage to remain on its present model and potentially retire later.

Decision: build the revised relationship domain within the existing application, selectively reusing infrastructure and UI. Preserve Brokerage data and behaviour; no forced consolidation. Replace persistence where its semantics are incompatible, using an explicit transition path and one authoritative writer per capability/cohort.

Supersedes: D-002's requirement that Brokerage and new Relish share the same domain persistence, D-007's blanket prohibition on a distinct replacement model, and D-008's expectation of eventual unified Brokerage listing. Reuse-before-build, minimal justified change and preservation of legacy data remain mandatory.

Alternatives rejected: preserving all legacy tables as permanent new-domain authority would retain coupling; wholesale application rewrite discards useful capabilities; new microservices add operational cost without a present requirement.

Consequences: explicit adapters, auth-side-effect isolation and migration/cohort controls are required. No automatic data movement or additional permissions follow. Affects Prisma, core services, auth hooks and future new-domain services. No schema change in this documentation PR.

## D-020: Separate meaning, custody and authorisation

Context: the original ContextSpace idea established relationship boundaries; current ContextSpace also enforces storage custody. Information can concern multiple relationship aspects.

Decision: semantic context associations, custody and permissions are independent. Context labels can inform an explicit policy decision but are never grants. Preserve existing custody enforcement until a tested replacement is activated.

Alternatives rejected: turning ContextSpace domain labels into access rights; storing a person once per relationship category. Both conflate meaning and authority.

Consequences: new schema/services need independent associations and authorisation checks. Relabelling does not move evidence or change access. Refines D-003 and D-005; does not weaken their trust constraints.

## D-021: Relationships are understanding subjects; perspective remains independent

Context: Mark, Betty and their relationship have distinguishable experience and needs. A relationship's patterns or direction cannot always be reduced to individual preferences.

Decision: support durable person, relationship and group subjects. Represent perspective separately, including private participant observations, explicitly acknowledged joint statements and tentative AI interpretations. Relationship references may begin privately and involve multiple people. Do not require a globally unique pair or a single shared narrative.

Alternatives rejected: all understanding attached to one Contact; a universal shared relationship dossier; treating exchanges as the relationship itself.

Consequences: subject-scoped persistence must replace Contact-only LU assumptions where used. Membership and identity links confer no access. Joint acknowledgement is version-specific. Relationship support can include change, distance or ending; preservation is not an imposed goal. Refines D-004 and D-006. Shared relationship intelligence is later work, not part of the first pilot.

## D-022: Evidence, derivation and permission accompany reusable understanding

Context: source-level receipts and some speaker/turn excerpts already exist, but not a unified governed dependency model.

Decision: distinguish immutable source versions, segments, statements, derivations and presentations. Authorisation to process, discover and disclose is separate. Preserve qualifications, speaker/perspective, temporal relevance and uncertainty. Support correction and permission withdrawal as different events.

Alternatives rejected: using a whole LU document as the only trust unit; treating paraphrase as unrestricted; granting AI blanket access and filtering only its final text.

Consequences: versioned dependencies and current-policy checks are required when derivatives are introduced. Cross-account discovery begins with approved representations; private evidence is not automatically searchable. Public profiles and restricted recipient projections have different access semantics. Refines D-005/D-006/D-011 and adds requirements without asserting they are implemented.

## D-023: Deliver through gated user releases with documentation in each change

Decision: establish the base architecture, then onboard an invited cohort through the existing simple exchange/directory/note experience. Add continuing sharing, private understanding, relationship understanding and cross-account discovery in dependency order. Maintain the stage register and source-linked living documents with every material change.

Reason: validate actual user value while avoiding irreversible privacy and identity assumptions. A complete future intelligence platform is not required before the first useful release.

Consequences: every stage has acceptance evidence, migration/rollback scope, operational ownership and explicit implementation/deployment status. Architectural approval is not authorisation for production changes. Extends D-013/D-014 and supersedes the old roadmap priority order, not existing security requirements.

## D-024: Explicit private custody and typed subjects for the first physical schema

Date: 2026-11-04. Status: F-201 implementation design, pending merge; not implemented schema.

Decision: retain User and legacy Person unchanged, introduce FoundationEnrollment and a private FoundationVault, and represent person/relationship/group records in a typed FoundationSubject registry. Use composite custody/type foreign keys, versioned source/statement evidence and independent perspectives. Do not attach new understanding to Contact or make global identity resolution a prerequisite. Keep continuing sharing/claim and joint acknowledgement tables for later stages.

Reason: existing ContextSpace guards, triggers and Contact-bound LU cannot be safely reinterpreted as the new domain. A registry with enforced type references avoids unconstrained polymorphic IDs without multiplying subtype tables. Reusing User retains credential/session continuity while persisted enrolment makes the writer choice explicit.

Alternatives rejected: renaming ContextSpace without changing semantics; making every private person a global Person; unchecked entityId references; converting existing LU contactId to nullable; permanent dual writes. The chosen design adds schema surface but keeps legacy compatibility and new security responsibilities explicit.

Consequences: new database guards do not arrive automatically from the existing Prisma extension. F-204 must implement and test them before routes activate. F-202 has no backfill. Target inventory is required before deployment/cutover and unavailable in this session. See [physical model](PHYSICAL_MODEL.md) and [inventory](DEPENDENCY_INVENTORY.md). Refines D-019 through D-022; no trust invariant is relaxed.
