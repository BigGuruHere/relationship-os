# Relish: Current State and Open Work

Status: living snapshot updated **2026-11-03**. Based on GitHub `BigGuruHere/relationship-os` **development** through UI merge `bb8c4d0030f22e355d78ed216bc84c6060ece35a`, plus the UI cleanup merged into Development on 2026-11-02. This document is a baseline, not a live deployment monitor.

## F-202 additive foundation schema (feature branch, 2026-11-04)

Branch `feature/f202-foundation-schema-20261104`, based on development `c3eb501dfaf9eb83339b127cfff570ab0b365646`, adds 15 Foundation models, compound custody/type foreign keys and SQL-only immutability, lineage, completeness and acyclicity constraints. [Migration manifest and rehearsal results](foundation/F202_INVARIANTS.md) describe exact guarantees and limits. No route, auth workflow, Brokerage record or enrolment is changed.

Validation: Prisma validate/generate passed; 23 isolated embedded-PostgreSQL tests passed, including generated Prisma smoke, legacy fixture preservation, snapshot restore/replay and atomic failure injection. 28 focused capture/People/access/onboarding regressions passed with synthetic test secrets; Node 22 Svelte check has zero errors/warnings. True simultaneous-session races and actual target inventory/backups remain unverified. Historical empty-database replay encounters a pre-existing missing-index failure in a 2025 migration; old migrations were not changed. No full historical replay or live database compatibility is claimed.

Status: committed feature work pending merge, not deployed or user-activated. Includes migration `20261104010000_f202_foundation_schema`, executed only in an isolated test engine. Normal application startup can run migrations, so promotion needs the separate target inventory/deployment workflow. Next: F-203 auth/enrolment isolation, then F-204 access guards before any new-domain route uses these tables.

## F-201 physical design and dependency inventory (merged, 2026-11-04)

Branch `docs/f201-physical-foundation-20261104` is based on latest development `d789464b67dd36524e637e8c35f3610f5ffce278`. It adds [physical schema/constraints/service contracts](foundation/PHYSICAL_MODEL.md), [source dependency and data inventory](foundation/DEPENDENCY_INVENTORY.md), and a commented [read-only aggregate inventory query](../scripts/foundation/inventory-readonly.sql). D-024 records why new private custody/typed subjects are separate from legacy ContextSpace and Contact.

Status: design/source inventory merged via PR #14 at `c3eb501dfaf9eb83339b127cfff570ab0b365646`. That documentation change made no Prisma schema, runtime or database changes; F-202 schema work is tracked above. Actual DB counts/applied migration parity are unverified because no database connection is configured. The query is prepared, not run on DEV/PROD. F-202 can implement/rehearse on isolated fixtures; target inventory and backup evidence remain gates before target migration/cutover. Stage 2 itself is not complete. Validation: all 56 relative links across 14 living/foundation documents resolve; the inventory SQL parses as 10 PostgreSQL statements limited to read-only transaction setup, SELECT and rollback; referenced tables were checked against Prisma. `git diff --check` passed. No SQL execution or application tests were performed for this design change.

## Relationship foundation programme (merged, 2026-11-04)

Source baseline for this review: development `77a8b2b58232b9413d57b86e853bf478bbee0492`. Branch `docs/relationship-foundation-plan-20261103` adds the [architecture and glossary](foundation/ARCHITECTURE.md), [decisions](foundation/DECISIONS.md), [policy/provenance contract](foundation/POLICY_AND_PROVENANCE.md), [stage-2/3 backlog and rollout plan](foundation/IMPLEMENTATION_PLAN.md), and [developer guide](foundation/DEVELOPER_GUIDE.md). Living product, architecture, roadmap and standing documentation rules are updated together.

Status: documentation merged through [PR #13](https://github.com/BigGuruHere/relationship-os/pull/13), development commit `d789464b67dd36524e637e8c35f3610f5ffce278`, confirmed 2026-11-04. No runtime implementation, Prisma migration, data movement or deployment. F-201 design/source inventory is now delivered as described above; F-202 additive schema and an internal proof follow. Stage 3 adapts existing QR, People and note interfaces for an invited cohort. Later relationship understanding and discovery remain planned. Documentation validation belongs to this PR; previous application test results below are historical and were not rerun for this change.

## Three-screen contact exchange and optional signup (merged into Development)

Implemented on `feature/three-step-profile-onboarding-20261103`, based on Development `4bb88fe7d84559ac1531653790518efc789f9fd8`. Merged into `development` on 2026-11-03 via [PR #10](https://github.com/BigGuruHere/relationship-os/pull/10), merge commit `841e59cc1d68a2f41d2404474bfa0576b265debb`. Deployment and real-device validation remain unverified.

1. Published visitor profile shows public details and **Save contact**. With JavaScript, the existing vCard download starts and navigation follows to the existing share-details route. Browser/OS completion of saving a contact is not detectable. The follow-up fix removes the secondary sharing button so this screen has one exchange action; automatic continuation requires JavaScript.
2. Optional **Share your details** form retains name, optional email/telephone, explicit consent, capture token, custody, provenance and abuse protections. **Skip** writes no Contact.
3. Send or Skip shows an optional **Create my Relish profile** invitation. A successful Send displays a receipt and a private preview using only the visitor's entered details. Skip shows an empty preview, without a false sharing confirmation. Close/Maybe later returns to the original profile. Signed-in visitors go to My Profiles.

Only the explicit profile-creation button stores a bounded, authenticated encrypted HttpOnly draft cookie for 30 minutes. It is form convenience, not identity evidence. Existing registration, login and Google OAuth allow one exact new return destination (`/settings/profile?onboarding=1`) alongside existing Network invitation returns. New profiles created by this flow begin unpublished; regular registration defaults are preserved. The existing owner-scoped editor prefills blank email/phone fields for review and clears the cookie after successful save, then returns to Share/QR. Existing profiles are not overwritten by signup. No Contact/Person/User matching, mutual Connection, Dorian call or private-note disclosure is inferred. No Prisma migration.

Validation: Node 22 Svelte/TypeScript check passed with zero errors/warnings. All 28 focused tests passed, covering real route handlers with an in-memory persistence boundary, draft encryption/expiry, redirect restrictions, rendered screens and compatibility. The full suite recorded 839 passes and 52 failures out of 891 tests; unchanged Development at `4bb88fe` recorded 827 passes and the same 52 failure names out of 879 tests in a separate prepared worktree. No new full-suite failures were introduced. These are local checks, not live database/provider tests. Browser/device vCard handoff, actual database capture and real Google OAuth remain unverified; Chromium was unavailable and its download failed in this environment. The configuration-specific event landing redirect remains intact and can still supersede the normal profile landing.

### Contact exchange layout fix (2026-11-03)

`fix/profile-exchange-layout-20261103`, based on Development `adaf26a`, removes the secondary Share your details action from the guest profile. Save contact retains its vCard download and continuation to screen two. The consent checkbox now overrides global full-width input styling with a fixed 18px width; the adjacent text can fill and wrap within the remaining row. No server behavior or Prisma migration changes. Validation: 12 onboarding tests and the focused profile action regression check passed; Node 22 Svelte/TypeScript check passed with zero errors/warnings. Merged into `development` on 2026-11-03 via [PR #11](https://github.com/BigGuruHere/relationship-os/pull/11), merge commit `c4c643d6ab2d38bf7e5e5e9f57c6b6785f3a9daa`. Deployment and real-device verification remain unconfirmed.

### Returning contact exchange visitors (merged, 2026-11-03)

`fix/contact-exchange-return-visit-20261103`, based on Development `5ccf29d`, remembers successful detail sharing with an encrypted HttpOnly browser receipt. After Maybe later returns to screen one, downloading the contact again opens screen three directly through the existing share-details route. The receipt contains profile IDs/timestamps only, lasts 30 days, and retains at most 16 profiles. It is written only after successful capture, never after Skip, validation/storage failure or honeypot submissions. Different profiles, cleared cookies and other browsers still start at the sharing form. It cannot retroactively recognise shares completed before this fix. It grants no data access, identity link or mutual Connection, and makes no additional Contact write on a repeat visit. Existing signup remains independent: it does not automatically add the sharer to the new user's My People list. No Prisma migration. Validation: all 15 onboarding route/helper/render tests passed, and Node 22 Svelte/TypeScript check passed with zero errors/warnings. The existing browser check now covers the repeat-download journey but has not been run against a live database. Merged into development via [PR #12](https://github.com/BigGuruHere/relationship-os/pull/12), commit `77a8b2b58232b9413d57b86e853bf478bbee0492`. Deployment remains unverified.

### Corrections to older branch-status notes below

Source inspected at Development `4bb88fe` already contains the private-only My People reversal, repaired People navigation, and the multi-profile manager. The older feature-branch-only paragraphs below are historical status descriptions, not current evidence that these changes remain unmerged. Their live DEV/PROD deployment remains unverified. Type-check results above apply to this new feature branch.

## What is implemented in Development

| Capability | Source status | Verification caveat |
| --- | --- | --- |
| Existing Brokerage CRM / Contact and Interaction workflows | Preserved in main app | Regression-test on changes that touch shared services |
| My People Stage 1: manual Contact, search, owner notes and voice-note flow | Merged into `development` | Codex reported local tests; real devices/providers still need testing across platforms |
| My People Stage 2: QR/profile opt-in share-details capture, provenance, private Contact and optional note summaries | Merged into `development` via `5cc7cc5` and `47c00d4` | Its stage note still says feature branch only; that branch-status sentence is now historical and stale |
| Existing profile, QR, event signup and optional Dorian routes | Present | Event redirect may be configuration-specific; test the actual public visitor path |
| Dorian consent, call routing and Living Understanding pipeline | Present from earlier work | Operating behavior, provider settings and actual Railway deployment are not verified by this document |
| `AGENTS.md` development rules | Merged at `54a11ef` | Standing rule requires new Codex feature branches from Development by default |

Stage 2's checked-in test report records `npm run check` with zero errors/warnings, 820 passes and 50 existing assertion failures out of 870 tests, and focused integration tests including 11 QR capture checks and 14 Stage 1 checks. These are **reported Codex test results**, not tests independently rerun for this documentation update. No new Prisma migration was needed for Stage 1 or Stage 2.

## UI cleanup integrated into Development

Pull request [#2](https://github.com/BigGuruHere/relationship-os/pull/2) merged `feature/context-neutral-home-ui-cleanup` into `development` at `bb8c4d0030f22e355d78ed216bc84c6060ece35a` on 2026-11-02, covering three requested improvements:

1. Make `/` a context-neutral authenticated Home instead of redirecting to the first `/space/[context]`.
2. Hide the public invitation to speak to Dorian while retaining its implementation for later.
3. Remove the Settings destination from primary desktop and mobile navigation without removing routes or operator controls.

The code is merged into `development`, but type-check, browser testing and Railway deployment remain unverified here. Do not mark the UI work deployed or pilot-validated until those steps are confirmed.

## Legacy Personal-tag organiser reversal (not yet merged)

On 2026-11-03 the owner elected to abandon the temporary Personal-tag bridge between Brokerage and My People in favour of adding a small number of personal Contacts afresh.

- The organiser originally landed on `development` (commit `b36d8a4d460ce6d51477a7896af04b19b7a1a163`), despite its earlier feature-branch-only documentation.
- `revert/owner-personal-contact-organiser-20261103` restores the original private-only My People directory and removes the organiser page, tag helper and corresponding tests.
- Existing Brokerage Contact records, IDs, notes and historical relationships are not deleted or moved. Previously applied Personal classification tags are not used by the restored directory. No database writes are part of this reversal.
- Any Contact separately created in the private My People storage remains there; it is not a copy created by the Personal checkbox and must be reviewed individually before deletion.
- Reversal is committed only to the feature branch. Integration and deployment are separate steps; production/DEV state has not been verified.

## Navigation and mobile header corrections (feature branch only)

On 2026-11-03, `fix/people-navigation-mobile-header-20261103` restores the common Home, People, Profile and Share navigation on desktop and mobile for My People routes. It also restores mobile right alignment of the header action and three-dot menu on pages without a ContextSpace selector. Focused source regression checks were added. This is not merged or deployed; type-check and real browser validation remain outstanding.

The Business/Friendship/Dating selector still navigates ContextSpaces, not profiles. Multiple independently labelled profiles per kind are not yet supported by the existing editor workflow, despite the Profile model already having a label field. This is a separate product decision.

## Multiple independently labelled shareable profiles (feature branch)

On 2026-11-03, `feature/multi-labelled-profiles-20261103` adds a profile manager that lists **all** owner-created Profile records, including multiple profiles with the same `kind`. The existing editor supports an explicit `mode=new` creation path and stores an owner-facing `Profile.label` separately from public `displayName`. Each profile keeps its independent slug, published status, QR destination and source-profile provenance for new Contacts. New profiles created from My Profiles begin unpublished unless explicitly published; established first-time onboarding keeps its prior publication default.

Existing Business/Friendship/Dating ContextSpace selection remains unchanged. Legacy contextual profile selection now prefers the established oldest profile of a kind (or the account's default), so adding a new same-kind profile does not automatically replace it in the existing context UI. This does **not** introduce a new ContextSpace, permission or custody relationship. No Prisma migration is needed because `Profile.label` and one-to-many User profiles already exist.

Status: code committed to feature branch only, not merged or deployed. Added focused source regression tests. Runtime Svelte checks, database tests, browser testing and QR verification are still required before pilot rollout.

## Context-neutral profile navigation and label-based Share selector (feature branch)

On 2026-11-03, `fix/profile-share-context-neutral-selector-20261103` removes the Business/Friendship/Dating ContextSpace selector from neutral `/profiles`, `/settings/profile` and `/share` routes. Those routes now use the same global navigation as Home and My People; selectors on genuinely contextual workspace pages remain unchanged.

The Share page now provides a dropdown of **all profiles owned by the signed-in user** with the owner's label (falling back to the public name for legacy default labels), plus type as secondary context. Selecting a profile navigates to its exact `/share?profile=<slug>`, keeping QR and share actions consistent. Unknown explicit profile slugs return 404 rather than silently choosing another profile. This uses existing Profile fields with no migration.

Status: feature branch committed, not merged or deployed. Focused source regression coverage added; full application checks and real mobile/browser tests still outstanding.

## Problems and limits worth tracking

- The user observed transcription returning "You" on one Windows laptop while voice transcription worked on other machines. This appears device-specific, but the browser/microphone root cause is **not verified**. Do not rewrite the common transcription service solely on this evidence.
- Test suites contain about 50 known legacy/source-pattern assertion failures at the last reported baseline; re-evaluate their relevance before treating them as harmless or changing them.
- The current My People directory is for the new neutral private home. The original Brokerage Contact records remain in their existing custody and are **not yet consolidated into My People**.
- ContextSpace-specific UI and some old documentation still give the impression that people belong to one exclusive relationship domain. That is not the long-term product model.
- Previous stage documents include old operating and deployment instructions. This snapshot does not assert anything has been deployed to Railway DEV or PROD.
- `README.md` and `CLAUDE.md` historically contained older product/stage framing; the living documentation set now provides the intended current context.

## Next verification sequence

1. Run type and browser checks against merged Development for the neutral Home UI; confirm it does not hide public QR capture or useful navigation.
2. On Railway DEV, manually test sign-in -> Home -> Share -> visitor QR -> details submission -> My People -> voice note -> refresh/retrieve.
3. Test both existing Brokerage Contacts and other public profile/event pages for regressions.
4. Confirm actual DEV/PROD branch mappings and deployments before promotion; no implicit production change.
5. Record the verified results and commit/branch identifiers in this document after each accepted change.

## Status maintenance

When a branch is merged, tested or deployed, update the corresponding status and date here. Do not leave "in development", "not merged" or test counts frozen forever. Keep this file concise and move historical detail to stage notes or the Git history.
