# LUR-3 Foundation semantic assessment

Implemented on `feature/lu-foundation-semantic` from Development `b855aa45`, which includes [LUR-2](LUR2_PERSISTENCE.md). This stage connects the rich assessment process to the Foundation source and candidate repositories. The owner review interface follows in LUR-4.

## Assessment

The service prepares an exact, explicitly admitted transcript version and the current eligible understanding. The transcript includes both speakers. Dorian's questions can clarify the owner's answers as context. Supporting, qualifying and contradicting citations must use exact owner passages. Short answers that depend on a question retain that question as a separate context dependency. Ambiguous assent and unconfirmed suggestions cannot supply owner evidence. An independent audit checks whether cited answers substantively support the proposed meaning.

The first model step identifies enduring meanings and their narrow semantic areas. Each owner turn is cited or accounted for by an exclusion. The model receives scoped aliases for the owner, selected person and relationship, all in the owner's perspective. Reported speech retains its separate basis and exact quotation. Names mentioned in the conversation remain unresolved unless established by the application. The second step builds topic paragraphs and accounts for the existing topic set with the established longitudinal effects. Every new meaning has one primary home and can be contextual in another topic. Unchanged topics carry their exact version, and updates retain unaffected meanings. A supersession requires known chronology and an explicit replacement. Withdrawn topics are withheld from the model.

The service reuses the deterministic decomposition, longitudinal evidence and duplicate prose checks. The independent audit examines attribution, completeness, topic boundaries, temporal distinctions and preservation of qualification. One bounded repair can repeat the assessment with the validation issue. Malformed or unsupported results fail closed. These checks address structure and model assessment quality. Exact quotes alone cannot prove semantic entailment.

## Permission and persistence

The application rechecks the current Foundation access, transcript version, analysis admission, baseline and inherited evidence eligibility before and after each model call. The final candidate transaction rechecks them again. Approving a candidate also checks the eligible baseline binding, including withdrawals that do not change the topic head. Model work happens outside database transactions.

The assessment uses the shared gateway's OpenAI transport and the configured `DATING_REVISION_MODEL`. Each request has a deadline. The Foundation adapter retains model, prompt version, invocation references and repair codes inside encrypted candidate provenance. No legacy ContextSpace audit record is created by this adapter. The existing model gateway's legacy callers retain their audit behaviour. Successful assessment stores a reviewable candidate or a durable no-change receipt. A failed attempt returns an error and creates no candidate or revision.

An exact request key resumes a candidate under the current source and eligible baseline. Concurrent completions share one receipt. An expired, reviewed or stale candidate cannot be resumed as current. The application passes request keys to the internal service in the later review flow.

## Validation and rollout

Run `node --import tsx --test tests/core/lu-semantic-assessment.test.mjs` for the synthetic initial and longitudinal comparison. The fixture compares shared validators on equivalent inputs, including all prior effects, more than six initial topics, exact attribution, context, legitimate overlap and unsupported output. The existing PostgreSQL persistence suite exercises the real guarded service and model gateway through an intercepted transport, including two approved snapshots, no-change replay and permission changes during processing and before approval.

The local runs passed 62 focused contract, legacy policy, access and persistence checks and 15 existing onboarding and Dorian route checks. Svelte diagnostics reported zero errors and warnings. The deployed migration integrity check passed for all 82 tracked migrations.

A controlled replay against the configured model and human review of semantic quality still precede activation. Tests use synthetic transcript data and fixture responses. Existing People notes and Dorian conversation save paths continue to use their current routes. This stage requires no Prisma migration. Existing LUR-2 sources, summaries and topic versions remain available on rollback.
