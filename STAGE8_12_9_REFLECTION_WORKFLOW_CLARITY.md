# Stage 8.12.9 - Reflection workflow and topic-assignment clarity

## The problem
The prior reflection link opened the complete Living Understanding screen, with the whole current-knowledge list and realm/topic archive above the relevant extraction form. Topic assignment required scanning repeated forms and did not sufficiently foreground which statement was being assigned.

## What changed
- Saving a personal reflection returns to the person's Personal Reflections section, highlights the saved entry, and confirms that it was saved. There is **no automatic promotion to knowledge**.
- Each reflection offers **Review reflection and suggest knowledge**. That source-scoped URL opens a focused workflow: original reflection, opt-in Dorian suggestions, editable statement first, evidence second, individual review decisions, optional manual additions. The full knowledge, realm, and history sections are not displayed in this mode. A link returns to the full overview.
- Saving reviewed suggestions returns to the full Living Understanding with a confirmation message and a link to topic assignment. The original reflection stays intact.
- The ordinary Living Understanding page shows realms/topics and a **single statement-first assignment control**. Choose the exact current statement, read it in a prominent card, see existing assignments, and select a realm/topic. The already-assigned choices are disabled. The chosen claim is preserved after assignment with a custody-validated `claimId` query parameter.
- Full current knowledge and proposal/revision history are collapsed by default. The create-topic form is opened only when requested.
- Existing owner + Dating ContextSpace + person checks, source verification, consent, individual reviews, immutable source history, and multi-topic links remain unchanged. No schema, migration or dependency change.

## Testing
- New `npm run check:stage8.12.9` deterministic source regression tests cover the focused workflow, save navigation, statement-first assignment and preserved custody/consent checks.
- Updated obsolete exact-text assertions in older Stage 8.12.3, 8.12.4 and 8.12.8 tests to the new UI labels, keeping their actual behavioural/security assertions.
- All 85 `.test.mjs` tests passed in the packaging environment. This does not replace the full TypeScript checks, actual browser walkthrough, or live dev-database tests.
