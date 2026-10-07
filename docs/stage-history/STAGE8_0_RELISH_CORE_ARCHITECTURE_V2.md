# Stage 8.0 - Relish Core Architecture Contract v2

Status: final architecture-definition release. No Prisma schema change. No migration. No runtime behaviour change.

## 1. Purpose

Relish is evolving from a tenant-scoped relationship CRM / M&A operating workspace into a relationship intelligence platform whose central purpose is to help humans and agents create valuable connections safely.

The future platform must support:

- Relish Workspace as the human operating environment,
- future public-facing agents such as Dorian,
- multiple specialised agents with different purposes and access scopes,
- relationship memory built from evidence rather than undifferentiated summaries,
- persistent Wants and Offers,
- matching within a workspace and eventually across a permitted network,
- progressive bilateral disclosure,
- explicit consent before selected information or identities are shared,
- introduction and outcome history so the system learns whether connections create value,
- domain-specific use cases such as M&A, professional networking, careers, mentoring and potentially dating without making any one domain the Core ontology.

Stage 8.0 defines the architecture before any Stage 8 schema change is made.

## 2. Migration anchor

There is one migration anchor: the current Relish database and Relish codebase.

### Relish

Relish contains live data that must be preserved. All Stage 8 database work must therefore be safe, forward, explicit and verifiable.

Data continuity is mandatory.

Relish Workspace continuity is desirable, but the Workspace may be temporarily paused during a structural migration if that materially reduces compatibility debt. A short Workspace pause is preferable to leaving duplicate domain models alive indefinitely.

### Dorian

The existing Dorian application is not in active use and contains no data that needs to be migrated.

The old Dorian backend is therefore reference material only. It does not need to remain runnable through the Stage 8 transition and will not receive compatibility migrations or dual-write support.

Useful Dorian concepts and code patterns may be reused later, particularly:

- ElevenLabs / voice integration,
- Twilio and SMS transport,
- realtime conversation handling,
- persona and conversational orchestration,
- Want/Offer extraction experiments,
- memory experiments,
- network matching experiments.

The current Dorian backend must not be treated as a production security or data-authority model. If Dorian returns later, it should be Dorian v2 built against Relish Core APIs.

## 3. Target product architecture

The target system has three surfaces over one shared Core:

1. **Relish Core** - identity, relationship intelligence, provenance, intent, trust, matching, introductions and outcomes.
2. **Agent Interfaces** - Dorian and future specialised conversational agents.
3. **Relish Workspace** - human CRM/operations, tasks, projects, workstreams, leads, deals, review queues and commercial workflows.

Trust, context and policy live inside the Core boundary initially. They are not a separate service.

```text
                         RELISH CORE
          identity + knowledge + intent + trust + network
                              |
               --------------------------------
               |                              |
        RELISH WORKSPACE                AGENT INTERFACES
        human operations                 Dorian v2 later
```

### Dependency rule

Workspace and agent interfaces may depend on Core.

Core must not depend on:

- Tasks,
- Projects,
- Workstreams,
- Market Leads,
- Deals,
- broker pipeline stages,
- Dorian telephony or avatar code.

## 4. Hard migration rule - replacement must retire something

Stage 8 must not repeat the `ExchangeItem` pattern where an abstraction is replaced but remains live in the schema indefinitely.

Every new Core representation of an existing concept must name:

1. the current structure it replaces,
2. the release in which writes move to the replacement,
3. the release in which compatibility reads end,
4. the acceptance criteria for removal,
5. the final retirement release.

A migration is not complete merely because the new model exists. It is complete when the previous authority has been removed or intentionally reclassified as permanent historical data.

No new Core abstraction may create a third live representation of the same concept without an explicit temporary migration reason and retirement deadline.

## 5. Core principles

### 5.1 Shared identity, contextual knowledge

A future `Person` represents a human identity. A workspace `Contact` represents how one workspace knows or works with that person.

Core must not collapse all statements about a Person into one global dossier. Important relationship knowledge carries context and provenance: who supplied it, who captured it, the source, authority, confidence and permitted use.

### 5.2 Existing tenant isolation remains authoritative during transition

Current `userId` tenant boundaries remain in place until a deliberate Workspace model replaces or subsumes them.

Introducing `Person` must not make one user's Contact, Want, Offer or Interaction readable by another user.

Cross-network matching must eventually compare permitted projections, not raw tenant records.

### 5.3 Subject, custodian and authority are different

Example: a Relish Workspace records that Eric wants to acquire an RTO.

- Subject: Eric.
- Custodian/context: the Workspace that recorded it.
- Authority: third-party reported.

If Eric later tells an authorised agent directly, that becomes separate self-declared evidence that can confirm, refine or contradict the existing record.

A record about a person is not automatically owned, approved or externally shareable by that person.

### 5.4 Provenance and confidence are different axes

`Confidence` answers: how certain are we?

`Authority/provenance` answers: where did this come from and what right do we have to treat it as a statement by the subject?

Target authority classes should support at least:

- SELF_DECLARED,
- THIRD_PARTY_REPORTED,
- PUBLIC_SOURCE,
- INFERRED,
- SYSTEM_DERIVED.

A high-confidence inference is still an inference.

### 5.5 Meaning is primary; operational work is downstream

Core models relationship reality:

- identity,
- organisations and relationships,
- interactions,
- objectives,
- Wants,
- Offers/capabilities,
- constraints/preferences,
- intent,
- provenance,
- permissions,
- introductions,
- outcomes,
- matches later.

Workspace models operational work around that reality:

- tasks and recurring tasks,
- projects and workstreams,
- market leads,
- deals,
- broker pipelines,
- review queues,
- commercial follow-up.

### 5.6 Memory is a projection, not canonical truth

Long-term agent memory should be derived from permitted Core records such as interactions, claims, objectives, Wants/Offers, relationships and outcomes.

A memory summary is a prompt projection. It is not the database's source of truth.

### 5.7 Agent data access must be enforceable, not conventional

Agents must not depend on developers remembering to put `userId` or `agent_domain` in each Prisma query.

The target access path for relationship data is:

```text
Agent
  -> scoped Core repository / data context
  -> purpose + workspace + subject policy
  -> authorised Core data
```

The repository must make unscoped relationship reads difficult or impossible to express.

Current direct Prisma usage in the agent codebase is transitional technical debt. Agent audit/run bookkeeping may remain direct where appropriate, but relationship-data reads should progressively move behind scoped repositories starting in Stage 8.1.

### 5.8 Access, computational use, disclosure and action are separate

For sensitive relationship intelligence, Core distinguishes:

1. **Custody** - which context governs the record?
2. **Read access** - who may see the underlying record?
3. **Computational use** - may an approved projection participate in matching without exposing the raw record?
4. **Disclosure/action** - what may be revealed or acted on, to whom, for what purpose and at what stage?

### 5.9 Matching does not imply disclosure

Core may determine that two parties could be compatible before either party knows the identity or private details of the other.

Target flow:

`Private knowledge -> permitted match projection -> PotentialMatch -> consent/disclosure -> introduction -> outcome -> learning`

### 5.10 Disclosure is bilateral and match-specific

A source Want/Offer can remain private while a particular recipient receives a specific disclosure grant.

A grant may expose only selected facts. Different recipients may be at different disclosure stages.

Disclosure may be asymmetric where the domain requires it.

### 5.11 Consent is both policy-based and event-based

Core should eventually support:

- standing/default sharing rules,
- recipient-specific grants,
- match-specific grants,
- explicit introduction permission,
- revocation.

Consent evidence should retain the source interaction or action, scope, recipient/audience, purpose, date and interpreted permission.

An agent may ask conversationally, for example:

"Are you happy for me to tell this person that you are looking for an education business in Melbourne in the $10m-$30m range?"

The answer can become a specific grant without making the entire Want globally shareable.

### 5.12 Embeddings are sensitive derived information

Application-encrypted text does not make its derived vector embedding non-sensitive.

Current Relish vector columns must be treated as sensitive derived data. Stage 8 must not describe records containing embeddings as fully application-encrypted at rest without qualification.

For future network matching:

- the network-searchable embedding must be derived from a permission-controlled match projection,
- raw private descriptions must not automatically become network-searchable,
- private semantic-search embeddings, if retained, remain inside the private workspace/Core context and are governed as sensitive data,
- highly sensitive contexts may later choose ephemeral or minimised embeddings rather than persistent raw semantic representations.

### 5.13 Match infrastructure is domain-neutral; matching logic is domain-specific

Core can share:

- participants,
- match lifecycle,
- permissions,
- disclosure stages,
- introductions,
- outcomes,
- feedback.

The scoring model must be domain-specific.

Examples:

- M&A: sector, geography, value, strategic fit, capacity, timing.
- Careers/recruitment: role, skills, seniority, location, constraints.
- Dating: reciprocal intent, explicit preferences/deal-breakers, location, life stage and other permitted factors.

The architecture may support many domains. That is not a business decision to build them all.

## 6. Identity decision - `Person` must subsume the existing bridge

Stage 8.1 must not add a second unrelated identity mechanism beside `Contact.linkedUserId`.

Current Relish already contains a partial identity bridge:

- `Contact.linkedUserId`,
- `@@unique([userId, linkedUserId])`,
- reciprocal Contact creation in `src/lib/connections.ts`,
- invite/claim flows linking external participation to Relish users.

The target direction is:

```text
Person
  ^
  |
User.personId

Person
  ^
  |
Contact.personId
```

For an existing linked Contact, Stage 8.1 can use the linked Relish User as strong evidence for the Person bridge.

`linkedUserId` remains temporarily for compatibility, but it receives a named retirement path. It must not become a second permanent identity graph beside `Person`.

Identity resolution across unlinked Contacts must be explicit and reviewable. Matching email/phone is evidence of identity, not permission to merge private knowledge or expose cross-workspace data.

## 7. Want/Offer consolidation decision

Stage 8.3 is a consolidation release, not an additive release.

Current live representations include:

- first-class `Want`,
- first-class `Offer`,
- legacy `ExchangeItem` and its remaining foreign keys/back-pointers.

Stage 8.3 must choose one canonical Core representation and retire `ExchangeItem` as an authoritative live model.

The decision between:

- separate canonical Want + Offer models with shared implementation, or
- one canonical intention model with a direction/type,

will be made from actual Stage 8.0/8.2 requirements before 8.3 coding.

The current default recommendation is to keep Want and Offer as distinct canonical domain concepts, factor their highly duplicated service logic into shared Core intention infrastructure, migrate all remaining ExchangeItem references, then remove ExchangeItem and compatibility code.

Do not create a new `CoreIntent` table while leaving all three current representations alive.

## 8. Introduction and Outcome move earlier

Introduction and Outcome are not merely post-matching features. They are the system's evidence about whether connecting people creates value.

A minimal first-class form should be introduced early, before automated matching.

Initial Introduction needs only enough information to record:

- parties,
- initiator/facilitator,
- reason/context,
- date,
- status,
- source/evidence.

Initial Outcome needs only enough to record:

- introduction,
- result/status,
- usefulness or continuation where known,
- commercial or non-commercial result where known,
- notes/evidence,
- date/source.

This data should be captured manually in Workspace before the matching engine is designed so later `PotentialMatch` design is informed by real introductions and outcomes.

## 9. Dorian reference-only rule

There is no Dorian data migration stage.

The old Dorian database tables are not part of the Stage 8 migration graph.

The old codebase is retained only as reference for product behaviour and selected interface/transport implementation.

Known reasons it must not be redeployed unchanged include:

- service-wide bearer-token authentication rather than real per-user authorisation,
- match routes taking user identity from the URL,
- cross-user matching returning decrypted identity/contact data,
- inconsistent `agent_domain` isolation,
- plaintext sensitive fields existing alongside encrypted fields,
- bearer token logging in middleware.

Dorian v2, when prioritised, should authenticate against the future Core/Platform model and use scoped Core APIs. No effort is spent preserving compatibility with the old Dorian backend.

## 10. Relish agent/runtime direction

Relish's agent runtime is a strong seed for:

- agent definitions,
- prompts,
- tool definitions,
- run/step/tool/model audit logs,
- artefacts,
- approval records.

However, action/tool permission is not the same as relationship-data access permission.

Stage 8.1 begins the scoped repository/data-context boundary for agent relationship reads.

Agent writes are classified by risk rather than universally forbidden:

- low-risk operational writes may be directly authorised, such as creating an internal Task or Artifact,
- staging writes may create ResearchCandidate, ContactEnrichment or similar proposals,
- trust-sensitive promotion into canonical relationship data, identity changes, disclosure grants and introductions require the appropriate human/user authority.

## 11. Stage 8.0.1 safety harness contract

Stage 8.0 itself changes no runtime code. The immediately following Stage 8.0.1 should establish tests around the current live Relish trust boundaries before schema refactoring.

Minimum tests/fixes:

### Encryption

- encrypt/decrypt round-trip,
- deterministic equality index repeatability,
- different values produce different deterministic indexes,
- corrupted/tampered ciphertext fails safely,
- null/empty behaviour is explicit.

### Tenant isolation

Representative tests prove one Relish user cannot read/update/delete another user's Contact/Want/Offer/Interaction through the tested repository/actions.

### Agent approval/staging

Lock down the behaviour that actually exists today:

- approval-required tool creates a pending ApprovalRequest and does not execute the protected tool,
- unapproved ResearchCandidate cannot be imported into canonical CRM records,
- unapproved ContactEnrichment cannot be applied,
- rejected staging records cannot be promoted,
- approved promotion executes once.

Do not test a generic "approve then resume the suspended tool call" flow until such a resume mechanism actually exists.

## 12. Proposed target concepts

These are architecture concepts, not a requirement that every item become a Prisma model.

### Identity/context

- Person
- account/User -> Person link
- Organisation
- Workspace
- WorkspacePerson (existing Contact is the starting representation)
- WorkspaceOrganisation (existing Company is the starting representation)

### Relationship intelligence

- Relationship
- Interaction
- KnowledgeClaim
- Objective
- Want
- Offer
- Provenance/authority
- intent strength as structured metadata
- constraints/preferences as structured metadata initially

### Agent/platform views

- Agent persona
- Agent purpose
- Agent deployment/authority
- Scoped Core repository/data context
- MemoryProjection

### Trust/governance

- access policy / effective access rules
- disclosure grant
- matching participation
- introduction permission

### Network/value loop

- Introduction - early
- Outcome - early
- PotentialMatch - later
- MatchParticipant - later
- matchable projection - later
- Feedback - later
- commercial attribution - later

### Workspace operations

- Task
- Project
- ProjectWorkstream
- MarketLead
- Deal
- reminders and operational notes

## 13. First-class now vs later

### Early Stage 8 candidates

- Person identity bridge
- User/Contact -> Person mapping
- scoped agent relationship-data repository
- provenance/authority support
- minimal Introduction
- minimal Outcome
- canonical Want/Offer consolidation

### Before network matching is enabled

- disclosure grants
- match participation
- PotentialMatch / MatchParticipant
- introduction permission progression
- matchable projections
- network embeddings

### Attributes/derived views initially

- intent strength
- timing
- constraints/preferences
- emotion/interaction state
- relationship sentiment
- memory summary
- match explanation

## 14. Workspace preservation rule

Existing Relish data is never reset to accomplish Stage 8.

Structural changes use forward migrations, explicit data backfills, verification queries and named retirement steps.

Workspace may be deliberately paused during a high-leverage structural release if doing so lets us remove obsolete compatibility paths in the same or next release.

The following remain Workspace/domain concerns:

- Tasks and recurring Tasks,
- Projects and Workstreams,
- Market Leads,
- Deals and DealContact stages,
- broker-specific process/confidentiality stages,
- human work queues,
- commercial follow-up.

## 15. Target internal code boundary

Do not create a Core microservice yet.

Target logical structure inside the current Relish application:

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

Dorian v2 later accesses Core through a controlled API boundary. It never receives direct Prisma/database access.

## 16. Revised release sequence

### 8.0 - Architecture Contract v2

Documentation only. This release.

### 8.0.1 - Relish Trust Safety Harness

Tests and small fixes only around encryption, tenant isolation and staging/approval promotion rules.

### 8.1 - Identity + agent access foundation

- Person,
- User -> Person,
- Contact -> Person,
- use existing linkedUserId relationships to seed bridges,
- keep `Contact.userId` tenant boundary,
- begin scoped repository/data-context for agent relationship reads,
- no global Contact merging.

### 8.2 - Provenance + minimal Introduction/Outcome

- explicit authority/source for important relationship intelligence,
- distinguish self-declared, third-party, public and inferred,
- begin manually recording real introductions and outcomes in Workspace.

### 8.3 - Want/Offer consolidation

- choose canonical representation,
- factor duplicated intent logic,
- migrate all real Relish data safely,
- remove remaining ExchangeItem authority/references on named acceptance criteria,
- no automated matching.

### 8.4 - Common Interaction/Knowledge pipeline

- common source/interaction ingestion,
- claims/evidence reconciliation,
- structured updates to objectives/Wants/Offers,
- notes remain evidence/operations rather than truth.

### 8.5 - Agent purpose/access + memory projection

- formalise persona/purpose/deployment/authority,
- all relationship-data reads move toward scoped Core context,
- derive agent memory from permitted Core records.

### 8.6 - ContextSpace custody foundation

- explicit custody/trust context separate from User ownership,
- one deterministic default ContextSpace for existing users,
- contextual Core records scoped by owner + ContextSpace,
- database and Prisma fail-closed isolation,
- no consent/disclosure or matching.

### 8.7 - Cross-custody execution boundary

- active custody cannot implicitly resolve or query another owner's ContextSpace,
- nested custody cannot silently impersonate another owner,
- existing cross-owner/public-ingress flows use named target-specific execution boundaries,
- each boundary is operation-minimised,
- compatibility flows fail closed once an owner has more than one ContextSpace.

This stage is system execution authority only. It is not consent, disclosure permission or a standing grant.

### 8.8 - Selected lead batch import + external company identity

- deliberately selected CSV slices become active MarketLeads, not a wholesale copy of the source market database,
- custom LeadSource is the first-stage batch/calling-list label,
- CompanyExternalIdentifier provides stable, context-scoped source/code identity across later batches,
- imported AI research is append-only MarketLeadNote history and may be surfaced through the linked Company,
- re-importing the same Company in the same batch is idempotent; a later batch may create a fresh MarketLead,
- deterministic import infrastructure comes before agent-driven selection/import.

### 8.9 - Consent/disclosure foundation - gated by real use

When a real second-person or cross-ContextSpace case exists:

- standing policies plus specific grants,
- recipient/purpose/stage scope,
- source consent evidence and revocation.

### 8.10 - Manual PotentialMatch - gated by real use

- PotentialMatch + participants,
- domain/policy version,
- manual first,
- learn from existing Introduction/Outcome history.

### 8.11 - Progressive bilateral disclosure

- per-side disclosure state,
- match-specific grants,
- explicit introduction permission,
- conversational consent requests supported by future agents.

### 8.12 - Matchable projections

- explicit matching participation scope,
- permission-minimised projection,
- separate network embedding,
- raw tenant data remains private.

### 9.0 - Controlled network matching

- matcher receives permitted projections only,
- no raw cross-workspace record access,
- no identity disclosure without grant,
- purpose/domain-specific matching policies.

### Dorian v2 - unscheduled

Dorian returns when commercially/product-wise useful, against stable Core APIs. It is not a gating milestone for Core or Workspace evolution.

### 9.x - learning and commercial attribution

- match quality/outcome learning,
- attribution of originator, agent, facilitator and economic outcome where useful.

## 17. Acceptance criteria for Stage 8.0 v2

Stage 8.0 v2 is complete when:

- Relish is explicitly the sole live-data migration anchor,
- old Dorian is explicitly reference-only with no data migration requirement,
- every new Core concept must name what it replaces and when the predecessor retires,
- Person architecture explicitly subsumes `linkedUserId` rather than duplicating it,
- ExchangeItem has a named consolidation/retirement release,
- provenance/authority is separate from confidence,
- embeddings are classified as sensitive derived information,
- agent relationship-data access is planned as an enforceable scoped repository boundary beginning in 8.1,
- Introduction and Outcome are moved forward before automated matching,
- current Relish tenant isolation remains authoritative until deliberately replaced,
- cross-network matching is designed over permitted projections rather than tenant data,
- staged, recipient-specific consent/disclosure remains a first-class future capability,
- no Prisma/schema/runtime change occurs in 8.0 itself.
