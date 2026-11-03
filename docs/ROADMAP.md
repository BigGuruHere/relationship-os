# Relish: Forward Plan

Status: living, outcome-based roadmap. Updated 2026-11-02. This is the working priority order, not an irreversible commitment to numbered stages or delivery dates.

## North star

Make it easy for someone to understand themselves and the people around them, preserve what matters in those relationships, and create valuable human connections with appropriate participation and permission.

## Priority 1 - A usable, simple Relish pilot experience

**Outcome:** At a real meeting, someone scans an existing QR, shares their details voluntarily, and the owner can recall and deepen the relationship without managing multiple applications.

Current implementation foundation: My People Stage 1 and Stage 2 are merged into Development.

Work:
- Verify the merged neutral Home / hidden Dorian invite / simplified navigation changes on Development before pilot deployment.
- Confirm a new user lands on context-neutral Relish Home without destroying access to existing context-specific operations.
- Complete a real-device DEV pass of existing public QR and event redirect -> Share your details -> owner-private Contact -> voice note -> save/retrieve.
- Check that Brokerage, public profiles, event signup and authenticated participant flows still work.
- Verify a user can independently label, publish and share several profiles of the same type; the multi-profile manager is on `feature/multi-labelled-profiles-20261103`, not yet merged or deployed.
- Refine interaction points only from observed pilot friction. Do not invent another QR form, Contact model or note recorder.
- Track the Windows-specific recording issue separately; do not hold all mobile-first work hostage to one device without evidence of a shared defect.

**Exit gate:** one end-to-end real-device flow demonstrated on DEV, no custody regression, clear error behavior and operator confidence to invite a small number of participants.

## Priority 2 - Make the People experience coherent

**Outcome:** People experience one coherent relationship system rather than a collection of context-specific CRMs.

Potential work, subject to product decisions and pilot evidence:
- Review how legacy Brokerage Contacts can be presented from a unified owner perspective **without moving their underlying storage or sharing their private information**. The temporary owner Personal-tag bridge is being reverted by decision D-016. No replacement bridge is planned for the current small pilot; users can add private Contacts directly. Revisit a unified directory only when real pilot needs justify it.
- Clarify how one real person may have multiple contact perspectives and multiple context associations; keep provenance and permissions distinct.
- Simplify redundant profile/context UI only after mapping current functionality and users.
- Decide if and when unverified Contact -> Person -> User linking is necessary, with robust identity and disclosure boundaries.

**Exit gate:** tested, documented model and migration/compatibility strategy before changing contact authority or custody. No automatic legacy data migration by default.

## Priority 3 - Make Dorian a dependable relationship companion

**Outcome:** A person can speak naturally to Dorian, be understood over time, and see that understanding create better human relationships.

Work:
- Confirm reliable call initiation, consent, session routing and follow-up across DEV/PROD using existing Agent Management and Proxy capabilities.
- Validate correct next-call understanding, source provenance, privacy constraints, operator audit and correction mechanisms.
- Decide how contextual conversation instructions differ (Business/Friendship/Dating/etc.) without duplicating all agents and data unless necessary.
- Introduce invitations back into public profiles when the onboarding experience is appropriate, tested and wanted.
- Strengthen channel-appropriate identity verification before sensitive disclosures.

**Exit gate:** repeatable, privacy-safe call loop with visible operator evidence and successful real participant tests.

## Priority 4 - Permissioned network value creation

**Outcome:** Relish helps bridge gaps between what people need, can contribute, and are willing to offer, without making assumptions or sharing private information.

Explore:
- Context- and purpose-scoped opportunity recognition.
- Offers/wants/capabilities/willingness as distinct participant perspectives.
- Permission-controlled introduction proposals and reciprocal participation.
- Outcome tracking and learning from what actually created value.
- Future interfaces for other AI agents through a governed Relish domain API; MCP is one possible access mechanism.

**Gate:** permissions, identity assurance, review and real-world usefulness are established before broad automation.

## Principles for selecting the next task

1. Prefer a verified user benefit over speculative infrastructure.
2. Reuse existing flows. Classify each request as connecting, improving or genuinely new capability.
3. Keep source evidence, custody, relationship status and disclosure permissions distinct.
4. Preserve existing production behavior and historical data; use Development -> feature branch -> review -> merge -> deliberate DEV/PROD validation.
5. Avoid multiplying agents, profile flows or context pages to solve what is primarily a domain-integration problem.
6. Update `CURRENT_STATE.md` when work moves between planned, committed, merged, DEV-verified and PROD-verified.

## Not part of the immediate pilot

- Automatic mutual connections based on QR/phone/email capture.
- Silent merging of Brokerage and My People Contacts.
- Automatic broad cross-context sharing or public Living Understanding.
- Building entire new Dating, event or enterprise product lines before the core meeting-to-follow-up journey is proven.

The next roadmap review should follow evidence from real user testing, not another arbitrary stage number.
