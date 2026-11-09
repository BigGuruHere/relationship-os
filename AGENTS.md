# Relish: Repository Development Rules

These are standing instructions for changes to Relish. Apply them across ChatGPT-assisted work, Codex, and other coding agents. Follow existing repository instructions too. If a rule conflicts with established implementation or security requirements, explain the conflict before changing anything.

**Before nontrivial new work:** read [`docs/START_HERE.md`](docs/START_HERE.md) and the relevant living documents there. Historical stage notes, older README/CLAUDE descriptions, and previously named "canonical" roadmaps may be outdated. Inspect the latest actual code and tests. For small edits, consult only the relevant sections rather than performing a full audit.

## 1. Reuse before building (mandatory)

Before implementing a feature or change:

1. **Find what already exists.** Inspect relevant screens, routes, backend services, database models, integrations, tests, and earlier implementations. Do not assume a capability is missing because it is not exposed in the current interface.
2. **Classify the task.** Is it (a) connecting existing capabilities, (b) improving or simplifying an existing capability, or (c) creating a genuinely new capability?
3. **Identify the actual gap.** State what exists, what is missing, and what will be reused. For a small, obvious fix, keep this check brief; do not require a long audit.
4. **Prefer the smallest safe change.** Reuse or adapt existing functionality before creating new pages, forms, API endpoints, services, database models, or workflows. Do not create parallel implementations without a demonstrated need and explicit approval.
5. **Preserve working behaviour.** Identify what must not change and verify that the proposed work does not unintentionally replace or break existing functionality.

A request to add a user-facing step is **not** automatically a request to build a new page. First check whether an existing experience needs only a new connection to shared services.

## 2. Relish product and architecture

- Relish helps people build and develop valuable human-to-human relationships. Dorian assists; he does not replace the relationship.
- **People do not belong exclusively to contexts. Information and interactions have contexts.** Aim for one owner-private People experience, with appropriately scoped relationship information.
- A private Contact, a Person identity reference, a Relish User account, and a mutually acknowledged Connection are distinct. Do not equate or automatically create them.
- Contacts may exist without a specialised relationship classification or Relish account. Preserve capture origin separately from relationship context.
- Brokerage is maintained on the separate broker-relish deployment. Design Relish without Brokerage requirements. Before removing old Brokerage code or schema from Relish, confirm the separate deployment and the dependencies of shared Relish features. Preserve data until a separate authorised cleanup.
- Manual Contact capture, QR detail sharing, voice notes, and Dorian are interfaces to reusable relationship capabilities, not competing data systems.
- Each participant controls their self-understanding, observations about others, and views of relationships. Linking identities or connections must not automatically merge or share private information.
- Dorian's permission to reason over relevant information is distinct from permission to disclose that information to another person.
- People, relationships and groups can be subjects of understanding. Keep subject, perspective, custody and permission distinct; a relationship reference or participation does not imply mutual acknowledgement or shared access.

## 3. Security, data and compatibility

- Preserve owner, ContextSpace custody, access, consent, encryption, provenance, and disclosure restrictions. Never use a client-provided context or owner identifier as authority.
- Preserve existing Contact IDs, notes, interactions, legacy Brokerage workflows, and functioning QR/profile flows unless the task explicitly authorises a change.
- Avoid automatic identity matching or merging based solely on names, email addresses, or phone numbers.
- Do not log raw private audio, transcripts, personal data, credentials, or sensitive request payloads.
- Do not perform production writes, deployments, schema migrations, destructive operations, or changes to external services without explicit approval.

## 4. Working practice

- Lead each next-stage proposal with a recommendation of GPT-6.1 Sol Medium, GPT-6.1 Sol High or GPT-6 Astra Medium and a short reason tied to the work.

- For nontrivial changes, report briefly **Existing capability → Actual gap → Minimum proposed change → Behaviour to preserve** before broad implementation.
- Prioritise the next verified user benefit over speculative future features. Keep architecture extensible without implementing unneeded features.
- **Default Git branch workflow for Codex (unless explicitly instructed otherwise):**
  1. Identify the repository's actual Development branch name and fetch its latest remote state. Do not assume the GitHub default branch is Development.
  2. Create a **new feature branch from the latest remote Development branch** before making code changes. Do not branch from Production or an older feature branch by default.
  3. When the assigned implementation is complete, **automatically commit all intended source, test, and documentation changes to that feature branch and push it to the remote repository**. Do not require a separate instruction to commit or push.
  4. For each delivered implementation stage, open or reuse a pull request into the Development branch after pushing. Include a clickable pull request link in the chat handoff, along with the branch, base, commit hash, validation results and outstanding issues. Do not claim changes are on GitHub until publication succeeds.
  5. **Do not automatically merge** the feature branch into Development or Production, open a production deployment, or change live databases/services. Those steps require separate approval.
  6. Never force-push, discard another person's work, or commit secrets, `.env` files, database exports, or generated local environment artifacts. If branch identity, push access, or a working-tree conflict prevents safe completion, stop the unsafe action and report the blocker.
  7. Read-only investigations and planning tasks must remain read-only: do not create branches, commits, or pushes unless the user specifically requests a persistent artifact or code change.
### Protect concurrent and recent changes

- Before modifying an existing file, inspect its latest version on the branch being edited. Never rely solely on code retained from an earlier conversation, task or cached copy.
- Before committing or pushing, verify that the target branch has not advanced unexpectedly and reconcile any new changes.
- Never silently overwrite, revert or discard changes made by the user or another agent.
- If current code differs materially from earlier assumptions, reassess the proposed change. If the difference creates a conflict or uncertainty, report it rather than making an arbitrary choice.
- Inspect only the files and dependencies relevant to the task. A full repository audit is not required for minor changes.

- Add focused tests, and distinguish previously known failures from new regressions. Do not weaken security tests to make test totals green.
- Explain whether a Prisma migration is required. For local development instructions, include `npx prisma migrate dev` only if that stage introduces a migration; do not prescribe `npm run build` as the user's normal local step.
- Comment non-obvious code and security-sensitive decisions.
- When a material architecture or product decision is accepted, record it in versioned repository documentation and update these instructions only when the standing rule itself changes.
- If a task is small, follow these rules without turning it into a lengthy engineering investigation.

## 5. Living documentation maintenance (mandatory)

The living documents referenced in [`docs/START_HERE.md`](docs/START_HERE.md) are the ongoing source of project context for ChatGPT, Codex and other development agents.

For each completed development task:

1. Determine whether the change affects product vision, architecture, implementation status, roadmap or established decisions.
2. Update the relevant living documents as part of the **same feature branch and commit** as the associated work, where feasible. Do not leave important documentation to a separate future task.
3. Update `docs/CURRENT_STATE.md` when a significant feature is implemented, verified, merged or deployed, or when its status materially changes. Describe the actual status at the time of writing: a feature-branch commit is **not** a merge or deployment.
4. Update `docs/ROADMAP.md` when priorities, dependencies or planned functionality change.
5. Update `docs/DECISION_LOG.md` when a significant product or architectural decision is accepted, revised or superseded. Preserve the history of earlier decisions.
6. Update `docs/ARCHITECTURE_AND_BOUNDARIES.md` when architectural responsibilities, integrations, data models or security boundaries materially change.
7. Update `docs/PRODUCT_AND_PRINCIPLES.md` when enduring vision, product principles or the conceptual model changes.
8. Update `AGENTS.md` only when standing development rules change.

Do not rewrite living documents unnecessarily for minor UI changes or straightforward bug fixes. Keep them concise, accurate and easy for a new contributor or assistant to read.

Distinguish **planned**, **implemented on a feature branch**, **tested**, **merged into Development**, **deployed to DEV**, and **deployed to PROD**. Never claim that unverified behavior is working, or that a branch was merged or deployed when it was only committed.

Include the relevant documentation changes in the same feature branch and push them with its implementation. If later merge or deployment changes the status, update `docs/CURRENT_STATE.md` as part of that subsequent integration or deployment workflow.

For foundation work, update the relevant backlog item and stage register in `docs/foundation/IMPLEMENTATION_PLAN.md` in the same PR. Include acceptance evidence, migration/rollback implications and actual cohort/environment status. Update the integration status on merge and the deployed commit and verification evidence on deployment. A stage is not complete merely because its code is committed.

Keep historical development notes available for reference. They must not override current living documentation or verified code behavior.

**Goal:** a new ChatGPT or Codex session can understand Relish's current vision, architecture, implementation and forward plan without a lengthy bootstrap prompt.
