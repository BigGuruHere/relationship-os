# Living Understanding: preservation assessment and refactor plan

Date: 2026-11-11. Assessment baseline: `development` commit `d0e3ada087b224488c656a60640dea5f4b5a904b`, inspected on `docs/living-understanding-refactor-plan`. Status: **assessment and proposed implementation plan only**. No runtime code, database, provider configuration or deployment was changed by this assessment. The operator reports an earlier DEV/PROD reset; this plan does not assume surviving legacy accounts or require reading either database. New Foundation notes and approved statement reviews created during subsequent testing are existing data to preserve, not disposable migration fixtures.

Recommended implementation model: **GPT-6.1 Sol High**. The work reuses established semantic processing while changing custody, evidence and persistence contracts. It needs careful source-to-output tracing and transactional tests, not a new summarisation prompt. The concrete first coding brief is in section 10.

## 1. Recommendation and scope

**Refactor the established Living Understanding process onto Vault, Subject and Perspective. Do not connect the new UI to legacy Contact storage, and do not replace rich understanding with the current six-suggestion note review.**

Existing capability -> semantic decomposition, coherent topic prose, immutable topic versions, aggregate revision snapshots, longitudinal impact classification, evidence checks, structural validation, bounded repair and approval already exist. Actual gap -> they remain coupled to `userId/contextSpaceId/contactId`; the Foundation path has versioned sources, evidence and statements but no equivalent topic/snapshot application. Minimum change -> extract the reusable semantic engine, give it authorised Foundation input packets and a Foundation writer, and adapt the existing notes/review experience. Preserve -> depth, qualifications, history, source attribution and privacy, including capabilities that are currently split across different legacy layers.

There is a real preservation risk. The old system is richer than the new note review, but the old system also loses some structured detail between proposals and authoritative topic persistence. This refactor should preserve demonstrated strengths **and close those known gaps**, rather than copying them. The ledger below is the acceptance contract; “nothing lost” must be demonstrated against it.

The user supplied a rich example containing eight topics, several areas of life, current/historical/mixed material, uncertainty and an explicitly unconfirmed passage. It is a quality reference, not a source transcript. This document deliberately does not copy its personal content. Use synthetic conversations of equivalent complexity for versioned fixtures. Do not fabricate quotations, source turn IDs or provenance for the supplied prose.

Initial product scope:

- The existing UI explicitly selects one private person. The server resolves the owner’s self Subject, selected person Subject and, when relevant, private relationship Subject.
- One conversation can update the owner's self-understanding, their view of the selected person, and their view of that relationship. These are separate subject/perspective streams using shared evidence, not three copies of a conversation.
- Use arbitrary subject-ID lists internally, stable speaker IDs and explicit unresolved mentions. Do not build open-conversation name resolution, automatic identity matching, new person creation from names, a multi-person picker, joint perspectives, sharing or cross-account analysis in this stage.
- Brokerage is a separate deployment and is not a requirement for the new LU model. Do not clean up its schema or historical code as a side effect.
- Retain a complete, speaker-labelled transcript separately from the independently editable summary. Both need clear provenance. The transcript must be available in a collapsed owner-only view after saving, including when summarisation succeeds.

## 2. What the code actually implements

Paths in this document are relative to the repository root. Function names are intended as search anchors. Schema declarations alone are not evidence that a route or service supports a capability.

### 2.1 Three distinct legacy layers

1. **Atomic claims and review events.** `src/lib/server/datingLivingUnderstanding.ts` creates immutable `PROPOSE` and `REVIEW` Interaction events. `createDatingUnderstanding`, `reviewDatingUnderstanding` and `appendUnderstandingReview` support pending proposals and confirmed/deferred/rejected decisions. Confirmed operator review writes `KnowledgeClaim` and `KnowledgeEvidence`; it deliberately remains `THIRD_PARTY_REPORTED`, with `LOW` confidence, rather than participant verification. `datingUnderstandingTopics.ts` links claims to realms/topics. `datingKnowledgeComparison.ts` records operator comparisons and explicitly acknowledged retirement.
2. **Semantic construction and diagnostic experiments.** `datingUnderstandingRevisionExperiment.ts` and the pure `datingUnderstandingRevisionPolicy.mjs` implement topic/area discovery, per-area coherent revisions, independently controllable operational units, temporal/meaning coverage audits and restructuring. Some functions remain read-only experiments. The initial authoritative workflow explicitly reuses these functions with `allowProductionInitial=true` and the newer `INITIAL` validation contract. It is incorrect to dismiss the whole file as unused experimental work.
3. **Authoritative rich topic snapshots.** `datingPersistedLivingUnderstanding.ts` writes immutable `LivingUnderstandingRevision`, topic identities, topic versions, revision membership and source links. `datingLongitudinalLivingUnderstanding.ts` loads that persisted baseline, assesses every existing topic, revises affected topics, validates the resulting snapshot and approves a new revision. This is the source of the rich prose and history shown in the older UI. Atomic claims are not the authoritative topic snapshot.

The initial path is complete in code: `core/phoneUnderstandingAutomation.ts::processPhoneUnderstanding` calls `identifySemanticAreasReadOnly` -> `consolidateSemanticAreasForRevision` -> `reviseSemanticAreaReadOnly` -> `restructureLivingUnderstandingReadOnly(..., 'INITIAL')` -> `createLivingUnderstandingAdoptionToken` -> `adoptLivingUnderstanding`. Manual initial routes reuse the same construction machinery. Subsequent sources use `reviewLivingUnderstandingImpact` and `persistLongitudinalLivingUnderstandingRevision`. Do not implement only the baseline-required update path and leave new accounts unable to create v1.

`core/automaticLivingUnderstanding.ts` prepares encrypted working drafts and exposes approval separately. `processPhoneUnderstanding` can subsequently approve automatically when that older phone workflow is enabled. Thus “all old LU always required a human click” is false. Equally, the old phone opt-in is not authorisation to auto-approve the new Foundation workflow. Start the new flow with explicit owner approval and record the approval mechanism independently; any future automatic policy is a separate decision.

### 2.2 Exact implemented taxonomy

| Layer/dimension | Exact values found | Meaning and limit |
| --- | --- | --- |
| `KnowledgeClaimKind` in Prisma | `FACT`, `OBJECTIVE`, `WANT`, `OFFER`, `PREFERENCE`, `CONSTRAINT`, `RELATIONSHIP_STATE`, `OTHER` | Content category. `FACT` does not prove objective truth. Dating extraction constants omit `RELATIONSHIP_STATE`; do not silently discard it in a general mapping. |
| `KnowledgeAuthority` | `LEGACY_UNSPECIFIED`, `SELF_DECLARED`, `THIRD_PARTY_REPORTED`, `WORKSPACE_RECORDED`, `PUBLIC_SOURCE`, `INFERRED`, `SYSTEM_DERIVED` | Mixed historical authority/origin distinctions. Preserve their meaning in explicit new dimensions, not a lossy one-to-one rename. |
| `KnowledgeSourceType` | `MANUAL`, `INTERACTION`, `PUBLIC_RESEARCH`, `AGENT`, `IMPORT`, `SYSTEM`, `OTHER` | Capture/evidence origin, separate from who is described. |
| `KnowledgePerspective` | `UNSPECIFIED_LEGACY`, `CONTACT_REPORTED`, `OWNER_OBSERVATION`, `RELATIONSHIP_PERSPECTIVE` | Implemented on atomic claims. Does not replace the Foundation Subject/Perspective separation. |
| Atomic claim state/confidence | `ACTIVE`, `SUPERSEDED`, `REJECTED`; `LOW`, `MEDIUM`, `HIGH` | Lifecycle and confidence are independent. |
| Dating proposal/review actors | `OPERATOR`, `DORIAN`, `PARTICIPANT` in the event type | Actual creation accepts operator/Dorian; actual review stamps `OPERATOR`. The type alone does not implement participant-authenticated review. |
| Review decisions | `CONFIRMED`, `DEFERRED`, `REJECTED`; pending is absence of a decision | Human acceptance is not authorship, factual verification or sharing consent. |
| Revision experiment certainty | `DIRECT`, `REPORTED`, `INFERRED`, `UNCERTAIN` | Implemented validation/proposal vocabulary, including operational units. Not a structured column on authoritative rich topic versions. |
| Atomic comparison relations | `INDEPENDENT`, `SUPPORTS`, `REFINES`, `POTENTIAL_CONFLICT`, `SUPERSEDES` | `datingKnowledgeComparisonPolicy.ts`; supersession needs explicit acknowledgement and chronology check. |
| Longitudinal topic effects | `UNCHANGED`, `REINFORCED`, `REFINED`, `EXPANDED`, `QUALIFIED`, `CONTRADICTED`, `SUPERSEDED` | Both policy and production engine implement these. Absence is not contradiction. |
| Operational-unit evolution | `UNCHANGED`, `REINFORCED`, `REFINED`, `POTENTIAL_CONFLICT`, `POTENTIAL_RETIREMENT` | Diagnostic/proposal layer. Potential retirement is not an automatic operational action. |
| Rich topic time | `CURRENT`, `HISTORICAL`, `MIXED` | Separate from creation time and source occurrence time. |
| Foundation perspectives | `OWNER_RECORDED`, `ATTRIBUTED_PERSON`, `AI_INTERPRETATION` | Prisma vocabulary and limited private service checks; joint/bridged perspective is not implemented. |
| Foundation statement mode/confidence | `DECLARED`, `OBSERVED`, `INFERRED`; `LOW`, `MEDIUM`, `HIGH` | Too coarse on its own to preserve all old distinctions. `DECLARED` requires matching speaker in the current service. |
| Foundation recorder/admission | `OWNER`, `VISITOR`, `SERVICE`; `STORED_ONLY`, `PRIVATE_ANALYSIS` | Recorder is not speaker, subject, prose author or approver. |
| Foundation support relation | `SUPPORTS`, `QUALIFIES`, `CONTRADICTS` | Schema supports segment or input-statement-version edges. Current statement reader accepts exactly one direct `SUPPORTS` segment. |

There is no literal `OPINION` value in the inspected LU claim, certainty or Foundation mode enums. The user's recollection is conceptually sound, but it must not be reported as an exact existing enum. Preserve opinion/impression semantics explicitly in the new representation and tests. Do not manufacture historic metadata for older records whose payload never recorded it.

### 2.3 Existing fidelity gaps to repair, not perpetuate

- Initial and longitudinal proposal objects contain evidence turn IDs, reasons, certainty in relevant extraction outputs, semantic boundaries and validation detail. `createLivingUnderstandingAdoptionToken` and the longitudinal `ApprovalPayload` reduce these to topic prose, labels, time, operation and source IDs. `LivingUnderstandingTopicVersion` has no structured epistemic class, authorship or evidence-turn fields.
- A changed longitudinal topic is persisted with the newly processed source in `sourceInteractionIds`; prior wording can be preserved without carrying its exact original support into the new version. Old snapshots retain earlier links, but the current topic's source links are not a complete clause-level cumulative evidence graph.
- `requireSourceReflection` can return persisted stable turns. Initial `buildTurnPacket` prefers those turns, but the longitudinal file reparses conversation text and generates new sequential IDs. The refactor must use stored source-version anchors consistently.
- Topic identity and immutable versions support topic evolution, and the UI exposes aggregate revision history. `listLivingUnderstandingRevisionHistory` returns the latest 20 revisions. Do not mistake that bounded list for a complete topic-specific, paginated history UI.
- The structural validator checks exact coverage of prior **topic prose** during restructuring. This is useful protection against losing prior meaning, but it is not proof that initial extraction captured every durable meaning in a raw conversation.
- Several production safeguards are prompt instructions plus shape checks. They are not deterministic proof of semantic truth. The gateway requests JSON objects and parses them; it does not provide an automatically enforced complete semantic schema. The new implementation needs actual runtime validation and tested failure behaviour.

### 2.4 Current Foundation flow

`foundation/evidence.ts` provides real versioned sources, exact UTF-16 excerpts, subject links, statements, source eligibility and transactional replay/version conflict protection. F-204 capability and lifecycle checks run through `policy.ts` and `internal.ts`. `readCurrentStatement` currently fails closed for every graph except one direct eligible `SUPPORTS` segment; `recordSupportedStatement` writes that same restricted shape. General derivation traversal, rich snapshots and graph invalidation are not implemented by the schema alone.

`foundation/noteReview.ts::proposeNoteReview` requests at most six statements with `bucket`, `text`, `quote`, `mode`. `reviewProposals` caps the list at six, text at 400 characters and each quote at 500 characters. `approveNoteReview` creates statements in an owner perspective, selecting self/person/relationship IDs, with confidence hard-coded to LOW for inferred and MEDIUM otherwise. Evidence segments are associated with the selected person, while the output statement can concern self or relationship. That minimal receipt is useful scaffolding, not rich LU.

The current Dorian people-note route verifies a server-issued conversation/agent/session/person binding. `integrations/elevenlabs/peopleWebNote.ts::speechFromDorianCall` parses the transcript, keeps only User turns and joins/truncates their text. `people/[id]/notes/dorian/+page.server.ts` summarises that speech. On success it returns the summary, and the page saves it through the ordinary note writer as `text`. Caller speech is displayed only as a summarisation-failure fallback. It does **not** save the full conversation through this path. Subsequent note review treats that saved summary as evidence. This drops Dorian questions, turn context and detail omitted from the summary before the LU assessment begins.

Ordinary voice notes already have a separate `text` and `summary` in `ContactNoteForm.svelte` and note provenance. Reuse their editing and retry behaviour, but do not treat the existing `reviewedSummary` provenance string as independently versioned presentation history.

## 3. Capability-preservation ledger

Every row needs named test evidence in the implementation PR. “Ported” means adapted to Foundation authority and persistence; it does not mean invoking Contact-based functions with synthetic legacy records.

| ID | Capability and current source evidence | Target requirement and comparison gate |
| --- | --- | --- |
| P01 | Full conversation, stable turns, capture metadata: `core/conversationIngestion.ts::buildConversationPayload`, `datingLivingUnderstanding.ts::requireSourceReflection`; `stage8-14-1-conversation-ingestion-foundation.test.mjs` | One encrypted Foundation source version retains all available turns, provider binding and occurrence time. No summary-only substitution or silent truncation. Source can support several subjects without copies. |
| P02 | Speaker/exact-evidence validation: `datingUnderstandingRevisionPolicy.mjs::resolveEvidence`, `validateTurnAnchoredRevisionDraft`; `stage8-12-13-5-revision-experiment.test.mjs`, `stage8-12-13-6-topic-aware-revision.test.mjs`; F-205 exact-offset cases | Persist exact version/turn/span, speaker and quote. Distinguish evidence from conversational context. Repeated identical quotes and Unicode offsets resolve to the intended turn, not first `indexOf` alone. |
| P03 | Coherent, rich semantic areas: `identifySemanticAreasReadOnly`, `reviseSemanticAreaReadOnly`, `consolidateSemanticAreasForRevision`; `stage8-12-13-7-semantic-decomposition.test.mjs` | Preserve all material durable meanings across narrow topics. No six-item output cap; no atomised bullet list replacing paragraphs. A phrase may inform several topics for different purposes. |
| P04 | Initial/full snapshot: `processPhoneUnderstanding`, `restructureLivingUnderstandingReadOnly(...,'INITIAL')`, `adoptLivingUnderstanding`; `stage8-14-0-initial-living-understanding-alignment.test.mjs` | Empty Foundation stream creates v1 with validated complete topic membership. Use INITIAL's legitimate-overlap policy. An existing baseline must enter update, not rebuild. |
| P05 | Longitudinal effects: `reviewLivingUnderstandingImpact`; `stage8-13-1-longitudinal-production-engine.test.mjs`, `stage8-12-13-9-core-validation-suite.test.mjs` | Account for every baseline identity; preserve unrelated topics; implement all seven effects. Explicit reversal differs from unresolved contradiction, added qualification and reinforcement. |
| P06 | Meaning coverage, purpose-based primary home, structural repair: `validateTopicRestructureDraft`, `restructureLivingUnderstandingReadOnly`; tests `stage8-12-13-9-1-*`, `stage8-12-13-9-2-*`, `stage8-14-0-*` | No silent omissions, strengthening, weakening or temporal shifts. Canonical retrieval anchor coexists with legitimate contextual representation. One bounded repair of validator failures, then fail closed. |
| P07 | Boundary/duplication audit: `auditLongitudinalTopicBoundaries`, `findExactCrossTopicSentenceDuplication`, `repairExactCrossTopicSentenceDuplication`; `stage8-13-3-3-semantic-overlap-repair.test.mjs` | Audit complete result, edit only changed/new topics. Preserve legitimate overlap; repair redundant wording. Revalidate final evidence and semantics after repair, not just duplicate-string removal. |
| P08 | Immutable topic and aggregate history: `persistLongitudinalLivingUnderstandingRevision`, `getLivingUnderstandingRevision`, schema membership composite FKs; `stage8-13-0-persistence-foundation.test.mjs` | Stable topic identity, immutable versions, ordered full snapshot, previous revision, changed-topic counts, and paginated topic/aggregate history. Unchanged topic keeps exact prior version ID. Reinforcement creates a new evidence-bearing version even if prose is unchanged. |
| P09 | Taxonomy, provenance, review: `datingLivingUnderstanding.ts`, `datingUnderstandingRevisionPolicy.mjs`, Prisma Knowledge enums | Preserve section 2 taxonomy semantics into persistent fields/typed metadata and evidence links. Human acceptance never changes model author into human author or owner report into John's declaration. Rich prose can aggregate differently typed elements. |
| P10 | Manual amendment/defer/reject/compare: `reviewDatingUnderstanding`, `compareDatingKnowledge`, `datingKnowledgeComparisonPolicy.ts`; `stage8-12-0-living-understanding.test.mjs`, `stage8-12-13-1-supersession-chronology.test.mjs` | Owner can correct a proposal and defer/reject it with history. Edits revalidate support. Retiring prior meaning is explicit; preserve prior versions. Do not silently turn an unsupported edit into transcript evidence. |
| P11 | Working checkpoints and inspection: `datingLivingUnderstandingDraft.ts`, `automaticLivingUnderstanding.ts`, review inbox/handoff services; `stage8-14-4-automatic-lu-proposal.test.mjs`, `stage8-14-5-3-history-disposition-sync.test.mjs` | Encrypted draft/checkpoint, baseline/source binding, inspectable stages, resume/retry, terminal no-change distinct from failure. Durable source processing outcome avoids reprocessing unchanged sources forever. |
| P12 | Stale/conflicting approval, replay, batched writes: persisted service, signed approval tokens; `stage8-13-2-1-living-understanding-save-timeout.test.mjs`; F-205 correction race | Server-owned candidate, exact version manifest, transaction-time authority recheck, idempotency before stale check, one winner for concurrent approvals, atomic rollback. No model call inside locked transaction. |
| P13 | Custody/admission: F-204 `policy.ts`/`internal.ts`, F-205 `segmentState`; `tests/foundation/f204-access.test.mjs`, `f204-boundaries.test.mjs`, `f205-evidence-cases.mjs` | Every request/job checks current owner/vault/epoch/lifecycle/operation. Source read, provider processing, authoritative write and disclosure remain separate. Names, subject lists and serialized job payloads grant nothing. |
| P14 | Correction/withdrawal/erasure: F-205 cases, `foundation/privacyOperations.ts`, `tests/foundation/p305-privacy.test.mjs` | Extend eligibility and erasure to new topics, snapshots, summaries, drafts and derivatives. Old evidence remains historical only while retained and authorised; deletion is not defeated by history or caches. |
| P15 | Private model execution/audit: `agents/modelGateway.ts::generateStructured`, `agents/sensitiveAudit.ts` | Reuse sensitive redaction and invocation metadata; add Foundation processing boundary, cancellation/timeout and schema validation. Persist useful encrypted run evidence without raw sensitive logs. |
| P16 | Authoritative prose versus operational knowledge: semantic decomposition's `operationalReasons`, older UI's derived matching/embeddings distinction | Topic prose is the approved readable understanding. Optional action/matching units and embeddings are version-bound derivatives. They cannot become permission or independent truth. Temporary “do not search now” remains interaction state, not an enduring personality fact. |
| P17 | Call completion/processing continuity: `core/phoneUnderstandingAutomation.ts`, `core/dorianVoiceCallLifecycle.ts`, phone queue/continuity tests | Channel adapters can later invoke the same engine. Keep completed/no-change/failed/not-required distinct and permit a next call after failure. Do not port old caller/Contact state as Foundation authority. |

## 4. Target representation and schema decisions

### 4.1 Keep the dimensions independent

| Dimension | Representation and example rule |
| --- | --- |
| Custody | Authenticated owner's private Vault. Never chosen by model output. |
| Subject | Stable person, relationship or group IDs. The initial stream has one primary Subject; individual evidence/statements may associate several subjects. |
| Perspective | Owner's account of that subject for this release. A model drafting the owner's account does not create `AI_INTERPRETATION` or John's own perspective. |
| Speaker | Source turn participant, e.g. owner, Dorian, known other human, unresolved speaker. Dorian is a speaker role, not a fabricated PERSON Subject. |
| Asserter / attributed source | Who advances the proposition, distinguished from the person currently speaking. In “John told me he prefers mornings”, the owner speaks and reports John as the original asserter; this does not verify that John said it. A Dorian hypothesis has Dorian as asserter even after owner approval. |
| Recorder/capture | Owner, visitor or service plus channel/provider. A service storing a turn did not utter it. |
| Text generation/author | Human-authored, model-drafted, or human-edited model draft, with exact model/prompt/pipeline version and edit provenance. |
| Content kind | Preserve FACT/WANT/OFFER/PREFERENCE/CONSTRAINT/OBJECTIVE/RELATIONSHIP_STATE/OTHER semantics. An opinion can concern any subject; it is not necessarily a model inference. |
| Epistemic basis | Directly expressed account, reported assertion, attributed opinion/impression, model inference, or unresolved attribution, with independent uncertainty qualifiers. Exact enum/column names are fixed in LUR-1. |
| Confirmation | Unreviewed, owner-approved, deferred, rejected or superseded; who acted, when, on which exact version and by what mechanism. Owner approval is not subject confirmation or external verification. |
| Time | Source occurrence, record creation, statement observation/validity and CURRENT/HISTORICAL/MIXED narrative scope. Unknown time stays unknown. |
| Model confidence | Explicit extraction/interpretation confidence, separate from certainty expressed by the speaker, identity assurance, permission and truth. Do not hard-code confidence from inferred versus observed mode. |
| Area/topic | Semantic organisation of information, independent of custody. Labels do not create grants or global identity. |

Examples for fixtures: “I feel overlooked” is a directly stated feeling, not an inferred feeling. “I think John is impatient” is the owner's expressed opinion; the model can be highly confident that the owner said it while John's actual disposition remains unverified. “John told me he prefers mornings” is an owner-reported statement attributed to John, not a recording of John's declaration. “I generally meet friends every three weeks” belongs to self; “I want more time with John” belongs to the specific relationship from the owner's perspective. “Dorian suggested I felt overlooked; I said that was exactly right” needs both the prompt and affirmation as dependencies, with the human affirmation supplying endorsement. Silence, “maybe”, or a generic acknowledgement cannot be promoted to that endorsement.

Persist these distinctions concretely: each meaning version identifies its speaker/evidence, asserter or attributed-source reference and epistemic basis; its creation provenance identifies the generator/model invocation and recorder; a separate version-bound review event identifies the approver and decision. Model paraphrasing of an explicit human assertion retains that human assertion's epistemic basis and owner perspective. Clicking “approve” on a Dorian hypothesis preserves its inference basis and original asserter. If the human later explicitly adopts the proposition as their own declaration, record that as new human evidence and a successor assertion, not a retroactive metadata change. The current release must not generate a separate Dorian-perspective hypothesis unless that scope is explicitly enabled.

A rich topic paragraph can contain several differently typed elements. Do not force the entire paragraph into one FACT/OPINION/INFERRED label, or require every prose sentence to become a separately actionable claim. Persist sufficiently granular meaning/support records to retain distinctions and allow correction, while keeping readable coherent prose as the primary experience.

### 4.2 Recommended physical direction

Use existing Foundation sources, segments, statements, perspectives and custody guards. Add the missing topic/snapshot structures; do not make the old `LivingUnderstanding*` tables nullable and reinterpret Contact IDs as Subject IDs. The recommended shape below is an implementation design, not an implemented schema. LUR-1 must resolve final names and columns before LUR-2's migration.

| Record | Purpose and recommended constraints |
| --- | --- |
| Existing `FoundationSource` / immutable `FoundationSourceVersion` | Authoritative conversation envelope, using `IMPORTED_CONVERSATION`, or typed note text. Persist complete turns and a format version in encrypted payload, immutable content MAC and trusted capture binding. Encrypted envelope may hold stable turn/speaker maps, timestamps and unresolved mentions without new public plaintext identifiers. No new transcript table is necessary merely to store turns. |
| Existing `FoundationEvidenceSegment` / `FoundationEvidenceSubject` | Exact source version + turn ID + encoded span/quote. Anchor envelope can be extended with turn ID and participant role. Known human speakerSubjectId remains typed; unresolved/agent roles must not be fabricated humans. Validate and preserve both evidence subjects and contextual dependencies. |
| Existing `FoundationStatement` / `FoundationStatementVersion` / subjects/support | Persistent typed meaning records that support prose and optional operational units. Extend classification/provenance so uncertainty, reported source, authorship and review do not disappear at approval. Preserve exact supporting versions and multiple evidence dependencies. Do not copy or silently reclassify old enums. |
| New understanding stream/root | Unique private `(vault, primarySubject, perspective)` home with stable ID; area/context is not part of custody. Composite owner/vault/subject/perspective FKs. Additional subject associations remain supported at evidence/meaning level. |
| New topic identity and immutable topic version | Stable ID within stream; encrypted area/topic labels, prose, temporal scope, effect, version number, creation revision, explicit predecessor/lineage. A label is display/semantic metadata, never sole identity. Versions link to exact meaning versions through a typed membership relation. |
| New aggregate revision and membership | Immutable ordered full snapshot pointing to exact topic identities and versions; previous revision, revision number, approval event, run/candidate ID and idempotency key. Match topic/version/stream/vault through composite constraints. Revision-causing source-version links are distinct from all supporting evidence carried by topics. |
| New topic-version meaning membership | Link rich topic to exact statement/meaning versions and their role, including canonical semantic home versus contextual relevance. This is one understanding model with prose and support layers, not a second independently editable truth store. Retained meaning keeps original support in v2. |
| Independent source summary/presentation versions | Encrypted display summary, exact input source version, author/generator/edit history, expected-version/replay key. Editing only this presentation must not create a transcript successor or invalidate transcript-anchored evidence. Recommended small separate presentation/version record, not an overwritable provenance string. |
| Candidate/run and source-processing receipt | Encrypted proposed results, schema/prompt/pipeline/model versions, stage outcomes, exact input and baseline manifest, approval/disposition history, expiry and attempts. A single run can propose several streams and identify no-change results. Reuse draft patterns, replacing their Contact-bound persistence. |

Required migration work: new topic/snapshot memberships and their custody constraints; independent durable summary history; persistent candidate/approval/run binding if no existing Foundation-safe record satisfies it. The selected normalized classification/review columns or child records may also require a migration. **The full refactor is not a zero-migration feature.** Existing `provenanceEnc` can carry versioned descriptive metadata such as model/prompt identifiers, but core references, version relationships and lifecycle authority must not rely on unchecked JSON IDs.

Decisions to close in LUR-1, without changing the product contract:

1. Exact classification and review schema: preserve Foundation mode for compatibility while introducing orthogonal epistemic basis, expressed uncertainty and creation/review provenance. Use explicit unknowns rather than a false default. Do not treat rich prose as one single-mode statement.
2. Summary presentation/version tables versus a rigorously typed equivalent within the existing graph. Stored-only summary display cannot depend on granting PRIVATE_ANALYSIS or exposing general statement authority. Prefer independent presentation records for this reason.
3. Stream/topic/revision relational names and which metadata remains encrypted JSON. Require enforceable same-vault, same-stream, same-topic/version constraints and version uniqueness.
4. Evidence context roles and multi-input eligibility. Existing `FoundationSupport` is a useful base but does not distinguish affirmative evidence from prompt/context dependencies. Add a typed edge role if needed; do not misuse `SUPPORTS` to mean an agent assertion proves a human belief.
5. Atomic commit scope for a combined review. Recommendation: commit all owner-selected topic changes across affected streams in one transaction after validating every baseline, with unselected items recorded as deferred. Fail all on stale input; no partially applied multi-stream review.

Do not reopen these as speculative product questions. Sol should propose and implement the smallest enforceable schema meeting the contract, documenting the final choice and migration impact in its PR.

## 5. One processing pipeline

The earlier conversational suggestion of “read once, then three passes” is not an established implementation requirement. Preserve logical stages and evidence fidelity; do not promise a literal number of model calls. Each conversation may concern zero, one or several authorised subject/perspective streams.

1. **Capture and authorise.** A channel adapter verifies server-issued conversation ownership, completion and participant binding. Save the complete encrypted immutable source, or an explicitly incomplete source with visible status if the provider lacks turns. Reject over-limit input before analysis or use designed chunking with an exhaustive coverage manifest. Never silently slice material and report a complete assessment.
2. **Prepare an evidence packet.** Resolve the owner, selected person and permitted relationship IDs server-side. Preserve stable turns, speaker roles, exact spans, occurrence time, attribution confidence and unresolved mentions. Dorian turns provide context; they do not automatically become human evidence. Do not infer that an unknown name is the selected person. No global identity lookup.
3. **Extract durable meaning and route it.** Adapt semantic decomposition to emit typed meanings, source dependencies and authorised subject/perspective destinations. Record durable meanings not included in a proposal with an explicit reason, so a hard result cap cannot silently drop them. Temporary conversational instructions stay separate. Validate references before further model work. A shared source or meaning may support several coherent topics without duplicating the underlying source.
4. **Create or update each stream.** For an empty stream, use the proven initial construction and INITIAL structural audit. For an existing stream, load the authoritative snapshot server-side and classify every identity. Revise only affected topics, preserve unchanged version IDs, retain earlier valid meaning/support, and create new topics only for genuinely new enduring areas. One stream may be initial while another already has a baseline.
5. **Validate and repair.** Apply deterministic schema/ID/span/speaker/custody/coverage checks, then bounded semantic/boundary audit over the complete candidate. Carry uncertainty and temporal roles; distinguish legitimate overlap from duplication. One validator-guided repair per defined stage is allowed. Record pre/post candidates and failures. Re-run the applicable validators after repair. No recursive “try until accepted”, no quiet downgrades to a summary or a smaller topic set.
6. **Review.** Save an encrypted candidate with exact input and baseline versions. Present readable changes grouped by subject and area, uncertainty and supporting evidence. Owner can approve selected changes, defer/reject, or edit. Editing creates a new validated candidate; an unsupported addition becomes a separately authored owner annotation/source if deliberately saved, not invented transcript evidence. Generated prose remains model-drafted after approval.
7. **Commit.** Re-resolve current authority and check source/subject/perspective eligibility, epoch, source versions and baseline manifest in the transaction. Check replay before stale-base detection. Append meaning/topic versions, full snapshot memberships and approval/processing receipts atomically. Preserve inherited evidence for unchanged portions. No model/provider calls while holding locks.
8. **Read and derive.** Current display/retrieval checks current support eligibility before revealing prose or counts. Expose topic and aggregate history and links to exact evidence through explicit owner/source operations. Only then derive embeddings, matching or next-call projections from approved eligible versions. Persist derived version/pipeline bindings and invalidate them after source/permission changes.

Proposed module boundaries under `src/lib/server/foundation/`: authorised source preparation, understanding repository, orchestration and review service. Put reusable pure types/validators and provider-independent semantic operations in a shared LU module. Final filenames can follow repository conventions. This is an internal boundary refactor, not a generic plugin framework or a second service.

| Existing code to reuse | Required adaptation |
| --- | --- |
| `datingUnderstandingRevisionPolicy.mjs` pure validators | Extract without behavioural drift; preserve tests and INITIAL semantics. Replace target-speaker-only assumptions with explicit evidence roles, while preserving the rejection of unsupported attribution. |
| `identifySemanticAreasReadOnly`, `reviseSemanticAreaReadOnly`, restructuring prompts | Accept authorised packets and inventories rather than fetching Contact/ContextSpace. Keep rich prose and coverage contracts, persist typed meaning output. |
| `reviewLivingUnderstandingImpact` and boundary repair logic | Accept Foundation baseline; use stable source turns; preserve original per-meaning support and all effects. Fix dropped turn/provenance data. |
| `datingPersistedLivingUnderstanding.ts` | Port transaction algorithm, membership carry-forward, batched writes and replay semantics. Replace table access, AAD and authority entirely with Foundation services. Do not call its writer. |
| `datingLivingUnderstandingDraft.ts`, `automaticLivingUnderstanding.ts` | Reuse stage/checkpoint/resume patterns with Foundation run/candidate bindings and approval provenance. Automatic preparation never silently grants automatic approval. |
| Foundation `evidence.ts`, `policy.ts`, `internal.ts` | Extend the narrow service contracts and operation allowlists; preserve lifecycle locking, row-bound encryption and segment-only restrictions. Multi-input traversal is a new implemented capability requiring tests. |
| `modelGateway.ts` and sensitive audit | Retain provider and redaction machinery; use a Foundation-authorised processor, strict output validation and explicit timeout/cancellation. Re-authorise before send and before accepting/persisting result. |
| Existing Dorian page, note recorder and review page | Retain capture/retry/session/origin protections; use saved source IDs plus separate summary, then the new LU candidate. Replace six-suggestion logic at cutover; do not expose competing writers. |

## 6. Transcript, summary, correction and privacy semantics

The server stores the transcript; the browser submits an owned source ID/version plus the summary edit. It must not be able to swap a hidden transcript, source, subject or conversation binding. The full transcript is encrypted and retrieved by an explicit owner-authorised operation, with collapsed “Conversation transcript” display showing both human and Dorian turns. A segment-only or future disclosed projection never authorises parent transcript access.

Existing Foundation notes/reviews must continue to load with their original source type, versions, approval receipts and support. A saved Dorian-generated summary from the current flow is a note source; it is not an original transcript. Do not invent turns or claim verbatim conversation provenance during migration. Recover an original transcript only through a still-verifiable provider conversation binding, permitted retrieval and actual retained provider data; otherwise show that only the saved note is available. Reprocessing an old note requires current permission and new versioned results, never silently overwrites its existing approved statements. A retrospective import/conversion job is not required to deliver the new flow and must not run automatically.

| Action | Source, summary and LU outcome |
| --- | --- |
| Save a completed conversation | Retain complete captured transcript once, its speaker/provenance map and the separate generated/edited summary. Default stored-source admission stays explicit. Existing consent to transient summarisation does not imply future LU processing. |
| Edit summary only | Append a presentation version; original transcript and its anchors are unchanged. Transcript-supported statements/topics remain eligible. Pending proposals based solely on transcript need not become stale because display text changed. A summary-derived output must track its summary-version dependency and be reassessed. |
| Add an owner interpretation in the summary | Preserve as owner-authored addition to a model draft. It is not retroactively something said in the call. If used as evidence, explicitly capture/admit it as a distinct owner annotation with its own support and provenance. |
| Correct transcript/speaker attribution | Append a new source version; old anchors retain their historic location. Reject pending candidates on old input. Suppress affected current derivations pending reassessment, and create successor understanding from corrected evidence. Never relocate old anchors silently. |
| Later conversation changes circumstances | New evidence changes current understanding through a new revision. Do not rewrite the original conversation or mark the historic statement as never true. |
| Withdraw analysis admission or disable source | Stop new affected processing and current LU/derived use. Recheck at job send, result acceptance, commit and retrieval. Being in an old snapshot does not bypass withdrawal. Already transmitted provider data cannot be recalled by a local state change. |
| Archive subject / suspend vault | Enforce existing lifecycle restrictions across old and new outputs, drafts and history reads. A summary, cache, count or evidence link must not become an alternate access path. |
| Erase source/vault content | Extend the existing reviewed erasure path and dependency order to new tables, caches, indexes and encrypted drafts. History must not retain usable deleted prose by default. Any retained non-content audit receipt needs a defined minimal retention purpose. Do not invent a new retention duration. |

For v1, fail closed on a topic whose current meaning depends on ineligible input. Do not simply hide a citation while showing its derived prose. If another independent source can support the conclusion, reassess and create a new eligible derivation rather than silently deleting a support edge. Unaffected topics can remain available; historical snapshot UI must distinguish “as saved” from “eligible now” and avoid disclosing withdrawn/erased text.

The old F-205 rule that only the latest source version supports current understanding is intentionally conservative. Keep it until the new source/version contract has tested semantics for admission changes versus content corrections. Independent summary records prevent summary-only edits from unnecessarily triggering that rule. Do not weaken it globally to make LU history work.

Persist dependency relationships before introducing background work. For the initial synchronous Foundation flow, transaction-time checks plus eligibility-on-read can fail closed; asynchronous invalidation of drafts/indexes needs a durable job/outbox and retries before those derivatives are enabled. Provider retention, backups and whole-account closure remain covered by their existing operational policies, not an implied guarantee from source deletion.

No Dorian hypothesis, other person's attributed view, joint acknowledgement, bridged perspective or sharing grant is authorised by this refactor. Preserve the ability to represent future perspectives without activating their access paths.

## 7. Acceptance fixtures and quality gates

### A. Rich initial understanding

Create a synthetic full multi-turn conversation of equivalent complexity to the supplied example. Use invented people and facts. Include eight durable areas across at least four realms, with complete coherent paragraphs and explicit CURRENT, HISTORICAL and MIXED cases. Include a directly stated feeling, expressed opinion, reported assertion, desire, uncertainty, historical pattern and one unconfirmed interpretation. Include an agent suggestion the owner does not endorse and another the owner clearly affirms in the next turn. Add greetings and temporary instructions that must not become enduring person knowledge.

Expected assertions, not exact prose snapshots:

- All eight intended meanings have a suitable topic home; no six-item ceiling, unexplained omissions or giant catch-all topic.
- Preserve nuance within paragraphs, independent temporal roles and uncertainty; do not remove an “unconfirmed” state merely because the owner approved displaying the paragraph.
- Subjects and perspectives are correct. Owner-general preferences go to self, opinions about the selected person remain owner perspective, and specific relationship hopes go to the relationship stream. No implied reciprocity.
- Every material meaning can be traced to exact source version, turn/span and speaker, plus required context dependencies. Save/reload retains classification, authorship, time, confirmation and confidence distinctions.
- Initial snapshot membership is complete and immutable. Human approval is recorded separately from model drafting. Full transcript can be opened from the saved evidence view.

### B. Second conversation and longitudinal history

Build a second synthetic conversation that reinforces one existing meaning, refines another, expands a third, qualifies a fourth, explicitly supersedes a prior current preference and introduces an unresolved contradiction elsewhere. Leave at least one original topic unaddressed and introduce one genuinely new area. The fixture can split these cases across the eight original topics and the different streams.

Assert that every baseline topic is accounted for, unchanged topic version IDs are byte-for-byte carried forward, reinforcement has new evidence without pretending the old version knew it, and unaffected meaning/support within changed topics survives. Assert current versus historical distinctions, preserved unresolved conflict, complete v1/v2 snapshot inspection and topic history. A no-material-change third source produces a durable NO_CHANGE outcome and no empty revision. Out-of-order occurrence dates must not silently supersede a newer belief merely because an older conversation was imported later.

### C. Source/presentation and security cases

- Edit only the summary; transcript bytes/MAC/anchors and transcript-based eligibility remain unchanged. Edit the transcript; old evidence becomes historical and affected current output is withheld pending reassessment.
- Two repeated quotes, surrogate pairs, multiline turns, pronouns depending on a question, reported speech and unknown names resolve safely. Invalid/missing turn, forged subject, cross-vault segment and unrecognised perspective fail closed.
- “I feel anxious” remains an explicit experience; “Dorian suspects anxiety” remains a model inference only if that separate scope is authorised, otherwise is not persisted as a human claim.
- OpenAI paraphrases an explicit human claim: save/reload shows model-generated prose, human asserter, source speaker and original direct/reported basis, with owner perspective unchanged. Owner approval of a separately authorised Dorian hypothesis leaves Dorian asserter and INFERRED basis intact; it never becomes SELF_DECLARED merely from the approval click.
- Existing saved Foundation note summaries and their approved statements survive the refactor. A note without a transcript cannot display fabricated turn evidence; unavailable provider recovery is a clear provenance limitation, not a reason to discard the note.
- Model injection in transcript is treated as data. Invalid JSON, missing topics, unsupported quotes, invented subjects, excessive result counts, timeout and failed bounded repair create no authoritative revision.
- Revoke/disable/archive/suspend during generation, between generation and approval, and during a queued retry. A stale handle or stored job payload grants nothing. No current prose, counts, embeddings or next-call text may leak the now-ineligible material.
- Double-submit returns one receipt; two competing approvals have one winner; a forced persistence failure leaves no partial sources/meanings/revisions. Test competing source correction and stale baseline separately.
- Erasure handles every new table and derived store; retry and restore rehearsal preserve restrictions. History inspection never restores deleted content.

### D. Comparison methodology

Pin synthetic input packets, baseline structures, model/prompt/pipeline versions and the preservation ledger. Run deterministic validators and service/persistence integration tests first. Compare old semantic processing with extracted processing on identical packets before replacing callers; compare the final Foundation implementation against the same labelled expectations.

Use stubbed model responses for deterministic failure and persistence cases. A local static source-text assertion is not a model-quality evaluation. Before activation, perform a controlled DEV model replay on synthetic conversations and human review of meaning coverage, prose coherence, attribution, temporal fidelity and evidence. Record omissions and disagreements individually. There must be zero unexplained durable-meaning losses, attribution promotions or permission leaks. Do not compare wording byte-for-byte or treat the old output as infallible ground truth.

Keep the old semantic implementation and tests available until extraction and end-to-end parity gates pass. This does not require dual-writing live data, shadow Contacts, production transcripts or production access. If an old behaviour is intentionally improved, document its failing case and replacement expectation in the ledger rather than quietly weakening its tests.

## 8. Baseline validation performed for this assessment

Ran the following local, offline command against the inspected commit:

```sh
# Existing deterministic policy tests and source-level contract checks only.
node --test \
  tests/core/stage8-12-13-9-core-validation-suite.test.mjs \
  tests/core/stage8-12-13-9-1-temporal-semantic-ownership.test.mjs \
  tests/core/stage8-12-13-9-2-meaning-coverage-semantic-identity.test.mjs \
  tests/core/stage8-12-13-9-2-1-validation-closure.test.mjs \
  tests/core/stage8-12-13-9-2-2-primary-home-completion.test.mjs \
  tests/core/stage8-13-1-longitudinal-production-engine.test.mjs \
  tests/core/stage8-13-3-3-semantic-overlap-repair.test.mjs \
  tests/core/stage8-14-0-initial-living-understanding-alignment.test.mjs \
  tests/core/stage8-13-0-persistence-foundation.test.mjs
```

Result: **53 tests, 51 passed, 2 failed**. Both failures are existing exact UI-copy assertions at this baseline:

1. `stage8-13-1-longitudinal-production-engine.test.mjs`: “UI exposes production impact review...” expects `/Affected topics/`, which the current stage-based page does not contain in that form.
2. `stage8-13-3-3-semantic-overlap-repair.test.mjs`: “impact review explains...” expects `/Shared meaning may legitimately inform more than one topic/`, absent from the current wording.

The pure policy cases exercised semantic contracts with synthetic structured outputs. Source-level tests inspect strings and schema/code shape; they do not execute transactions or prove model output quality. The two failures were not introduced by this documentation. No full application build, Foundation database integration suite, live model replay, provider call, DEV/PROD database read, migration rehearsal or deployment was performed for this assessment. Those remain implementation acceptance gates.

## 9. Delivery slices and release/rollback contract

All slices start from the latest actual remote `development`, follow AGENTS.md, and update the preservation ledger, living status and foundation stage register. Their initial status is **planned, not implemented or deployed**. Each PR must state exact tests, outstanding gates, migration implications and which routes can use the new writer.

| Slice | Complete deliverable | Required acceptance before the next slice | Migration and rollback |
| --- | --- | --- | --- |
| LUR-1: contracts and semantic extraction | Extract reusable pure validators/types and an authorised packet interface while existing callers retain behaviour. Add synthetic fixture specifications and taxonomy mappings; settle section 4 schema decisions in a reviewed physical contract. | Existing semantic tests pass or pre-existing failures are explicitly isolated; old/extracted deterministic results match; classification/attribution fixtures pass. Inventory every caller/import. No new LU route or writer activated. | No migration if limited to contracts/extraction. Ordinary code rollback is safe; no data changes. |
| LUR-2: durable source and understanding repository | Add reviewed Foundation schema and guarded services for full transcript, independent summary versions, typed meaning/support, topic/snapshot history and candidates. Integrate privacy/eligibility and atomic writes. Include minimal existing-page transcript/summary save/reload integration. | Isolated PostgreSQL constraints/concurrency, same-vault guard tests, exact anchors, summary-only edit independence, multi-input support, source withdrawal and erasure; complete v1/v2 persistence from stubbed validated candidates. | **Migration required.** Additive only; no legacy data rewrite. Before writes code can roll back. After writes disable affected writers, preserve new tables/read/privacy guards, then roll forward. No destructive down migration. |
| LUR-3: full semantic engine on Foundation | Implement one orchestrator for empty and existing streams using extracted decomposition, topic construction, impact analysis, validation/repair and authorised model calls. Persist full provenance and outcomes. | All A/B/C deterministic engine cases; inherited support and every effect; no-change receipt; candidate resume; stale/revoked result rejection. Controlled synthetic model replay compares old/new quality before exposing approval. | Use LUR-2 schema unless reviewed gaps justify a new migration. Rollback disables preparation/approval; saved source and summary remain usable. No fallback to summary-only or legacy Contact LU. |
| LUR-4: complete private review and history experience | Replace the minimal six-proposal review for the enabled Foundation flow; adapt existing person/note screens for grouped rich proposals, selected approval/defer/reject/edit, current paragraphs, topic history, revision history and evidence navigation. | Browser tests from conversation save to v1 and second-conversation v2, full transcript collapsed on success, owner edits, retry preservation, unauthorised reads denied, usability and synthetic prose review. Preserve manual notes/recording/retrieval. | Prefer no schema change; document any necessary gap. Feature availability rollback stops new LU writes while preserving notes, transcript and eligible history. |
| LUR-5: integration and activation gate | Route the explicitly enabled Dorian people-note flow through saved full sources and the shared pipeline; verify next-call/derived consumers use only eligible approved versions. Complete operational recovery and comparison evidence. | End-to-end DEV acceptance, privacy/restore/erasure rehearsal, timeout/retry/concurrency evidence, all P01-P17 dispositioned, no unexplained regression. Remove/retire replaced Foundation six-suggestion writer only after parity. Telephone integration uses the same application contract when separately activated. | No production migration/deployment implied. Record actual deployed commits and gates separately. Disable new processing/read-derived integration safely; never switch enrolled accounts to legacy writers. |

The final slice is not permission to build future multi-person identity resolution, automatic matching, disclosure, a shared relationship narrative, or a new telephone infrastructure. Reuse the channel's existing completion and binding logic when it is brought into scope. Keep source completeness, privacy and a usable note experience even if LU generation fails.

No migration execution, production release or provider configuration change is authorised by this plan. Implementation PRs must include local migration instructions only when they introduce a migration. Do not prescribe a production reset or data-copy exercise. Read-only deployment evidence and separately authorised rollout can be recorded later without implying that a merge is deployment.

## 10. Sol 6.1 task briefs

### First coding task: LUR-1

**GPT-6.1 Sol High:** Read AGENTS.md, START_HERE.md, this assessment and the latest relevant living documents on the newest remote `development`. Create a fresh feature branch. Implement LUR-1 only: extract the proven deterministic LU contracts/validators into a reusable module without changing current caller behaviour; introduce a provider-independent typed source packet and candidate schema that separates subject, perspective, speaker, recorder, generator, epistemic basis, uncertainty, review, time and confidence. Do not create Foundation authoritative writes yet.

Inspect the initial and longitudinal paths named in section 2, including the INITIAL overlap contract. Add synthetic fixture specifications and deterministic tests covering section 7 and a complete mapping of the exact existing taxonomy. Do not copy the user's attachment into fixtures. Specify the minimal relational additions and exact changes to Foundation guards/privacy services needed by LUR-2, closing the five decisions in section 4.2. Comment non-obvious code and security decisions.

Deliver comparison results for old/extracted validators, caller inventory, fixture coverage and the final schema contract. The 51/53 baseline and two UI-copy failures are known starting evidence, not permission to ignore new failures or weaken tests. No live model, production data or provider changes are required. Commit/push the implementation and docs and open a PR to `development` under the standing workflow; do not merge or deploy.

### Subsequent bounded briefs

- **LUR-2, GPT-6.1 Sol High:** Implement only the reviewed physical contract and Foundation repositories, transcript/summary save/reload, guard/eligibility extensions and privacy handling. Use stubbed candidates to prove immutable v1/v2 snapshots, inherited support, replay and concurrent conflict. Rehearse the additive migration in an isolated database. Do not route model results into authoritative LU until the remaining gates exist.
- **LUR-3, GPT-6.1 Sol High:** Adapt established semantic logic to the authorised packet/repository interfaces. Build both initial and longitudinal branches and persist all semantic/evidence/provenance metadata through save/reload. Implement bounded repair, strict failure/no-change outcomes and re-authorisation. Compare synthetic old/new processing before replacing any caller. Record actual model replay evidence if authorised and available; otherwise leave activation blocked.
- **LUR-4, GPT-6.1 Sol High:** Reuse the existing notes/review surfaces to show rich changes and complete source/history detail. Preserve explicit owner control and independently editable summary. Validate edited proposals and keep their origin. Prove two-conversation end-to-end persistence and browser recovery on failure. Do not add separate competing LU pages/writers without a demonstrated gap.
- **LUR-5, GPT-6.1 Sol High:** Verify all preservation rows and channel/derived integration against exact deployed DEV code, complete recovery/privacy acceptance and prepare a concrete release review. No rollout is complete because tests pass locally or a branch is merged. Keep production execution separate and record the actual environment status.

## 11. Completion definition

The refactor is complete when a new Foundation user can save a full private conversation, independently edit its summary, obtain rich source-backed initial understanding in the correct subject/perspective streams, approve it, and later evolve it without losing untouched meaning, evidence, uncertainty or history. Every meaningful part must retain its provenance after save/reload. Retrieval, historical views and derived consumers must respect current eligibility. The preservation ledger and two-conversation synthetic acceptance must demonstrate that outcome before the minimal reviewer is retired or new processing is activated beyond its verified environment.
