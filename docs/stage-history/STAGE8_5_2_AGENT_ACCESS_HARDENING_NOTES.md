# Stage 8.5.2 - Agent Access Hardening + Behavioural Isolation Tests

## Why this release exists

Stage 8.5 introduced the correct fail-closed pattern for `MemoryProjection`: the data policy determines the Prisma `select` before a query is made. However, the older `read_entity_context` compatibility path still loaded a broad entity graph and removed disallowed fields afterwards. That meant a newly added or nested field could survive simply because it was not on the deletion list.

Stage 8.5.2 removes that failure mode before ContextSpace and disclosure are built on top of the agent access layer.

This release is built directly from Stage 8.5. Stage 8.5.1 is not included and remains superseded/reinterpreted as a future attention/relevance layer rather than a custody boundary.

## Runtime changes

### `read_entity_context` is now fail-closed before query

The tool key remains for compatibility with current built-in agents, but its implementation has been replaced.

Old path:

```text
broad canonical query
  -> decrypt broad result
  -> filterEntityContextForAgentPolicy
  -> agent
```

Stage 8.5.2 path:

```text
agent data policy
  -> policy-built Prisma select
  -> tenant-scoped Core repository
  -> decrypt only selected fields
  -> agent
```

`filterEntityContextForAgentPolicy` has been deleted.

### Policy-built entity selectors

New pure selectors live in:

- `src/lib/server/core/agentEntitySelection.ts`

They cover:

- Contact
- Company
- Deal
- Project

Denied sections are absent from the Prisma select. Examples:

- no contact-method permission -> encrypted email/phone/LinkedIn fields are not selected
- no interaction permission -> interaction/note relations are not selected
- no task permission -> task relations are not selected
- no relationship permission -> nested counterparties are not selected
- no company/contact/deal permission -> corresponding nested entity relations are not selected

### One secure entity projection

New runtime projection:

- `src/lib/server/core/agentEntityProjection.ts`

It preserves the existing compact agent-facing entity shapes where access is permitted, while moving the security decision before the read.

### Shared tenant-scoped repository primitive

New:

- `src/lib/server/core/scopedRepository.ts`

Production Core repository functions now use one dependency-injectable scoped primitive that always constructs tenant-owned canonical lookups as:

```text
id + workspaceUserId
```

The repository now also exposes scoped lookups for Want, Offer, Objective and KnowledgeClaim so later Core work can use the same invariant instead of introducing another access pattern.

Shared Person remains the exception: Person accessibility is still resolved through a workspace-owned User or Contact, as designed in 8.1.

## Tests

### Behavioural unit tests

New test:

- `tests/core/stage8-5-2-agent-access-hardening.test.ts`

Unlike the earlier source-text checks, these tests execute the real policy selector functions and the real scoped repository primitive.

They verify, among other things:

- denied contact methods are absent before the query
- nested Deal counterparty methods are absent before the query
- denied relationship arrays are not queried
- Project-linked counterparties are not queried when relationship access is denied
- identity denial cannot accidentally leak a newly added top-level Deal field
- user A can read user A's record
- user B cannot read user A's record
- the same tenant predicate protects Want and KnowledgeClaim reads

### Mutation verification

During packaging, the `userId` predicate was deliberately removed from `scopedEntityWhere` once. The new behavioural suite correctly failed its Contact and Want/KnowledgeClaim isolation tests. The predicate was restored and the tests returned green.

This verifies the tenant-isolation tests actually detect the failure they claim to protect.

### Real database isolation check

New command:

```bash
npm run check:stage8.5.2
```

This uses the actual Prisma/PostgreSQL repository path. It creates two temporary Users plus isolated Contact/Want/KnowledgeClaim rows inside one transaction, verifies cross-tenant reads return no record, then removes the test Users before the transaction commits.

If any assertion or database operation fails, Prisma rolls back the transaction automatically.

No test rows should remain after a successful or failed transaction.

## Retirement register

The retirement register now explicitly records completion of the broad-read/post-query-filter authority:

- old authority: `read_entity_context` broad reads + `filterEntityContextForAgentPolicy`
- replacement: policy-built pre-query Core entity projection
- filter removal: completed in 8.5.2

The `read_entity_context` **tool name** remains temporarily because existing built-in agents call it. The unsafe implementation does not.

## Database / migration impact

There is **no Prisma schema change and no migration** in Stage 8.5.2.

Stage 8.5.2 does not include the Stage 8.5.1 migration.

Do not run `prisma migrate dev` for this release solely because of 8.5.2.

## Validation completed during packaging

- 94 Core tests discovered
- 94 passed using Node 22 TypeScript type stripping
- new behavioural hardening tests: 10/10 passed
- mutation check: deliberately broken tenant predicate made the suite fail as expected
- restored predicate: suite returned green
- changed TypeScript files passed syntax checks
- no `filterEntityContextForAgentPolicy` references remain in runtime source
- Prisma schema unchanged from 8.5
- package-lock unchanged from 8.5

The real PostgreSQL isolation command cannot be run in the packaging sandbox because it has no access to your Neon database. Run `npm run check:stage8.5.2` locally against development.

## Manual smoke test

After local tests, run the same built-in agent workflows you used in 8.5:

1. Broker Brief on a Contact
2. Opportunity Scoring on the same Contact
3. Contact Enrichment on a Contact and Company
4. Any existing Deal/Company/Project agent read you commonly use

The expected output shape should remain compatible. The change is that disallowed data is no longer queried first and stripped later.

## Next stage

Stage 8.6 should introduce the structural ContextSpace custody primitive, still with:

- one default ContextSpace per existing User
- no cross-context grants
- no disclosure workflow
- no matching
- no requirement to install Stage 8.5.1 first
