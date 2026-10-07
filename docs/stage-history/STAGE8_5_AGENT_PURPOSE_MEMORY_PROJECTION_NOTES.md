# Stage 8.5 - Agent Purpose, Data Access and MemoryProjection

## Purpose

Stage 8.5 establishes the agent-side read boundary required before consent, disclosure and network matching.

Relish Core remains the source of truth. Agents do not receive their own authoritative profile or memory database. Instead, an agent receives a derived MemoryProjection assembled from the Core records that its current purpose is permitted to read.

## Architecture decisions

### Persona, purpose, deployment and authority are separate

`AgentDefinition` now records:

- `personaKey` - how the agent presents/behaves,
- `purposeKey` - why the agent is accessing relationship data,
- `deploymentScope` - where the agent is deployed,
- `authorityLevel` - the broad level of autonomous authority it has.

These fields do **not** grant tool or data access by themselves.

### Data permission is separate from action permission

Stage 8.5 adds `AgentDataAccessPolicy`.

`AgentToolPermission` continues to answer:

> May this agent execute this tool/action?

`AgentDataAccessPolicy` answers:

> What relationship data may this agent receive for its purpose?

Data-policy defaults fail closed. Unknown/custom agents therefore receive no Core relationship-data access until a policy is explicitly configured.

### MemoryProjection is derived, not persisted

There is deliberately no `MemoryProjection` Prisma model/table.

`buildAgentMemoryProjection()` rebuilds memory from current permitted Core records, including where allowed:

- Workspace Contact representation / canonical Person continuity,
- recent Interactions,
- active KnowledgeClaims,
- Objectives,
- Wants,
- Offers,
- Contact relationships,
- Introductions and Outcomes.

The output explicitly carries:

- `sourceOfTruth: RELISH_CORE`,
- `persisted: false`,
- the agent persona/purpose/deployment/authority snapshot,
- the subject identity bridge,
- only policy-permitted sections.

A deterministic `memorySummary` is generated from those permitted sections for prompt use. It is a projection, not canonical truth. Active Claims without active evidence are marked `[no active evidence]` in that summary rather than being presented without qualification.

### Person does not become a global dossier

The projection uses a workspace Contact as the contextual identity representation when one exists. `Person` remains an identity bridge and does not gain global name/email/profile fields.

A Person-scoped memory projection can include Core Wants/Offers/Claims/Interactions held by the same workspace without requiring a fake Contact. Workspace `userId` remains the custody boundary.

## Existing agent compatibility

The existing `read_entity_context` tool remains available, but Stage 8.5 now requires its reads to pass both:

1. tool permission, and
2. agent data-access policy.

Sections that are not permitted are removed before the context is returned to the agent.

New agent implementations should prefer the new `read_agent_memory` tool for person/contact relationship memory. It assembles permitted sections directly rather than treating a broad CRM context as memory.

## Built-in policies

The built-in agent setup now installs explicit profiles and policies.

Examples:

- Broker Brief Agent - broad internal relationship context, advisory authority.
- Opportunity Scoring Agent - commercial/relationship context but no contact methods or task context.
- Contact Enrichment Agent - identity/contact/company research context only; no private interaction/knowledge memory; propose-only authority.
- Outreach Agent - broader internal relationship context, but existing approval/tool rules still govern outward action.

The policy is separate from approval. A read permission cannot grant an action, and an executable tool cannot bypass a denied data section.

## Workspace inspection

`/agents/memory` is a read-only inspector.

Choose an Agent and Contact to see:

- the agent profile,
- the derived memory summary,
- the exact permitted projection payload.

This is intended to make agent access visible and testable before more sensitive consent/disclosure work arrives.

## Small Person continuity fix

`intentLinkWhere()` now honours `personId` for Wants/Offers. Stage 8.4 added canonical `personId` links, so Stage 8.5 closes the remaining loader/unlink seam needed for Person-scoped memory.

## Migration

Migration:

`20260831210000_stage8_5_agent_purpose_memory_projection`

The migration:

- adds the four AgentDefinition profile fields,
- creates `AgentDataAccessPolicy`,
- backfills known built-in agent profile metadata,
- creates explicit policies for existing AgentDefinitions,
- leaves unknown/custom agents fail-closed.

It contains no relationship-data deletes, no table drops and no column drops.

## Verification

Run:

```bash
npx prisma validate
npx prisma migrate dev
npx prisma generate
npm test
npm run check:stage8.5
```

Expected Core suite: `84 passed / 0 failed`.

The Stage 8.5 integrity check verifies that built-in active agents have explicit purpose/profile metadata, each has a same-tenant data policy, and no persisted `MemoryProjection` table has appeared.

## Manual smoke test

1. Open `/agents` and confirm purpose + authority are visible for built-in agents.
2. Open **Preview memory**.
3. Pick the Broker Brief Agent and a Contact with some Interactions / relationship intelligence.
4. Confirm the projection can include permitted Claims/Objectives/Wants/Offers and recent Interactions.
5. Pick the Opportunity Scoring Agent and confirm contact methods are not present in its projected context.
6. Pick the Contact Enrichment Agent. The memory preview should be limited by its data policy and must not expose private Interactions/Claims/Wants/Offers.
7. Run an existing agent flow to confirm `read_entity_context` still works under the new policy layer.

## Not included

Stage 8.5 does not add:

- Dorian v2,
- consent or DisclosureGrant,
- cross-workspace data access,
- match participation,
- PotentialMatch,
- matchable/network projections,
- network embeddings,
- automated matching.

Those remain downstream. Stage 8.6 is the consent/disclosure foundation.
