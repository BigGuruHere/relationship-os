# Stage 8.12.13.9 - Living Understanding Core Validation Suite

## Purpose

This stage does not add another knowledge feature. It defines a finite exit gate for the Living Understanding v1 architecture before persistence and voice ingestion.

The suite tests the architectural invariants that must remain true even when model wording varies:

1. Reinforcement uses direct target-speaker evidence.
2. Refinement can make an understanding more precise without replacing history.
3. Contradiction cannot be supported by agent or third-party speech.
4. Supersession preserves the earlier proposition and uses potential retirement rather than silent deletion.
5. Uncertainty remains explicit in operational knowledge.
6. One utterance can support multiple independent semantic areas.
7. Structural contamination can be split without silent topic loss.
8. Temporary interaction choices remain session state rather than durable person knowledge.
9. Non-target speaker statements cannot become evidence about the target person.
10. An unrelated later source leaves prior understanding unchanged and cannot silently omit prior topics.

The suite also asserts the live model prompt contracts for target-speaker evidence, uncertainty preservation, no absence-as-contradiction, explicit retirement evidence, selective operational atomicity, and structural-only restructuring.

## What this proves

The deterministic suite validates the server-side safety and review contracts around model output. It does not prove that every live model call will make the best semantic classification. Live semantic quality still requires a small acceptance run using representative conversations.

## Core v1 exit gate

The Living Understanding core may be treated as v1 architecture-complete when:

- `npm run check:stage8.12.13.9` passes;
- the existing Stage 8.12.13 experiment tests remain green;
- the representative three-source longitudinal test still shows reinforcement, refinement and supersession correctly;
- topic restructuring produces a coherent, coverage-complete structure without validation warnings;
- no custody, evidence, or subject-boundary regression is observed.

Once those conditions hold, further work should move to persisted Living Understanding v1 rather than adding more experimental restructuring features unless a genuinely structural defect is found.

## No persistence change

This stage has no database migration and does not change production persistence. It adds validation tests and a documented architecture exit gate only.
