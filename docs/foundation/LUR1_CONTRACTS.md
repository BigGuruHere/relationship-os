# LUR-1: reusable Living Understanding contracts

2026-11-11. Implemented on `feature/lu-contracts-extraction`, based on `development` at `d0e3ada0`. Unmerged and undeployed. This is stage one of the [Astra preservation assessment and build plan](https://github.com/BigGuruHere/relationship-os/blob/f4de3ffb6f2566e2e5f6a12ce01a77b5f001a453/docs/foundation/LU_REFACTOR_ASSESSMENT_AND_PLAN.md), independently reviewable in [PR #65](https://github.com/BigGuruHere/relationship-os/pull/65). The implementation uses the user's Sol 6.1 Medium scope for this bounded stage.

## Reuse and caller inventory

`src/lib/server/livingUnderstanding/revisionPolicy.mjs` is the original pure revision policy, byte for byte. `datingUnderstandingRevisionPolicy.mjs` re-exports it so the runtime call sites, test imports and exported identities remain unchanged. There is one implementation. In particular, the `8.14.0` INITIAL rule continues to allow legitimate overlap with distinct semantic homes, and earlier diagnostic contracts keep their original interpretation.

| Caller | Existing responsibility retained |
| --- | --- |
| `datingUnderstandingRevisionExperiment.ts` | Exact quote and turn guards, topic impacts, semantic decomposition, longitudinal diagnostics and structural validation. The Contact/ContextSpace reader, prompts and model calls remain here. |
| `core/phoneUnderstandingAutomation.ts` | Consolidate areas for initial construction; current calls to initial decomposition, audit, adoption and longitudinal processing retain their existing permission and outcome behavior. |
| `routes/dating/people/[id]/understanding/revision-experiment/+page.server.ts` | Batch area targets, consolidate selected areas, validate operational units and longitudinal seed input. |
| Existing `tests/core/stage8-*` consumers | Continue using the old import path and the same policy implementation. |

`datingLongitudinalLivingUnderstanding.ts`, `datingPersistedLivingUnderstanding.ts`, and the Foundation six-proposal note review have no new caller or writer in this stage. Their orchestration, prompts, and data paths are unchanged.

## Executable preparation contract

- `contracts.ts` provides provider-independent `SourcePacket` and `UnderstandingCandidate` types and runtime parsers. The packet carries one immutable source/version binding, canonical text, speaker-labelled UTF-16 turns, server-selected destinations and exact baseline memberships. The stream list supports more than three subjects. An unresolved mention has a source turn and no identity authority. First rollout uses the owner, selected person and their private relationship, where applicable.
- The packet parser rejects duplicate/unknown references, overlapping or incomplete turn labelling, false agent/person bindings and broken UTF-16 boundaries. Storage can retain incomplete or stored-only sources; the candidate parser denies them for LU preparation. It verifies source version/MAC, exact quote/spans, allowed subject/perspective, human supporting speaker, attribution, baseline versions and inherited meaning coverage. Agent/unresolved turns can be context dependencies only. Owner perspective is the only enabled candidate perspective.
- Typed meanings retain content kind, epistemic basis, expressed uncertainty, confidence, source speaker, attributed asserter, generation origin, recorder and time independently. Candidate review is always `UNREVIEWED`; a review event belongs to a later authenticated transaction. A model drafting an explicit human opinion does not make it a model inference. A reported statement may have an unresolved original speaker; an owner report is not verified speech by the reported person. Separate Dorian hypotheses remain out of scope.
- `legacyTaxonomy.ts` validates and carries all old claim enums losslessly, including status, and preserves available experimental certainty/actor/decision separately. Hints never confer new perspective, exact speaker attribution, authority or approval. `DIRECT` may be a direct opinion; `INFERRED` does not identify an author; `CONFIRMED` does not verify a claim as fact. No historical mapping, import or backfill runs.

These validators enforce structure and referential consistency. They do not establish truth, semantic entailment, authorisation, current database state or a complete assessment of every durable meaning. The next service must assemble packet scope and provenance from trusted storage/runtime data and recheck them with a real Foundation handle. Model responses may propose wording, effect and evidence locations; the server supplies custody, invocation, recorder, baseline and review metadata. No serialized object, candidate or content MAC substitutes for a handle. Use current semantic coverage/audit/repair in LUR-3 before any authoritative write.

The fixtures in `tests/core/fixtures/lu/conversations.mjs` are synthetic: nine topics across four areas, all three initial subjects, historical/current/mixed scope, direct feelings, uncertainty, expressed opinion, attributed report, agent question plus affirmation and an unresolved name. The second conversation labels the seven prior-topic effects and one new topic for later replay. Tests exercise the wire and preservation contracts, including evidence reuse, omitted prior topics, repeated quotes, UTF-16 boundaries and rejection of forged review, source and subject references. Real model-quality comparison and transaction tests belong to later stages.

## LUR-2 physical handoff

This is the implementation contract for the next migration. It adds Foundation records only. Existing notes and their approvals remain readable with their original provenance. Do not invent transcripts or update old claim rows to fill missing metadata.

### 1. Meaning classification and attribution

Keep `FoundationStatement` / `FoundationStatementVersion` and their existing mode. Add nullable `contentKind` and `epistemicBasis` using the executable vocabulary in `contracts.ts`. Existing versions have null for these added fields; every LUR-created version must populate them. `DECLARED` requires the matching human speaker and direct account of their own state; use `OBSERVED` for expressed opinions about others and reported claims, with the precise basis retained. `INFERRED` is reserved for an explicitly authorised scope. Preserve unknown times as null.

Add `FoundationLuMeaningOrigin` keyed by exact `statementVersionId` and scope, linked by composite FK to the version. It stores `asserterKind`, nullable `asserterSubjectId` with same-vault PERSON constraint, `generatorKind`, `recorderKind` and `generationEnc` for invocation/model/prompt/pipeline/edit lineage and expressed uncertainty. Human source-speaker attribution is checked against the primary support segment's recorded turn, with `primarySegmentId` bound to that same scoped segment. Validate role and basis against the eligible packet; never fabricate person IDs for an agent. A model invocation describes the producer of the wording. It does not determine the asserter or approver. Source capture retains its own recorder and provenance.

### 2. Full sources and independent presentations

Reuse `FoundationSourceVersion.payloadEnc` with a versioned conversation envelope for canonical text, stable turn offsets, speaker map, verified capture binding and completeness. Keep `contentMac` bound to exact content. Extend the encrypted anchor contract to include `turnId`; the source version, exact span and role remain available to the evidence validator. The existing evidence uniqueness constraints still prevent duplicate anchors.

Add `FoundationSourcePresentationVersion` keyed by `(sourceId, version)` with its own id, same-vault source/version FK, nullable exact predecessor, encrypted summary, request MAC, owner/editor and generation provenance. Every save binds the summary to one immutable input source version. Summary edits append a presentation version using expected version and replay checks. They never write a transcript successor or grant analysis admission. Existing notes with only summary text remain note sources.

### 3. Streams, topic versions and authoritative snapshots

All new rows carry `ownerUserId` and `vaultId`; every domain FK includes both. Use explicit same-stream and same-topic keys where indicated. Foreign keys restrict deletion; the privacy eraser owns dependency ordering. Content is encrypted with row-bound authenticated data.

| Record | Required keys and contents |
| --- | --- |
| `FoundationLuStream` | Unique `(vaultId, subjectId, perspectiveId)`; scoped subject and perspective FKs, server checks `OWNER_RECORDED` and active subject. Additional subjects live in versioned meaning/evidence associations. |
| `FoundationLuTopic` | Stable id and `streamId`; unique scoped identity `(id, streamId, ownerUserId, vaultId)`. Labels do not identify topics. |
| `FoundationLuTopicVersion` | `topicId`, `streamId`, `version`, exact predecessor FK, creating revision FK, `timeScope`, `effect`, encrypted area/title/prose. Unique `(topicId, version)` plus scoped identity with topic and stream. |
| `FoundationLuTopicMeaning` | Exact topic version and exact statement version, membership role `PRIMARY` or `CONTEXTUAL`, order. Unique `(topicVersionId, statementVersionId)`. Validate matching eligible subject/perspective when writing. |
| `FoundationLuRevision` | `streamId`, `revisionNumber`, exact preceding revision in stream, `approvalId`, exact causing source version. Unique `(streamId, revisionNumber)`; a replay never increments the revision. |
| `FoundationLuRevisionTopic` | Full ordered membership of each revision. Unique `(revisionId, topicId)` and `(revisionId, position)`; composite FK to exact topic/version/stream and revision/stream. Carry forward unchanged version IDs. |
| `FoundationLuCandidate` | Immutable candidate-attempt id, exact input source version and content MAC, epoch, encrypted packet manifest and proposal, generator/run versions, expiry and outcome. Candidate supersession or retry appends a new attempt. `NO_CHANGE` is a distinct terminal receipt and creates no empty revision. |
| `FoundationLuApproval` | Exact candidate FK and version-bound, authenticated owner review decision, timestamp, mechanism, encrypted approved/deferred/rejected selection and request MAC. Unique `(vaultId, requestKey)` for retries. Revisions bind to this event. Edits produce a successor candidate and are reviewed on that version. |

The candidate's encrypted baseline manifest binds exact identities and versions; re-resolve all entries under the approval transaction. An aggregate revision never relies on unvalidated JSON IDs for relational membership. Preserve exact supporting statement versions across revisions, including reinstatement/qualification evidence, rather than reconstructing old citations from prose. `UNCHANGED` reuses authoritative prior text and version; candidate text is not an overwrite. Retirements require explicit owner review and retain prior history subject to current eligibility.

### 4. Evidence roles and eligibility

Add `CONTEXT` to `FoundationSupportRelation`. Each edge has exactly one scoped input, segment or statement version. Keep F-205's restricted reader and writer behavior for existing flows. New LU repository operations traverse only the authorised derivation graph, reject cycles and unknown edge roles, and require eligible supporting evidence and eligible contextual dependencies. Agent prompts may contribute context to a human affirmation, never be affirmative evidence of the human's views. Keep separate current-content checks for supporting sources, subject/perspective state, admission and epoch. A lost input withholds affected derived prose and counts; independent evidence requires a new assessed version. Keep graph bounds explicit, fail closed at limits and require deterministic tests for inherited support and propagation.

### 5. Atomic approval

One reviewed candidate, one owner action, one transaction across all selected subject/perspective streams. Resolve the current handle and lock the existing account/vault root. Check a same-request replay before stale-baseline rejection, after checking current authority; matching replay returns the existing receipt without revealing newly ineligible content. Check source/head/epoch and every affected baseline inside the transaction. Revalidate the selected snapshot's coverage and evidence dependencies, append immutable versions/memberships/approval together, and record unselected changes as deferred. Any mismatch rolls back the whole batch. No provider calls under the lock. A deferral or rejection alone records a review event and does not create a topic revision.

## Guard, privacy and migration acceptance for LUR-2

| Existing boundary | Required next change |
| --- | --- |
| `policy.ts`, `withFoundationAccess` | Add operation-specific handles for conversation save/read, eligible LU input, candidate storage, approval and eligible LU history. Use the existing owner/root lock and epoch; no implicit grants from `READ_NOTES`, `READ_SEGMENT`, `PROCESS_DRAFT`, `REVIEW_NOTE` or membership. |
| `internal.ts` scoped Prisma guard | Allow only the named scoped delegates and operations; append-only candidates and topic versions; deny nested cross-boundary writes, public intake, exchange and segment-only payload access. Scope checks still apply for privacy operations. |
| `evidence.ts` / new Foundation LU repository | Validate source-version admission, anchors and multi-input dependencies at preparation, approval and eligible read. Extend the encrypted source codec, retaining legacy note readers. No approval based solely on the wire parser. |
| `privacyOperations.ts`, operator review/restore | Include new table inventory and reviewed erasure. Delete revision memberships and topic-meaning links first, then topic versions, revisions, topics and streams, then approvals and candidates. Delete presentations and meaning origins before their statement/source parents. Delete successor chains newest first or in scoped sets with constraint-safe ordering. Test against restrictive FKs. Suppress disabled/withdrawn/deleting data and prevent backup replay from restoring access. No new retention policy. |

LUR-2 needs an additive Prisma migration with same-vault, same-stream and version-lineage constraints. Rehearse on isolated PostgreSQL; test cross-vault writes, competing approvals/corrections, transaction rollback, summary-only edits, revocation and erasure. Disable the new writers to roll back after any new records exist; preserve new read/erasure controls and data. No legacy table removal or production migration follows from LUR-1.

## Validation and release

LUR-1 changes no Prisma schema, database, UI, model configuration or route activation. Revert this application commit to roll back the internal extraction. There is no DEV or PROD rollout and no data to migrate.

Local validation used Node 24 and the checkout's matching locked dependencies. The existing Foundation PR workflow runs the focused command on Node 22.

- Focused contract and policy checks: 45/45, including 26 new contract cases and the existing INITIAL overlap checks. See the command in `.github/workflows/foundation-database.yml`.
- Broader comparison: 121/126 on the original `development` code, 147/152 on this branch including the new tests. The five failures match by name: workspace transcript subject/routing and encrypted excerpt assertions, the longitudinal experiment's chain-history assertion, and two historic impact-review UI wording assertions. No tests or runtime copy were weakened.
- `npm run check`: zero errors and warnings. `npm run check:foundation:notes`: 15/15 against disposable in-memory PostgreSQL with synthetic data and provider stubs. No hosted database or live model was used.

The extracted policy was also compared byte for byte with the original Git blob (`e7f2ef070018bfc4d5626731fe4910b00d8eedbadd2abe2c6080d7e1a8c8eef5` SHA-256). These checks establish deterministic and source-level compatibility, not model-quality parity or deployed acceptance.
