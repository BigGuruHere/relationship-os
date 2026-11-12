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

If a terminal audit identifies a disputed claim, the authenticated DEV owner can expand **Why these suggestions were held** directly on the failed review. The panel shows a bounded set of disputed claims and cited excerpts. Full turns remain in the saved transcript above. The panel is part of the no-store action response and disappears when the page is reloaded. No failed draft is approved or persisted. Retry the same saved conversation after deployment to verify this case.

A later DEV analysis repaired its quote citations and then hit `UNSUPPORTED_PROSE` in the audit. A prose-only finding now gets one wording repair using the grounded extraction. The repair keeps the same evidence, destinations and topic dispositions, then runs the complete audit again. If the audit identifies specific paragraphs, the owner can inspect those findings on a terminal failure. The existing four-minute model deadline covers both repairs.

## Validation

The LUR-2 disposable database suite includes LUR-3 assessment and LUR-4 route cases with a simulated model. The browser job exercises native forms with Chromium against that same isolated fixture. The suite covers the first and second revisions, edited wording and its origin, provider-failure recovery, defer and reject, prior evidence eligibility, read-only rollback and denied cross-account access. The browser fixture renders the real review component and calls the real route handlers. A hosted Dorian/OpenAI quality replay remains part of LUR-5.

```sh
# Run the assessment and review suite against a disposable local database.
node --test tests/foundation/lur2-persistence.test.mjs
```

Next stage: LUR-5 integration and activation review. Recommended model: GPT-6.1 Sol High.
