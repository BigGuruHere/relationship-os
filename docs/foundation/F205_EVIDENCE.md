# F-205 private evidence and understanding

Implemented on `feature/f205-private-evidence` from development `33f87f3`. F-204 merged through PR #17. Operator confirmation of its DEV smoke checks is pending.

## What a service caller can do

Resolve a fresh foundation handle from authenticated server locals for each purpose. An internal caller can record an owner note, inspect an excerpt, record a supported statement, or read current understanding. Each operation reuses F-204 owner, custody, epoch and lifecycle checks inside the transaction.

1. Call `appendOwnerNote` with RECORD_EVIDENCE, a stable request key, expected current version (zero on first creation), source text, one exact quote, UTF-16 start/end offsets and up to 32 distinct active subjects. A person and their relationship can both refer to this single excerpt. An optional speaker must identify an active private person.
2. Recording defaults to STORED_ONLY. An explicit owner choice of PRIVATE_ANALYSIS is recorded in encrypted version provenance. Correcting the text or changing admission appends a successor with its own anchors. The existing account and vault locks serialize revision comparison, creation and associations. A matching retry returns the original receipt. A changed request for the same revision returns a conflict.
3. Use READ_SEGMENT with `readEvidenceSegment` to inspect the original quote, offsets, speaker and subjects. The guard limits parent-version inspection to eligibility fields. Payloads, provenance and excerpts have separate row-bound authenticated encryption. Scoped MACs preserve the exact source and request bytes.
4. Use RECORD_STATEMENT with `appendSupportedStatement` to record a version with its own perspective, subjects, mode, confidence and one directly supporting segment. The source must currently permit analysis. Attributed declarations require the matching recorded speaker. AI interpretations require INFERRED mode. These are private records made by the owner.
5. READ_STATEMENT with `readCurrentStatement` checks the latest statement and its exact input again. Correcting the source, withdrawing admission, archiving a referenced subject or disabling a root can make a statement unavailable. Reassessment with eligible evidence creates a successor. Inspecting an old segment preserves the historic quote.

## Scope and release

This first slice supports owner-entered text, one anchored excerpt per version, multiple subjects, and one direct support per statement version. Other derivation graph shapes fail closed. Shared perspectives, agent processing, disclosure, public capture, semantic context associations and background jobs require subsequent services and authorization. F-206 will rehearse the integration before the invited pilot.

The change uses existing F-202 tables. Deploying the code requires zero new Prisma migrations and enrolls zero accounts. Pilot routes continue using their current writers. Before any foundation write, application rollback can remove these internal callers. After writes, preserve all versioned data and eligibility guards, stop affected writers and roll forward.

The F-205 tests run through the actual F-204 client fixture in `npm run check:foundation:access`. They cover replay and version conflict, atomic rollback, custody, exact offsets, parent-payload denial, attribution, shared subject references, statement correction and invalidation after both source correction and withdrawal. A competing-correction case runs on standard PostgreSQL in the foundation CI workflow.

## Acceptance record

[PR #18](https://github.com/BigGuruHere/relationship-os/pull/18) targets development. The [foundation CI run](https://github.com/BigGuruHere/relationship-os/actions/runs/41954241665) passed all 87 tests on implementation commit `2ee0634`, including all eight F-205 cases. The PostgreSQL 18.6 correction race produced one committed successor and one conflict. The local Node 22 Svelte check reported zero errors and warnings. Merge and DEV verification are pending.
