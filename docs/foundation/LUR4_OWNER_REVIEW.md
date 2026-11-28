# LUR-4 Private Living Understanding review

Implemented on `feature/lu-owner-review` from Development `992a8121`. This stage connects [LUR-3](LUR3_SEMANTIC_ASSESSMENT.md) to the existing private My People review screen. It uses the Foundation vault, subject, perspective, conversation and evidence records. No Prisma migration is required.

## Review a saved Dorian conversation

From My People, open a person, select a saved Dorian conversation and choose **Review conversation for Living Understanding**.

- The editable conversation summary and complete speaker-labelled transcript remain separate. Both start collapsed in review.
- **Analyse conversation** admits the exact saved transcript version for private analysis and explicitly sends that transcript and relevant eligible prior understanding to OpenAI. The assessment drafts private updates under **Me**, **My view of this person**, and **My view of our relationship**. Each topic shows its area of life, time scope, kind of change, and available prior wording. Evidence distinguishes owner support from Dorian's context.
- **Edit wording** keeps the topic's original meanings and evidence. **Validate edit** sends the revised wording and its context to the same model gateway for an independent audit. Successful edits retain the owner and audit provenance and still require approval. If validation fails, the form returns the owner's wording for revision or copying.
- **Approve selected** writes only the chosen topic updates. Other proposals are deferred. **Defer review** and **Reject suggestions** record a disposition without writing a revision. To revisit deferred suggestions, analyse the saved conversation again against the current understanding. Candidates are private, expiring drafts.
- **Saved Living Understanding** shows eligible current topic paragraphs across the three subjects. Earlier wording and previous revision links navigate stored snapshots. Evidence links show exact excerpts and link back to the source conversation. Withdrawal of a dependency removes the affected topic from eligible history.

Manual notes still use their existing review. Editing a Dorian summary remains a separate presentation change. The stage adds no channel routing, automatic approval, sharing or next-call retrieval.

## DEV acceptance and rollback

The review inherits the existing authenticated owner and canonical DEV-origin checks. Set `RELISH_FOUNDATION_LU_REVIEW=YES` on an isolated Development deployment to enable the conversation review entry and its write actions. It uses the existing `DATING_REVISION_MODEL` and OpenAI gateway configuration. No Railway settings are changed by this branch. Remove the flag to stop analysis, edits and approvals. Existing eligible history remains readable at its review URL for the same authorised DEV owner. The saved transcript and summary remain in My People.

For hosted acceptance, use synthetic conversations about the same person. In the first, describe a general preference, a view of that person and a relationship-specific wish. Approve a subset and compare each saved topic with its evidence. In the second, qualify the preference while retaining its unaffected meaning. Check both revisions, an owner wording edit and the transcript link. Use a second account to confirm the first account's URLs remain private.

## Subject and attribution

| Review group | What it describes | Example |
| --- | --- | --- |
| Me | The owner's preferences, experiences or goals beyond this specific relationship | “I prefer catching up one-to-one.” |
| My view of this person | What the owner observes, believes or reports about the person | “John told me he prefers quiet cafés.” |
| My view of our relationship | What happens between the two people, or wishes and boundaries specific to that pair | “I'd like John and me to catch up monthly.” |

A relationship wish may be the owner's own wish or something the owner reports John said. It remains attributed to whoever expressed it. A question or suggestion from Dorian provides context. It does not establish that either person holds that view.

## Diagnosing an analysis failure

DEV reached the review page and logged `decompose / INVALID_QUOTE` after the bounded repair. The assessor can now request a whole turn by ID and Relish copies the immutable text directly. Short excerpts must still match exactly in the cited turn. Repeated excerpts require an exact local offset. The evidence and attribution audit runs on the resolved text.

A later DEV retry reached the audit and returned `audit / BAD_SUBJECT`. The assessor now gives composition the destination map and can pass validated audit findings about specific misrouted meanings into the bounded retry. The retry grounds and audits the new proposal again before it can be shown. Audit findings are transient.

Search DEV application logs for the page reference or `relish.lu.review`. The structured record includes the configured model and prompt version, stage timings and outcomes, audit issue codes and the reason for any repair. It excludes transcript text, prompts, model responses and source identifiers.

A hosted retry logged `decompose / MODEL_TIMEOUT`, followed by `audit / MISATTRIBUTION` on the next submission. A later DEV trace showed GPT-6 Luna extraction reached the previous 45-second application deadline at 45.1 seconds. Extraction now has 90 seconds per call. Composition, audit and wording validation retain 45 seconds per call. Analysis model calls share a four-minute deadline across the initial attempt and any repair. A timeout leaves the saved conversation available to retry. Assessment and repair distinguish the topic's subject from the person who made the claim. For example, a wish about how often two people meet belongs to the relationship. A wish reported by the owner remains attributed to the person who expressed it. The audit can give the bounded retry an attribution issue tied to a specific draft claim.

If a terminal audit identifies a disputed claim, the authenticated DEV owner can expand **Why these suggestions were held** directly on the failed review. The panel shows a bounded set of disputed claims and cited excerpts. Full turns remain in the saved transcript above. The panel is included in the no-store action response and can be recovered from the failed review receipt after a reload. Failed receipts cannot be approved. Retry the same saved conversation after deployment to verify this case.

A later DEV analysis repaired its quote citations and then hit `UNSUPPORTED_PROSE` in the audit. A prose-only finding now gets one wording repair using the grounded extraction. The repair keeps the same evidence, destinations and topic dispositions, then runs the complete audit again. If the audit identifies specific paragraphs, the owner can inspect those findings on a terminal failure. The existing four-minute model deadline covers both repairs.

A subsequent DEV replay repaired an invalid citation, then rejected composition because topic paragraphs linked meanings assigned to other subjects. The same passage may support distinct meanings under different subjects. Each meaning has its own primary topic, and contextual links stay within its subject and perspective. When composition attaches a meaning to the wrong destination, one bounded repair keeps the validated extraction and revises only affected paragraphs and their meaning links. It preserves valid links and all topic dispositions. The full candidate must pass validation and the complete audit before review. The private steps show the affected topic, offending link and repaired composition. Application logs retain the stage and reason code only.

The v6 replay showed that regenerating extraction after an unmatched quote could drop supported meanings and introduce an attribution error. In v7, an unmatched excerpt in a known turn uses the exact text of that whole turn. Valid excerpts, turn IDs, evidence roles, meanings and topic assignments are preserved through citation repair. Repeated excerpts still require a valid offset. The private **Analysis steps** panel marks the repaired citations, and the audit checks whether the complete turn supports each part of the claim. A citation repair uses no model call and leaves the existing semantic retry available. No Prisma migration is required. Reverting the application change restores the prior citation handling.

## Inspect the analysis stages

In the DEV owner review, expand **Analysis steps** after an analysis. Each attempt shows extraction (groups, meanings, citations and exclusions), composition (draft paragraphs and assigned meanings), and the audit outcome. The panels preview a bounded amount of each step and identify omitted items. Use **Copy item** to copy only the item you want to discuss. Earlier drafts can contain rejected statements.

Successful previews are encrypted with the private draft candidate and remain available while that candidate can be reviewed. Failed previews are encrypted with a failed review receipt. Reopening the review shows the latest failed analysis for one hour, subject to the same owner, source, and baseline checks. A newer successful analysis supersedes it. This requires the additive `20261112070000_lu_failed_stage_review` migration. Earlier failures had no stored receipt and need a fresh run. The stage previews are separate from the safe application log. To inspect a previously saved call, run a fresh analysis.

## Validation

### Compare writing approaches on DEV

On a complete saved conversation's owner review page, expand **Compare writing approaches** and submit the preview. It uses the existing `RELISH_FOUNDATION_LU_REVIEW=YES` DEV gate and requires the same explicit private analysis admission as **Analyse conversation**. It sends the transcript and eligible prior understanding to the configured model. Preview results are returned only to the current page. They create no candidate or revision. The existing preparation can record the transcript's analysis admission and initialise private subject references. No Prisma migration or configuration change is required for an existing DEV review setup.

Both drafts use one successful extraction and the topic outline produced by the current composer, including the subject, claim assignments, previous topic, and proposed effect. The focused writer receives one changed topic, its assigned claims and evidence, its eligible prior paragraph, and neighbouring topic labels. Both complete drafts use the same audit and candidate checks. The preview shows the shared claims and source turn IDs, both versions of each paragraph, and any audit findings the auditor can identify. It keeps both drafts visible when an audit raises an issue. The focused pass handles up to 24 changed topics, in waves of at most four calls, under the existing four-minute deadline. An incomplete pass shows the available text and its status. This experiment measures writing with a fixed outline. Topic discovery and routing are shared inputs.

Replay three saved DEV conversations with the configured model:

| Case | What to compare |
| --- | --- |
| The previously inspected reconnection call | Meaning of the encounter, separate reason for seeking advice, and uncertainty about who the speaker wanted to stay in touch with |
| A straightforward conversation about one person | Coherent wording, evidence coverage, and whether incidental details become lasting topics |
| A follow-up after approving an initial understanding in DEV | The changed detail, preservation of unaffected meaning, and whether the prior topic and new evidence stay distinct |

For each case, compare the shared claims with the source before comparing the paragraphs. Record omissions at extraction separately from omissions or attribution changes in the writing. Use the same person's saved baseline for the two drafts. Hosted model quality and latency still need this replay. Local synthetic tests exercise the shared inputs, scoped writing, audit findings, partial provider failure, longitudinal carry-forward and the preview route. Revert the application change to remove the comparison entry.

The LUR-2 disposable database suite includes LUR-3 assessment and LUR-4 route cases with a simulated model. The browser job exercises native forms with Chromium against that same isolated fixture. The suite covers the first and second revisions, edited wording and its origin, provider-failure recovery, defer and reject, prior evidence eligibility, read-only rollback and denied cross-account access. The browser fixture renders the real review component and calls the real route handlers. A hosted Dorian/OpenAI quality replay remains part of LUR-5.

The composition regression replays a rejected citation followed by cross-subject links using a synthetic conversation. It checks that several meanings can cite the same turn and that the repaired proposal preserves why the reconnection matters, the tentative wish to stay in touch, and the separate reason for seeking advice. The hosted replay should check these distinctions on the previously saved call. No Prisma migration is required for this repair.

```sh
# Run the assessment and review suite against a disposable local database.
node --test tests/foundation/lur2-persistence.test.mjs
```

Next stage: LUR-5 integration and activation review. Recommended model: GPT-6.1 Sol High.

## Topic-first self-understanding (2026-11-15)

Implemented on `feature/lu-self-topic-workflow`, based on Development `fbf7bcec` (PR #80 merged). Not merged or deployed by this task. The existing DEV **Analyse conversation** form now requests `SELF_TOPICS`: discover meaningful areas, develop each topic from its supporting turns, review structure and evidence, then approve selected topics through Foundation. It reuses the established discovery/writing prompts and structural principles extracted unchanged into `topicPrompts.ts`; the legacy callers import those same strings. No legacy Contact/ContextSpace LU writer is called.

This initially develops the owner's own LU. Personal history, family context and specific wishes remain appropriately qualified; the adapter does not construct independent person/relationship understandings. Other saved streams are carried unchanged. Both speakers remain in discovery/audit context, and adjacent agent questions accompany focused writing, but only owner turns support meaning. The same passage can support several topics. Foundation assertions attach evidence after topic discovery; they do not choose topic granularity. Prior topic/version and retained-meaning references remain exact. Wording edits retain the self-workflow scope. Method-bound retries cannot resume a draft from the older three-subject assessment.

The first adapter runs the stages together, with final topic selection before saving. It does not reproduce the old between-stage selection forms, operational matching layer, or automatic structural split/merge/reclassification machinery. Structural problems hold the draft with private findings instead of rewriting saved topics. The older three-subject assessment and writing comparison remain available internally for regression/comparison; this is one Foundation persistence system. Topic discovery is limited to 12 areas, writing runs in waves of three, and all calls share the existing four-minute budget. Larger inputs or failed validation stop without an approved update. No real provider quality or latency claim follows from synthetic tests.

### DEV realism replay

Use the existing owner-only DEV review gate and model configuration. No new environment variable or Prisma migration.

1. Open a saved Dorian conversation through My People and choose **Review conversation for Living Understanding**, then **Analyse conversation**. A fresh review without an old candidate URL uses the new path.
2. Expand **Analysis steps**. Inspect **Area of understanding**, each **Topic understanding**, and **Structure and evidence review**. Compare coverage, meaningful connections, uncertainty and attribution with the full transcript. Use Copy item to share selected diagnostics. Previews are bounded and remain owner-private.
3. Confirm suggestions appear under **Me** and inspect exact supporting evidence before approving selected topics. Existing other perspectives should remain unchanged.
4. Replay a different conversation and one follow-up that changes a previously approved topic. Check unchanged meaning, new qualifications, chronology, exact source links and revision history. Approval is explicit; a failed audit must create no authoritative revision.

Automated evidence: 99 focused contract, semantic, adapter and legacy-policy tests passed; eight disposable PGlite repository/route tests passed, including new initial and follow-up approvals; the same eight passed with Chromium mobile-width native forms. Typecheck passed with zero errors/warnings before the final documentation pass. A separately run legacy longitudinal-chain source-text assertion fails identically on unchanged Development `fbf7bcec`; it expects `longitudinal.chainHistory` in the older route. Hosted realism replay remains pending. No production data or external configuration was accessed.

Rollback: revert the application/UI change to restore the earlier analysis entry. Approved Foundation evidence and revisions remain readable. No schema or data rollback is needed.

### DEV citation failure follow-up (2026-11-15)

PR #81 merged at `69419999`. A hosted v1 replay returned three topic drafts and then held the run with `OUT_OF_TOPIC_EVIDENCE` before structural review. Version v2 lists permitted turn IDs by citation role and retries only the affected topic once. The same evidence boundary and overall deadline apply to the retry. If it fails, the owner can inspect the held topic and valid sibling previews, and the run remains ineligible for approval. Logs now report the rejected composition attempt without private text. Replay the same conversation on DEV and confirm it reaches **Structure and evidence review** or shows the specific topic held. No Prisma migration or configuration change. Revert the application change to restore v1 processing.

### Targeted structural review retry (2026-11-15)

PR #82 merged at `5a033344`. The hosted v2 replay reached structural review, which held the draft for overlapping primary meaning, unsupported wording and omitted context.

Version v3 on `fix/lu-self-topic-audit-repair` accepts an explicit repair plan for those three issue types. The auditor identifies the exact draft topics to change and gives each writer specific feedback. The retry uses the topic's original source scope, preserves saved topic identity and revision effects, and can suggest a more accurate title for a new topic. The full draft is rebuilt, validated and audited again once. A missing or invalid plan, a failed rewrite or any unresolved audit issue holds the draft. The audit distinguishes relevant context that explains an intention from incidental detail that need not block approval.

In DEV, rerun the conversation and open **Analysis steps**. If the first audit identifies a repairable issue, look for the named revision in **Audit · Attempt 1**, the revised topic, and the result in **Audit · Attempt 2**. Confirm the proposed conversation has one primary home and meaningful supporting context. A passing audit makes the draft available for manual approval. The existing model deadline applies. No migration, configuration change or data rollback is needed.

### DEV follow-up by pasted transcript (2026-11-15)

PR #83 merged at `baa4744e`. The owner reported a hosted run that reached manual approval. The follow-up test on `feature/lu-dev-transcript-import` uses the same private People and Living Understanding review flow:

1. Open the original conversation review and approve the topic you want to update, such as **Jessica’s musical-theatre path**.
2. Go back to the same person's My People page and open **Import transcript for Living Understanding**. Give it a title and a later conversation date and time in UTC. Paste your own words prefixed with `You:`. If you include another speaker's words, prefix them with `Context:`. A single owner turn is enough.
3. Select **Save transcript and open review**, then **Analyse conversation**. Look for the existing topic and its **Previously saved** wording. Before approving, check that the new detail is incorporated with the correct timing and unrelated understanding is preserved.
4. Approve the selected update and inspect the history. The prior topic version remains available and evidence for the revised topic should point to both the earlier and follow-up transcripts where it builds on both.

The import is available only under the existing authenticated owner DEV review gate. It records a separate, encrypted owner-import source. Saving the source is stored-only, and selecting **Analyse conversation** separately admits it to the existing model workflow. The selected person supplies the same private review context as the original source. Only labelled owner turns are eligible as self evidence. Same-form retries with the same input resolve to the same source. The Dorian call paths are unchanged. No migration or configuration change. Rolling back the import form and action can disable future imports while retaining the reader for already imported sources.

### Follow-up discovery validation (2026-11-15)

PR #84 merged at `5e8fc0e1`. The first reported hosted follow-up reached topic discovery, then failed the discovery policy before any drafting. The `prepare` label and generic `DECOMPOSITION_POLICY` code did not identify which discovery rule rejected the response.

Version v4 on `fix/lu-dev-discovery-validation` gives discovery an explicit list of allowed saved-topic references and owner-turn IDs. The server checks those references, new topic labels, coverage and exclusions in the discovery stage. A rejected draft receives one guided retry and the same validation. **Analysis steps** shows any correction or terminal reason under **Extraction**, without including untrusted model references in the operational log. A repeatedly invalid discovery remains held; successful discovery proceeds through the usual topic drafting, audit and owner approval.

After rollout, reopen the same imported transcript's review and select **Analyse conversation**. If discovery passes, check the existing topic and **Previously saved** wording. If it is held, check **Analysis steps → Extraction** and the logged discovery reason. No re-import, configuration change or Prisma migration is required. The hosted model replay remains pending.

### Exact excerpts for supporting evidence (2026-11-15)

PR #85 merged at `737b856c`. The hosted follow-up produced a qualified update of the existing topic and showed its prior wording. The owner then reported that evidence in the earlier revision repeated a long transcript turn for each statement.

The v5 topic writer on `fix/lu-evidence-excerpts` prefers the smallest exact passage that supports the drafted statement and retains its qualifications. It can cite separate spans when a statement depends on more than one passage. Existing grounding checks verify the spans against the transcript; a quote that does not occur falls back to the same original turn, which is then reviewed by the audit. The audit checks whether the cited passages jointly support the assertion and whether the surrounding text qualifies it.

Draft evidence displays short excerpts directly with **Read full source turn** for context. Long saved evidence is expandable and retains its source link. Existing saved revisions keep their original anchors. To reproduce in DEV, analyse a long transcript turn with several distinct claims and compare each citation with the original source. No Prisma migration. Revert the prompt and presentation changes to restore the previous behavior; stored excerpts remain readable.

### Keep topic identity fixed during an audit rewrite (2026-11-15)

PR #86 merged at `5d9f74a1`. A hosted v5 run completed discovery and initial writing. Its first audit requested an edit for unsupported prose and duplicate meaning, and the rewrite stopped with `TOPIC_TARGET` before the second audit. The trace does not distinguish an incompatible effect from a proposed saved-topic title.

In v6 on `fix/lu-audit-repair-topic-target`, audit rewrites return prose and supporting meanings. A new topic can also receive a corrected title. Relish carries forward the original topic identity, saved title, effect, time scope and retirement list. Extra provider fields cannot change them. The scoped citations and rebuilt draft still go through validation and the full second audit before owner approval.

Rerun the same transcript in DEV. If an audit requests a rewrite, look for its updated topic and **Audit · Attempt 2**. Open **Supporting evidence** if the result is ready. Hosted replay is pending. No Prisma migration; application rollback leaves approved revisions readable.
## Private discovery diagnostics

For new self-topic analyses, a held discovery review can show coverage counts, missed owner turn IDs and excerpts, and rejected unresolved mentions alongside their cited source text. On those coverage or mention failures, it also shows the provisional areas and their source turn IDs, so an operator can inspect what discovery produced before full validation. If discovery ends without a valid result, the review identifies topic writing and audit as stages that did not run. The existing bounded automatic correction receives the reported turn IDs without weakening the coverage or exact-text checks. The details use the existing encrypted private review and do not enter operational traces. Previously held runs contain only the diagnostics captured when they ran.

### Unsupported owner pronouns

In v11, generated self-topic wording uses “the owner” or “the participant” when the evidence does not establish their pronouns. References to other people keep their supported pronouns, and source excerpts remain verbatim. A scoped `UNSUPPORTED_OWNER_PRONOUN` finding can be corrected in the existing automatic repair and re-audit, alongside supported omissions or other editable findings. A finding that assigns a claim to the wrong person still holds the draft for inspection. No Prisma migration is required.
