# Stage 8.12.5 - Knowledge Extraction Quality

## Why
The previous extraction returned ten supporting passages from a long reflection but omitted several useful topics, including concrete interests, business life and the uncertainty around starting a serious romantic relationship. It also combined independently reviewable preferences into broad statements.

## Changes
- First model pass now requests up to 26 distinct, atomic, context-preserving proposals from the **entire** reflection, rather than simply the first dozen.
- Reflections of 600 characters or more get a second model pass focused on missing topics and nuances. If that second pass fails, first-pass results remain available. Longer reflections therefore normally consume two model requests and may cost more.
- Exact-evidence verification rejects any suggestion whose supplied passage cannot be located in the source; unknown types, overlength items and exact duplicates are rejected.
- Candidate proposals are diversified across knowledge types **before** the existing 12-item UI limit is applied. The review interface is explicit that twelve is a display limit, not a complete inventory.
- Existing individual decisions, operator-versus-person attribution, custody checks, manual proposals and source retention are unchanged.

## Important limitations
- Heuristic category diversification cannot prove semantic correctness or comprehensive coverage. Model suggestions still require individual review, especially for negation, ambiguous scope and opinions about others.
- The deterministic helper prevents identical normalized statements of the same kind but does **not** yet perform full semantic deduplication, contradictory-claim reconciliation or confidence scoring.
- The second model request sends the same expressly authorised reflection again to the configured provider. Do not opt in unless you have appropriate authority to process the person's private material.
- This release has no Prisma migration and retains the Catalina-compatible `package-lock.json` from Stage 8.12.4. Existing unresolved production dependency advisories are still deferred, not remedied.

## Verification
Run the new behavior tests and existing regression checks, followed by Svelte/TypeScript validation and a build on your Mac. The automated tests validate the selection algorithm using controlled fixtures, not model accuracy. Compare the same long test reflection from Stage 8.12.4 in the real interface, reviewing whether interests, professional circumstances and uncertainty are represented accurately, and whether each item has a valid supporting passage. Empty, duplicated or inappropriate statements may still be rejected individually.
