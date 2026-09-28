# Stage 8.12.13.5 - Read-only Living Understanding revision experiment

## Purpose

Compare the current, claim-by-claim transcript extraction workflow against the alternative proposed by the product owner: supply the **existing topic understanding plus one new conversation** to a model and obtain a **new coherent understanding plus an explicit change record**.

This is deliberately an **experiment**, not a replacement knowledge architecture. The existing Stage 8.12.13.4 extraction, review, topic assignment, comparison and evidence storage remain intact. No schema changes.

## Workflow

1. Set `DATING_REVISION_EXPERIMENT=YES` in the local development `.env` and restart the app. This route is unavailable in production regardless of the flag.
2. Navigate to an original, accessible reflection or imported conversation in Dating > People > Living Understanding. Use the **Try the read-only Living Understanding revision experiment** link.
3. Choose ONE existing topic and explicitly consent to transmitting the selected transcript and the topic's current knowledge to the configured OpenAI API model. No other topic's prior claims are included.
4. The model returns a proposed coherent topic understanding, a disposition for **each** existing claim, and individually attributable new claim proposals, each with an exact target-speaker quote. Its dialogue partners' words are context only.
5. The response includes deterministic checks for missing previous claims, missing/wrong-speaker evidence, invalid actions and over-limit results. The operator can compare this with the existing Extract individual knowledge result from the same source. The experimental results have **no save button**.

## What remains deliberately unchanged

- Existing claims, topic assignments, source interactions, evidence, statuses, confirmation attribution and sharing permissions.
- The original conversation and source custody. Nothing can be read until existing owner, Dating ContextSpace and target-contact verification passes.
- Original `package-lock.json`, application dependencies and permanent extraction route.

The model gateway still writes a **content-redacted model invocation audit** (model, token counts, structural metadata), never the experimental private prompt or model response. Nothing from this experiment is added to Living Understanding.

## Privacy and limits

- Only enabled outside production, with explicit per-run processing consent.
- Selects only one topic's active claims; the action revalidates topic ownership.
- Rejects excessive source or prior-knowledge volume rather than silently truncating it.
- Unsupported claims remain visible with an invalid-evidence warning and cannot be adopted automatically.
- The revised prose is still **unverified** even when cited changes pass deterministic evidence checks. It may omit concepts or misstate relationships between ideas. A future experiment should add independently verified semantic coverage and topic-level versioning.
- External API processing is still subject to the provider's applicable retention controls. This is not a local-only AI experiment.

## Testing

The `check:stage8.12.13.5` script runs six permanent tests with a **fictional fixture** that assess prior-claim omission, wrong-speaker evidence, duplicate IDs, malformed changes and the feature/consent/read-only boundary. It does not exercise the live model, database, Svelte route or browser workflow.

Use actual live-model results to compare against the existing Stage 8.12.13.4 pipeline using the same consented or fictional transcript and selected topic. Review coverage, evidence faithfulness, preservation of uncertainty, omitted prior knowledge, useful new claims and manual-review effort. A single successful run does not prove reliable longitudinal memory revision.
