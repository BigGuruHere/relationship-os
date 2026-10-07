# Stage 8.12.7 - Knowledge extraction diagnostics

## Why

The same long reflection produced repeated quoted passages and still missed explicit uncertainty. The previous 12-item review screen could not show *where* information disappeared. This stage introduces opt-in, development-only candidate counts from the first model pass, the second coverage pass, and the combined selection stage. It does not change the confirmed-knowledge workflow or promise improved model quality by itself.

## Changes

- `inspectKnowledgeSelection()` applies the existing deterministic evidence, deduplication, selection and diversity rules and returns an aggregate count-only report, without quotes, statements, IDs or other personal content.
- The extractor retains bounded raw candidate arrays between model responses and deterministic inspection, allowing invalid evidence and duplicate counts to be measured instead of counting only already-filtered proposals.
- First, second and combined reports include received, invalid/unsupported, exact and near duplicates, distinct eligible, selected and beyond-limit counts. Combined output also reports repeated supporting quotes and a heuristic explicit-uncertainty coverage check.
- The original reflection is validated for the current person, owner and Dating ContextSpace before either model call. The UI still requires explicit consent for AI processing. No new database writes occur for diagnostics and no diagnostics are stored in the database.
- The optional UI appears only for `NODE_ENV !== 'production'` with `DATING_KNOWLEDGE_DIAGNOSTICS=YES`; it reports counts and high-level categories, not raw private content. No new statement-level logger was added.
- The former 12-item per-page review and maximum 32 selected suggestions are unchanged. All model returns are bounded to 80 raw candidates per pass before inspection.
- Four targeted tests and the previous full `.mjs` regression suite verify the counters, provenance filtering and unchanged selection, plus the configuration gate.

## Important interpretation

An explicit uncertainty in the source but not in either model's raw candidate list is an **AI extraction omission**, not a selection bug. A candidate present in raw output but missing from the combined eligible pool was removed by validation or deduplication. A valid distinct candidate absent from the first review page may be on later pages. The source-versus-selected uncertainty check uses wording alone; it is not a semantic judgement about correctness. Reviewing actual proposed statements remains necessary.

Diagnostics are in-memory for the current request and intentionally disappear on reload. If you wish to compare runs, record only the aggregate counts and your qualitative observations; do not send raw private reflections in application logs.

## Deferred

- Automated quality metrics that require gold-standard, consented examples and semantic review.
- Fine-tuning of model prompts/selection policy based on observed diagnostic data.
- Production dependency-security upgrade blocked by the older macOS compatibility issue.
