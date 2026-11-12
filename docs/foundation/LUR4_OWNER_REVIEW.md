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

## Diagnosing an analysis failure

DEV reached the review page and logged `decompose / INVALID_QUOTE` after the bounded repair. The assessor can now request a whole turn by ID and Relish copies the immutable text directly. Short excerpts must still match exactly in the cited turn. Repeated excerpts require an exact local offset. The evidence and attribution audit runs on the resolved text.

Search DEV application logs for the page reference or `relish.lu.review`. The warning gives the stage, attempt and fixed reason code. It excludes transcript text, prompts, model responses and source identifiers. Retry the same saved conversation after deployment to verify this case.

## Validation

The LUR-2 disposable database suite includes LUR-3 assessment and LUR-4 route cases with a simulated model. The browser job exercises native forms with Chromium against that same isolated fixture. The suite covers the first and second revisions, edited wording and its origin, provider-failure recovery, defer and reject, prior evidence eligibility, read-only rollback and denied cross-account access. The browser fixture renders the real review component and calls the real route handlers. A hosted Dorian/OpenAI quality replay remains part of LUR-5.

```sh
# Run the assessment and review suite against a disposable local database.
node --test tests/foundation/lur2-persistence.test.mjs
```

Next stage: LUR-5 integration and activation review. Recommended model: GPT-6.1 Sol High.
