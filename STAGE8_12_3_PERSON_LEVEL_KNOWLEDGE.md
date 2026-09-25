# Stage 8.12.3 - Person-Level Knowledge and Living Understanding

## Scope

This release reuses the existing Dating-custodied Contact, Interaction, KnowledgeClaim and KnowledgeEvidence structures. No migration is required. The Person remains the conceptual centre; the current pilot operates through each person's custody-local Contact representation. Do not merge canonical Person data or copy claims across ContextSpaces.

- A Dating person's Living Understanding page now displays a bounded view of **active, typed KnowledgeClaims** without scanning every historical reflection.
- The pilot operator can propose knowledge from one of that person's existing private reflections by following the new source link in their personal history. The proposed item carries the original reflection ID and can be confirmed, rejected, or deferred separately.
- The source reflection is validated on proposal creation **and again during review**, within the same owner, Dating ContextSpace and Contact. New reviewed knowledge links both the operator review and the original reflection as evidence. Original source text is never overwritten.
- Individual knowledge types: fact/background, want, offer, preference/interest, objective, constraint, other. This is **classification by the operator**, not a verified fact about the participant.
- Rejections or deferrals supersede the earlier review and related evidence. The current view excludes claims without active evidence. Prior versions and original reflections remain in history.
- No cross-context access, participant self-confirmation or disclosure grant is introduced. A person's current knowledge must never be read from an unscoped global identity query.

## Architectural boundaries

The existing one-sentence Living Understanding is now one or more **individually proposed elements**. Each has its own reviewed status and provenance; no all-in-one mutable profile field is introduced. Scopes, source custody, reliability, currency and permissions remain **separate dimensions** for future development. A confirmed operator decision is deliberately stored with third-party-reported, low-confidence authority. Stage 8.12.4 can focus on Dorian using this information in a later conversation only after the live database and browser tests pass.

## Tests

- `npm run check:stage8.12.3` checks source-level paths and access guards.
- `npm run check:stage8.12.3:db` creates disposable owned Contacts on the existing development Dating ContextSpace and tests original-source isolation, pending review, a confirmed claim with two provenance records, unchanged-repeat idempotency, rejection, original reflection preservation and fixture cleanup. Explicit opt-in is mandatory.
- Also run Stage 8.12.0.1 and 8.12.2 regressions, `npm run check` and `npm run build` on your Mac or Windows. These commands were not all available in the packaging environment.

## Deferred work

Participant-authenticated confirmation, deterministic model extraction, consistency assessments, person-level permission UI, cross-context reuse, stronger item-level permission and temporal-scope modelling, and production dependency fixes remain separate work. The previous Catalina-compatible lockfile is unchanged.
