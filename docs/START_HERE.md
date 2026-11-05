# Relish: Start Here

Status: living documentation index. Updated 2026-11-05; F-202 schema is merged and DEV operator-confirmed; F-203 provisioning is merged and DEV operator-confirmed; F-204 access is merged and F-205 evidence is on a feature branch; user activation remains gated.

Relish is a person-first Relationship Operating System. Dorian is a conversational AI partner that helps people understand themselves and develop valuable relationships with other people. The architecture and the immediate product experience evolve together, but an old release note is not a current product requirement.

## Read these files first

1. [`AGENTS.md`](../AGENTS.md) - mandatory engineering and Git workflow, including reuse before build.
2. [`PRODUCT_AND_PRINCIPLES.md`](PRODUCT_AND_PRINCIPLES.md) - enduring purpose, product model and trust principles.
3. [`ARCHITECTURE_AND_BOUNDARIES.md`](ARCHITECTURE_AND_BOUNDARIES.md) - the current technical system and boundaries between applications.
4. [`CURRENT_STATE.md`](CURRENT_STATE.md) - what is in Git, what is still on a feature branch, uncertainties and verification needs.
5. [`ROADMAP.md`](ROADMAP.md) - outcome-based priorities and acceptance gates, not another numbered stage sequence.
6. [`DECISION_LOG.md`](DECISION_LOG.md) - major accepted decisions and links to deeper historical reasoning.

For a quick visual or text change, read only the relevant sections and inspect the affected source files. For a cross-cutting change, read all six and inspect the current code. Avoid an unnecessarily lengthy audit of an obvious fix.

## Relationship foundation programme

For architecture and new-domain implementation, read these linked documents after the living overview:

- [Architecture and domain glossary](foundation/ARCHITECTURE.md): target model, existing-source assessment and required scenarios.
- [Architecture decisions](foundation/DECISIONS.md): rationale and precise supersession of legacy assumptions.
- [Permission and provenance contract](foundation/POLICY_AND_PROVENANCE.md): authority, evidence, correction and withdrawal.
- [Implementation and rollout plan](foundation/IMPLEMENTATION_PLAN.md): stage gates, stage-2/3 source-level backlog, migration strategy and status register.
- [Developer guide](foundation/DEVELOPER_GUIDE.md): worked patterns, PR evidence and ongoing documentation duties.
- [F-201 physical model](foundation/PHYSICAL_MODEL.md): concrete tables, constraints, transaction/routing contracts and F-202 migration slices.
- [F-201 dependency inventory](foundation/DEPENDENCY_INVENTORY.md): source consumers, ownership matrix and outstanding target-database evidence.
- [F-202 invariants and rehearsal](foundation/F202_INVARIANTS.md): implemented SQL guarantees, repeatable isolated checks and deployment gates.

- [F-203 provisioning isolation](foundation/F203_PROVISIONING.md): shared authentication boundary, preparation, claim isolation and validation.

- [F-204 access and repositories](foundation/F204_ACCESS.md): owner authority, lifecycle locking, guarded queries and private subject services.

- [F-205 private evidence](foundation/F205_EVIDENCE.md) covers versioned notes, excerpts, supported statements and current eligibility.

These specifications guide future work; they do not replace source code as evidence of implementation. Update the relevant backlog item and stage register with each implementation PR.

## Source-of-truth rules

- The latest relevant source code, schema and tests on the **selected Git branch** establish what is implemented there.
- A deployed environment may differ from the selected branch. **Do not equate merged with deployed or tested live.**
- These living documents describe intended behavior, decisions and known state. Update them when implementation or the approved direction changes; do not silently rewrite earlier decisions.
- Historical stage notes explain why a feature exists or how an old migration was performed. They are useful evidence, **not automatically current instructions**.
- When documents disagree: use implemented code to establish actual behavior, this index and `AGENTS.md` for active working rules, and ask for a product decision if a conceptual conflict remains. Report contradictions instead of silently choosing a convenient interpretation.
- `README.md` is a short entry point. Existing `CLAUDE.md` and historical architecture/roadmap files contain older guidance and must be read in light of these documents.

## Updating the documents

Each completed feature or material decision should update only the affected living files:

- Product direction, terminology or permissions -> Product and Principles / Decision Log.
- Shared data model, integration or deployment structure -> Architecture and Boundaries.
- Feature merged, important defect, verification result or pending branch -> Current State.
- Priorities, dependencies or acceptance criteria changed -> Roadmap.
- New standing development rule -> `AGENTS.md`, but keep it concise.

Record an actual date and, where practical, a branch or commit. Distinguish **implemented**, **validated locally**, **deployed to DEV**, **deployed to PROD**, and **planned**. Never imply a test ran unless it did.

## Starting a new ChatGPT or Codex thread

Use this minimal instruction:

> We are continuing Relish. Read `AGENTS.md` and `docs/START_HERE.md`, then the linked living documents, from the latest `development` branch of `BigGuruHere/relationship-os`. Inspect relevant current code before changing anything. Our task is: [describe task].

If the new conversation cannot access GitHub, provide the files or enable the connection. The instruction alone cannot give an assistant access it does not have.

## Historical material

Keep previous stage notes, install notes, migration context and architectural experiments in Git history or `docs/stage-history/`. Many earlier stages are already archived there; additional top-level `STAGE_*.md` files still need a separate link/reference audit before relocation. Do not remove source migrations or delete history to tidy the documentation.
