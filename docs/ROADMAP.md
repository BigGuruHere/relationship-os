# Relish: Forward Plan

Status: updated 2026-11-07. The relationship foundation programme supersedes the previous priority order. These are dependency gates, not committed dates or claims of implementation.

## North star

Help people understand themselves, other people, relationships and influences across relationships, and create valuable human connections with permission. Preserve independent perspectives and useful legacy workflows.

## Active programme

The authoritative detailed backlog and stage register are in [foundation implementation and rollout](foundation/IMPLEMENTATION_PLAN.md). Architecture is in [the design](foundation/ARCHITECTURE.md); rationale is in [D-019 through D-023](foundation/DECISIONS.md).

| Stage | Outcome | Current status |
| --- | --- | --- |
| 1 | Architecture, decisions, policy, developer guide and implementation backlog | Merged via PR #13, `d789464` |
| 2 | New-domain primitives, auth isolation, custody and evidence proof | F-202/F-203 merged and DEV operator-confirmed; F-204 merged; F-205 merged; F-206 internal rehearsal merged through PR #19. Stage 2 DEV verification is pending. P-301 directory and person details merged through PR #20 |
| 3 | Invited users share details, keep people and retrieve notes | P-301 through P-305 merged. P-306 internal DEV test operator-confirmed. Hosted erasure replay using the test login, closure/retention readiness, detailed device/provider coverage and cohort approval remain gates. |
| 4 | Secure exchange claiming and directional continuing sharing | Planned after pilot foundation |
| 5 | Private understanding across people and relationships | Planned after evidence/correction readiness |
| 6 | Relationship understanding from separately governed perspectives | Future gated release |
| 7 | Cross-account discovery and approved introductions | Future gated release |

Do not implement all later intelligence capabilities in stage 2. Relationship subjects and independent perspectives belong in the base design; shared relationship analysis does not need to ship with the first pilot. Brokerage stays on its current model unless separately authorised. No forced unified legacy directory is planned.

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

Production promotion is deferred by operator choice on 2026-11-05. Review the full target release diff and migrations, DEV/device evidence, snapshot/restore readiness and pilot privacy gates before recommending it.
