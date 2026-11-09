# Relish: Forward Plan

Status: updated 2026-11-09. D-029 makes ordinary onboarding and a small production release the next priority. These are dependency gates, not committed dates or claims of implementation.

## North star

Help people understand themselves, other people, relationships and influences across relationships, and create valuable human connections with permission. Preserve independent perspectives and useful legacy workflows.

## Next delivery: production base

Accepted direction: [D-029](DECISION_LOG.md#d-029-ordinary-onboarding-and-an-incremental-production-launch). Recommended implementation model: GPT-6.1 Sol High, because signup, atomic provisioning and private-data routing cross authentication and custody boundaries.

1. **Implemented.** Password and Google signup atomically provision the account, private home, self reference and unpublished profile. Existing legacy accounts keep their custody and routing.
2. **Implemented.** The core runs without any exchange or DEV fixture flag. Reciprocal exchange and channel delivery stay restricted to their existing DEV configuration. Foundation navigation focuses on the core and the server rejects legacy-only writes through public lead, Network and profile call routes.
3. **Core path implemented.** Profile review and publication, QR/manual capture, My People, private voice-note transcription, editable summaries and retrieval reuse the existing services. Password self-service recovery needs verified destination proof and a delivery flow. Provider/device acceptance and privacy/support readiness remain promotion gates.
4. **Promotion preparation pending.** Run the complete ordinary-user journey on an authorized DEV deployment, reconcile target migration history and rehearse hosted backup/restore and compatible rollback. Separately approve and execute production promotion after reviewing the evidence.

See the [production-base backlog](foundation/IMPLEMENTATION_PLAN.md#production-base-backlog-d-029) and [Current State](CURRENT_STATE.md#ordinary-production-onboarding).

## Active programme

The production base above takes priority over the earlier invited-pilot sequence. Historical stages retain delivery evidence and future capability boundaries; completing every exchange/intelligence feature is not required before releasing the core app.

The authoritative detailed backlog and stage register are in [foundation implementation and rollout](foundation/IMPLEMENTATION_PLAN.md). Architecture is in [the design](foundation/ARCHITECTURE.md); rationale is in [D-019 through D-023](foundation/DECISIONS.md).

| Stage | Outcome | Current status |
| --- | --- | --- |
| 1 | Architecture, decisions, policy, developer guide and implementation backlog | Merged via PR #13, `d789464` |
| 2 | New-domain primitives, auth isolation, custody and evidence proof | F-202/F-203 merged and DEV operator-confirmed; F-204 merged; F-205 merged; F-206 internal rehearsal merged through PR #19. Stage 2 DEV verification is pending. P-301 directory and person details merged through PR #20 |
| 3 | Ordinary users onboard, keep people and retrieve notes in production | P-301 through P-305 merged; P-306 internal DEV test operator-confirmed. Hosted DEV and launch acceptance for production-base onboarding are pending under D-029. No invited-cohort prerequisite; privacy, recovery and enabled-provider/device readiness remain. |
| 4 | Secure exchange claiming and directional continuing sharing | S-403 and fixes merged through PR #36. S-405a corrects exchange/account-assurance design on feature branch; S-405b-e implementation and S-404 recovery/acceptance remain planned. |
| 5 | Private understanding across people and relationships | Planned after evidence/correction readiness |
| 6 | Relationship understanding from separately governed perspectives | Future gated release |
| 7 | Cross-account discovery and approved introductions | Future gated release |

Do not implement all later intelligence capabilities in stage 2. Relationship subjects and independent perspectives belong in the base design; shared relationship analysis can follow the first production release. Brokerage stays on its current model unless separately authorised. No forced unified legacy directory is planned.

## Exchange follow-up

[S-405](foundation/S405_ACCOUNT_CHANNELS_AND_EXCHANGE.md) remains the design for exchange functionality, subordinate to the production-base priority above: S-405a architecture/documentation, S-405b owned-profile confirmation, S-405c account-channel persistence and SMS lifecycle, S-405d guest reuse/email and trusted Google proof, then S-405e combined DEV acceptance. S-405a recommends Astra Medium; runtime slices recommend 6.1 Sol High. S-405b signed-in profile exchange is implemented on its feature branch; S-405c account-channel/SMS settings are implemented on their feature branch; S-405d guest reuse/email is implemented on its feature branch; sender setup, live DEV and S-405e combined acceptance remain pending. S-404 recovery obligations remain and are incorporated in the acceptance work. The current baseline includes PR #36 at `4a4ddb2`; deployment requires separate verification.

## Parallel maintenance and validation lane

Existing pilot and Dorian infrastructure can be maintained while the new foundation is built. Keep cohorts and authoritative data paths explicit; do not claim the existing experience already uses the new architecture.

- Validate the new three-screen contact exchange merged into Development via PR #10 (`841e59c`): Save contact on iOS/Android, Send and Skip, optional signup, draft prefill through password/Google auth, owner review/publication, then working Share/QR. It is merged into Development; deployment remains unverified. Test the configured event redirect separately.
- Verify the merged neutral Home / hidden Dorian invite / simplified navigation changes on Development before pilot deployment.
- Confirm a new user lands on context-neutral Relish Home without destroying access to existing context-specific operations.
- Complete a real-device DEV pass of existing public QR and event redirect -> Share your details -> owner-private Contact -> voice note -> save/retrieve.
- Check that Brokerage, public profiles, event signup and authenticated participant flows still work.
- Verify a user can independently label, publish and share several profiles of the same type; the multi-profile manager is present in the reviewed source; deployment remains unverified.
- Refine interaction points only from observed pilot friction. Reuse QR and note UI; change persistence only through the foundation transition.
- Track the Windows-specific recording issue separately; do not hold all mobile-first work hostage to one device without evidence of a shared defect.

- Verify Dorian call initiation, consent, routing and next-call retrieval independently of new-domain implementation. Do not silently switch legacy conversation ingestion.
- Preserve provider recording settings and strengthen channel identity before sensitive disclosure.
- Establish backup/restore, access/removal support and redacted operational diagnostics before expanding participation.

## Delivery and documentation rules

For each material change update the relevant living docs, backlog item and stage register in the same implementation PR. Record tests actually run, migration/rollback requirements, cohort scope and limitations. Update CURRENT_STATE at merge and again at deployment with actual commit/environment evidence. Never infer deployment from a merge.

Select the next task from the earliest unmet gate. New capability replaces existing code only through a demonstrated gap and explicit compatibility plan. No production writes, migration execution or deployment follow automatically from this roadmap.

The 2026-11-05 production deferral and invited-cohort launch policy are superseded by D-029. Prepare an ordinary production release with the full target diff/migration review, DEV evidence, recovery readiness and privacy controls appropriate to the enabled scope. Production execution still requires separate authorization; this roadmap is not a deployment record.
