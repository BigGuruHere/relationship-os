# Stage 8.12.13.3 - Conversation extraction inspection and speaker clarity

**Source baseline:** Stage 8.12.13.2 complete-source ZIP. This is a complete replacement source package, not a patch against an earlier stage.

## What changes

- **Excluded speakers are explicit on the import result screen.** The saved result shows which speakers were retained in the encrypted original only and labels every person-level review link with the actual mapped speaker. `SKIP` still creates no excerpts for that speaker, including during idempotent reimports. Excluding an agent does not erase its dialogue from the original conversation.
- **Rejected proposals can be inspected in development.** With `DATING_KNOWLEDGE_DIAGNOSTICS=YES` outside production, the focused knowledge-review page shows the actual original proposed statement, proposed category, model-supplied source passage, specific reason and overlap target for duplicates. First-pass and coverage-pass exclusions are distinguished. The count-only report remains free of private content.
- **Evidence punctuation recovery.** If the AI copies a source passage with punctuation or apostrophe differences, Relish now accepts it *only when the same contiguous word sequence occurs in the authorised source*, and replaces the proposed passage with the actual source text. A failed or paraphrased passage is still rejected and appears in development inspection. The saved-knowledge evidence gate applies the same validation.
- **A permanent fictional regression fixture** covers the gated diagnostic response, punctuation recovery, non-matching evidence and excluded speaker behavior.

## Limits

- The new inspector shows **proposals actually returned by the AI and rejected or deferred by filters**, not concepts the AI never proposed. It does not validate semantic entailment. Operators must still read the original reflection and review suggestions.
- Rejected details are only returned with the explicitly enabled development flag and a separately authorised source. They are not written to the database, server logs or general analytics by this stage. Treat any screenshots and browser copies as sensitive.
- Live database, full TypeScript/Svelte compilation, browser acceptance and variable live-model extraction remain unverified in the packaging environment. This stage does not add a migration; the prior 8.12.13.2 migration remains included for development installations that have not applied it.

## Deterministic verification in packaging environment

- `node --experimental-strip-types --test tests/core/*.test.mjs`: 112 passed, 0 failed.
- `npm run check:stage8.12.13.3`: 4 passed, 0 failed.
- `npm test` could not start because node_modules, including `tsx`, are not installed in the packaging environment.
- `npm run check` could not start because `svelte-kit` is not installed in the packaging environment.

See the separate install-and-test guide before applying any pending migration. Never run development DB tests against production credentials.
