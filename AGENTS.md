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
- Brokerage is a specialised application using shared Contact and Interaction capabilities, not the owner of the underlying CRM.
- Manual Contact capture, QR detail sharing, voice notes, and Dorian are interfaces to reusable relationship capabilities, not competing data systems.
- Each participant controls their self-understanding, observations about others, and views of relationships. Linking identities or connections must not automatically merge or share private information.
- Dorian's permission to reason over relevant information is distinct from permission to disclose that information to another person.

## 3. Security, data and compatibility

- Preserve owner, ContextSpace custody, access, consent, encryption, provenance, and disclosure restrictions. Never use a client-provided context or owner identifier as authority.
- Preserve existing Contact IDs, notes, interactions, legacy Brokerage workflows, and functioning QR/profile flows unless the task explicitly authorises a change.
- Avoid automatic identity matching or merging based solely on names, email addresses, or phone numbers.
- Do not log raw private audio, transcripts, personal data, credentials, or sensitive request payloads.
- Do not perform production writes, deployments, schema migrations, destructive operations, or changes to external services without explicit approval.

## 4. Working practice

- For nontrivial changes, report briefly **Existing capability → Actual gap → Minimum proposed change → Behaviour to preserve** before broad implementation.
- Prioritise the next verified user benefit over speculative future features. Keep architecture extensible without implementing unneeded features.
- **Default Git branch workflow for Codex (unless explicitly instructed otherwise):**
  1. Identify the repository's actual Development branch name and fetch its latest remote state. Do not assume the GitHub default branch is Development.
  2. Create a **new feature branch from the latest remote Development branch** before making code changes. Do not branch from Production or an older feature branch by default.
  3. When the assigned implementation is complete, **automatically commit all intended source, test, and documentation changes to that feature branch and push it to the remote repository**. Do not require a separate instruction to commit or push.
  4. Report the feature branch name, base branch, commit hash, push status, validation results, and any outstanding issues. Do not claim changes are on GitHub until the push succeeds.
  5. **Do not automatically merge** the feature branch into Development or Production, open a production deployment, or change live databases/services. Those steps require separate approval.
  6. Never force-push, discard another person's work, or commit secrets, `.env` files, database exports, or generated local environment artifacts. If branch identity, push access, or a working-tree conflict prevents safe completion, stop the unsafe action and report the blocker.
  7. Read-only investigations and planning tasks must remain read-only: do not create branches, commits, or pushes unless the user specifically requests a persistent artifact or code change.
- Add focused tests, and distinguish previously known failures from new regressions. Do not weaken security tests to make test totals green.
- Explain whether a Prisma migration is required. For local development instructions, include `npx prisma migrate dev` only if that stage introduces a migration; do not prescribe `npm run build` as the user's normal local step.
- Comment non-obvious code and security-sensitive decisions.
- When a material architecture or product decision is accepted, record it in versioned repository documentation and update these instructions only when the standing rule itself changes.
- If a task is small, follow these rules without turning it into a lengthy engineering investigation.
