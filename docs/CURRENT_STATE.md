# Relish: Current State and Open Work

Status: living snapshot as of **2026-11-02**. Based on GitHub `BigGuruHere/relationship-os` **development** at `54a11ef66616d8386e96f600a69e362b0cdeb6fa`, plus the identified UI cleanup branch. This document is a baseline, not a live deployment monitor.

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

## Pending feature branch

`feature/context-neutral-home-ui-cleanup` was created for three requested UI improvements:

1. Make `/` a context-neutral authenticated Home instead of redirecting to the first `/space/[context]`.
2. Hide the public invitation to speak to Dorian while retaining its implementation for later.
3. Remove the Settings destination from primary desktop and mobile navigation without removing routes or operator controls.

As of this snapshot, that branch has not been merged into `development`. Type-check, browser testing, branch reconciliation and deployment remain to be confirmed. Do not mark the UI work shipped until verified and merged/deployed deliberately.

## Problems and limits worth tracking

- The user observed transcription returning "You" on one Windows laptop while voice transcription worked on other machines. This appears device-specific, but the browser/microphone root cause is **not verified**. Do not rewrite the common transcription service solely on this evidence.
- Test suites contain about 50 known legacy/source-pattern assertion failures at the last reported baseline; re-evaluate their relevance before treating them as harmless or changing them.
- The current My People directory is for the new neutral private home. The original Brokerage Contact records remain in their existing custody and are **not yet consolidated into My People**.
- ContextSpace-specific UI and some old documentation still give the impression that people belong to one exclusive relationship domain. That is not the long-term product model.
- Previous stage documents include old operating and deployment instructions. This snapshot does not assert anything has been deployed to Railway DEV or PROD.
- `README.md` and `CLAUDE.md` historically contained older product/stage framing; the living documentation set now provides the intended current context.

## Next verification sequence

1. Validate the neutral Home UI branch and ensure it does not hide the public QR capture or useful existing navigation; reconcile with latest `development`.
2. On Railway DEV, manually test sign-in -> Home -> Share -> visitor QR -> details submission -> My People -> voice note -> refresh/retrieve.
3. Test both existing Brokerage Contacts and other public profile/event pages for regressions.
4. Confirm actual DEV/PROD branch mappings and deployments before promotion; no implicit production change.
5. Record the verified results and commit/branch identifiers in this document after each accepted change.

## Status maintenance

When a branch is merged, tested or deployed, update the corresponding status and date here. Do not leave "in development", "not merged" or test counts frozen forever. Keep this file concise and move historical detail to stage notes or the Git history.
