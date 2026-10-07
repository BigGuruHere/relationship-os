# Stage 8.0 - Code Boundary Map v2

Status: architecture mapping only. No code move is required in Stage 8.0.

## 1. Relish is the migration anchor

All structural evolution happens from the current Relish code/data model.

The old Dorian backend is reference-only and has no compatibility or data-migration requirement.

## 2. Relish - future Core seeds

### Identity

- `prisma/schema.prisma` - `User`, `Contact`, `Company` are current identity/context seeds.
- `Contact.linkedUserId` plus `@@unique([userId, linkedUserId])` is an existing partial identity bridge.
- `src/lib/connections.ts` creates reciprocal Contacts between Relish users and must inform the future Person migration.

Target:

- `User.personId -> Person`
- `Contact.personId -> Person`
- existing `linkedUserId` seeds linked identities during transition and then retires on explicit acceptance criteria.

Do not introduce `Person` as an unrelated second identity graph.

### Relationship intelligence

- `src/lib/server/wants.ts` - strong Want seed, but duplicated with Offer logic and contains Workspace/M&A assumptions.
- `src/lib/server/offers.ts` - strong Offer seed, same consolidation requirement.
- `Interaction` and interaction creation/read routes - future Core Interaction/source pipeline.
- Contact/Company relationship operations - future contextual Relationship assertions.
- `ResearchSource` - provenance/evidence seed.
- enrichment evidence/confidence structures - useful review/provenance patterns.

### Embeddings

Current vector fields on Interaction/Want/Offer/ExchangeItem and related models are sensitive derived information.

Future split:

- private semantic representation - private Core/Workspace use only,
- network match representation - generated only from permission-controlled projection.

## 3. Relish - Want/Offer legacy retirement

Current relevant structures:

- `Want`
- `Offer`
- `ExchangeItem`
- `exchangeItemId` compatibility links/back-pointers
- `src/lib/server/exchange.ts`
- legacy ExchangeItem UI/components if still present

Stage 8.3 is not allowed to add another authoritative intent table while these remain live.

Target default:

- keep canonical Want and Offer,
- extract shared intention service/helpers to remove duplicated implementation,
- migrate remaining ExchangeItem references,
- stop ExchangeItem writes,
- verify no active references need it,
- remove ExchangeItem relations/table/compatibility code.

The final 8.3 design may choose one canonical intention table instead, but only if it replaces Want/Offer rather than coexisting indefinitely.

## 4. Relish - agent platform/runtime

Strong platform seeds:

- `src/lib/server/agents/runtime.ts`
- `src/lib/server/agents/agentLogger.ts`
- `src/lib/server/agents/agentSetup.ts`
- `src/lib/server/agents/modelGateway.ts`
- `src/lib/server/agents/toolRegistry.ts`
- `src/lib/server/agents/types.ts`
- `src/lib/server/agents/agents/*`
- `src/lib/server/agents/tools/*`

Keep:

- AgentDefinition
- AgentPromptVersion
- AgentToolDefinition
- AgentToolPermission
- AgentRun
- AgentStep
- AgentToolCall
- ModelInvocation
- AgentArtifact
- ApprovalRequest
- AgentRunEntity

Important correction:

`toolRegistry.ts` is not currently the only data-access seam. Agent tools and agent implementations contain direct Prisma calls. Stage 8.1 begins introducing a scoped Core repository/data-context for relationship-data reads.

Target direction:

```text
Agent implementation
  -> scoped relationship context/repository
  -> tenant + purpose + entity policy
  -> Core data
```

Direct Prisma can remain for run/audit bookkeeping where it is not bypassing relationship-data policy.

## 5. Relish - approval/staging safety issue for 8.0.1

Current review surfaces contain real gaps that 8.0.1 should fix and test:

- `src/routes/agents/runs/[id]/+page.server.ts` `importCandidate` does not currently require candidate status `APPROVED` before CRM import.
- `applyEnrichment` blocks rejected records but does not make `APPROVED` a strict precondition before applying.
- the generic approval gate creates ApprovalRequest and terminates the tool call; there is no generic resume-and-execute path to test yet.

Correct invariant:

- trust-sensitive staging rows cannot promote into canonical CRM data until explicitly approved,
- rejected rows cannot promote,
- approved promotion executes once.

Low-risk authorised agent writes such as internal Tasks/Artifacts need not be forced through the same staging rule.

## 6. Relish - Workspace ownership

Workspace remains the home for:

- `Task`
- recurring task logic
- `Project`
- `ProjectWorkstream`
- `MarketLead`
- `Deal`
- `DealContact`
- broker-specific stages
- Mission Control and operational views
- human work queues

Representative code:

- `src/lib/server/tasks.ts`
- `src/lib/server/taskRecurrence.ts`
- `src/lib/server/taskLinkSuggestions.ts`
- `src/lib/server/marketLeads.ts`
- project/workstream/deal routes and UI

Workspace may temporarily pause during structural migrations, but live Relish data must remain preserved.

## 7. Introduction and Outcome - move into early Core/Workspace bridge

Stage 8.2 should add the smallest useful Introduction/Outcome representation and a manual Workspace surface.

This is deliberately before PotentialMatch automation.

Purpose:

- capture what introductions are actually being made,
- capture whether they are useful,
- build evidence for later match design and commercial attribution.

## 8. Dorian - reference code only

No old Dorian table is migrated.

### Reusable interface/reference areas

Potentially reusable later:

- `src/controllers/calls/*` transport/orchestration portions
- `src/controllers/communications/*`
- `src/controllers/websockets/*`
- `src/services/elevenLabsService.js`
- `src/services/twilioService.js`
- `src/services/smsService.js`
- persona/prompt/conversation patterns

### Reference-only intelligence experiments

Useful for product learning but not ported as authoritative implementations:

- post-call analysis
- memory profile generation
- Want/Offer extraction
- connection request/matching logic

### Do not preserve/redeploy as-is

The existing Dorian backend is not a production security foundation. Known issues include:

- one shared service bearer token,
- no real per-user authorisation around match endpoints,
- user id accepted from URL paths,
- cross-user matching returning decrypted names/emails,
- inconsistent `agent_domain` enforcement,
- plaintext sensitive fields alongside encrypted variants,
- bearer token logging.

Dorian v2 later uses Relish Core APIs and the future identity/access model. No dual writes and no old Dorian data migration are required.

## 9. Target internal Relish folders

Do not mechanically move every file at once. Build boundaries as services are touched.

```text
src/lib/server/core/
  identity/
  organisations/
  relationships/
  interactions/
  knowledge/
  intentions/
  provenance/
  trust/
  matching/
  introductions/
  outcomes/

src/lib/server/platform/
  agents/
  auth/
  billing/

src/lib/server/workspace/
  tasks/
  projects/
  workstreams/
  leads/
  deals/
```

## 10. Future Dorian API boundary

Only after Core services are stable:

```text
Dorian v2
  -> authenticated Core API
  -> scoped agent principal/purpose
  -> Core repositories/policy
```

Dorian never receives direct Prisma/database access.
