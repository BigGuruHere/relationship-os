# Stage 8.7 - Cross-Custody Execution Boundary

## Summary

Stage 8.7 hardens the custody model established in Stage 8.6 without introducing consent, disclosure, matching, or a new end-user workflow.

The concrete issue carried forward from 8.6 was that several existing public-profile and lead flows legitimately affect more than one user's data. Before 8.7, those paths could resolve another owner's default ContextSpace and then query or write contextual records while the initiating request remained inside a different owner's custody.

That was acceptable only as a temporary one-ContextSpace compatibility bridge. It becomes unsafe as soon as a user can have more than one ContextSpace, and it also makes cross-owner behaviour too easy to introduce accidentally.

Stage 8.7 therefore makes cross-custody execution explicit and narrow.

## Architectural decision

The hierarchy remains:

```text
Person = who
User = who owns the environment
ContextSpace = where contextual knowledge is held
```

Stage 8.7 adds one further execution rule:

```text
active Workspace custody
    ↓
may access only that owner + ContextSpace
    ↓
except for a named, target-specific internal cross-custody boundary
```

A cross-custody boundary is system execution authority only.

It is not:

- consent,
- disclosure permission,
- a standing grant,
- permission for an agent to expand its own access,
- permission to match or reveal private data.

Consent/disclosure remains deliberately deferred until a real second-person or cross-ContextSpace case makes the required policy concrete.

## Core changes

### 1. Active custody can no longer resolve another owner implicitly

`contextSpaceIdForOwner(...)` now throws if an active Workspace asks for a different owner's ContextSpace.

Previously, code could do this:

```text
active user A
    ↓
contextSpaceIdForOwner(user B)
    ↓
B's deterministic/default ContextSpace
```

That fallback is removed from active custody.

Same-owner calls still inherit the active ContextSpace. Non-request compatibility scripts may still resolve the deterministic default because they have no active owner to cross from.

### 2. Direct cross-owner Prisma access fails closed

For a context-scoped Prisma model, an active request may not supply another `userId` and have the interceptor silently narrow it to the other owner's default ContextSpace.

A request in:

```text
user A + context A1
```

cannot directly read or write:

```text
user B + any context
```

The caller must enter one of the explicit Stage 8.7 boundaries first.

### 3. Nested custody cannot silently impersonate another owner

`runWithWorkspaceCustody(...)` now checks whether code is already inside an owner's custody.

This is blocked:

```text
runWithWorkspaceCustody(A)
  -> runWithWorkspaceCustody(B)
```

unless the second transition is authorised by the named cross-owner helper.

This prevents an internal caller from treating `runWithWorkspaceCustody` as an unrestricted impersonation primitive.

### 4. Named cross-owner boundary

New helper:

```text
runWithCrossOwnerWorkspaceCustody(...)
```

It requires:

- the active source owner,
- the exact target owner,
- the exact target ContextSpace,
- one recognised reason.

Current reasons are:

```text
PUBLIC_PROFILE_CONNECTION
LEAD_CLAIM
```

The helper enters the target custody only for the callback and restores the source custody afterward.

### 5. Named external-ingress boundary

New helper:

```text
runWithExternalWorkspaceCustody(...)
```

Current reason:

```text
PUBLIC_LEAD_CAPTURE
```

This is for unauthenticated/public ingress where there is no source Workspace owner.

It cannot be invoked from inside an authenticated active Workspace custody context.

### 6. Boundaries are operation-minimised

Entering a named target custody does not grant broad temporary access to the whole target Workspace.

Current policy is:

| Reason | Contextual model | Allowed operations |
| --- | --- | --- |
| `PUBLIC_PROFILE_CONNECTION` | `Contact` | `findFirst`, `create`, `update` |
| `LEAD_CLAIM` | `Contact` | `update` |
| `PUBLIC_LEAD_CAPTURE` | `Contact` | `findFirst`, `create` |

For example, a public-profile connection boundary cannot read a target Want, delete a Contact, or inspect Interactions.

Account-level models such as `Profile`, `Lead`, `InviteToken`, `User`, and `Person` remain governed by their existing rules and are not converted into contextual models by this stage.

Prisma query extensions execute for the top-level operation rather than separately for nested relation writes. Stage 8.7 therefore also rejects nested Prisma write objects inside the permitted cross-custody `Contact.create` and `Contact.update` operations. Current compatibility flows use flat scalar/foreign-key assignments only. This keeps the operation allowlist true in enforcement rather than relying only on the database cross-context triggers to catch unsafe nested relationships.

### 7. Compatibility flows require exactly one destination ContextSpace

New helper:

```text
requireSingleContextSpaceIdForOwner(...)
```

The existing public-profile and lead flows have no user-facing mechanism for selecting a destination ContextSpace.

Therefore Stage 8.7 deliberately permits them only while the destination owner has exactly one ContextSpace.

If zero or more than one ContextSpace exists, the flow fails before writing rather than guessing.

This is the important future behaviour:

```text
one ContextSpace
    -> compatibility flow may continue

two ContextSpaces
    -> stop and require a future explicit invitation/grant/destination design
```

## Existing flows changed

### Public profile connection

Files:

- `src/routes/u/[slug]/+page.server.ts`
- `src/lib/connections.ts`

The logged-in visitor remains inside their own Workspace custody.

The profile owner's Contact representation is created or updated only inside:

```text
PUBLIC_PROFILE_CONNECTION
```

The visitor's own Contact representation is written normally inside the visitor's active custody.

The public-profile page previously checked whether the users were already connected by reading the profile owner's private Contact table from the visitor's request. Stage 8.7 changes this to inspect the visitor's own Contact representation instead.

That answers the same UI question without crossing custody.

### Lead claim

Files:

- `src/lib/leads/link.ts`
- `src/lib/leads/reciprocal.ts`

Authentication lead linking now resolves every prior lead owner's single ContextSpace before any claim state is changed.

For each prior owner, updating that owner's original Contact is done only inside:

```text
LEAD_CLAIM
```

The reciprocal Contact created for the claimant remains in the claimant's active custody and uses only the other user's public Profile fields.

If any prior lead owner already has multiple ContextSpaces, the claim path fails before changing the lead claim state rather than guessing which contextual Contact should be modified.

### Public profile lead capture

File:

- `src/routes/u/[slug]/lead/+page.server.ts`

The profile owner's only ContextSpace is resolved explicitly and Contact create/deduplication runs inside:

```text
PUBLIC_LEAD_CAPTURE
```

### Invite-token lead capture

File:

- `src/routes/api/leads/+server.ts`

This was an additional external-ingress path found during the 8.7 source audit.

It is now governed by the same `PUBLIC_LEAD_CAPTURE` boundary and exact-one-ContextSpace rule.

## No schema migration

Stage 8.7 changes runtime custody enforcement and existing flow wiring only.

There is no Prisma schema change and no new migration.

The two Stage 8.6 migration files remain byte-for-byte unchanged:

```text
20260901073000_stage8_6_context_space_custody_foundation
SHA-256: 05779d38aefa40928c23855fc802c32be0d2af2e58d45899c718f1c01bb39474

20260901165000_stage8_6_context_default_alignment
SHA-256: f6dbf55620904590b5a1f9bef5016c04c9ffc3f070ce5e709db1c86ac3b78000
```

Production therefore requires only the already-existing pending migrations, if production has not yet received 8.6. Stage 8.7 itself adds no migration.

## Tests

New source test:

```text
tests/core/stage8-7-cross-custody-write-boundary.test.ts
```

It behaviourally verifies:

- another owner cannot be resolved implicitly inside active custody,
- direct cross-owner contextual reads fail,
- direct cross-owner contextual creates/updates fail,
- nested `runWithWorkspaceCustody` cannot impersonate another owner,
- named cross-owner transition enters the exact target,
- source custody is restored after the callback,
- transition state does not leak,
- sentinel target ContextSpace is rejected,
- external ingress cannot run inside an authenticated Workspace,
- multiple ContextSpaces cause compatibility destination resolution to fail,
- cross-custody operation policy blocks unrelated model access and destructive operations,
- the public profile checks connection state from the visitor's own Contact table,
- every known cross-owner/public-ingress path is wired through the named boundary.

The complete source-level Core suite passes:

```text
130 passed
0 failed
```

The Stage 8.7 source suite passes:

```text
9 passed
0 failed
```

### Mutation proof

Two new invariants were deliberately weakened during packaging:

1. The nested cross-owner guard in `runWithWorkspaceCustody` was removed.
   - Stage 8.7 test failed on `nested workspace custody cannot silently impersonate another owner`.

2. The exact-one-ContextSpace rule was weakened to allow multiple contexts.
   - Stage 8.7 test failed on `compatibility destination resolution fails closed unless the owner has exactly one ContextSpace`.

The original source was restored after each mutation and the Stage 8.7 suite returned to 9/9 passing.

## Real PostgreSQL verification

New command:

```bash
npm run check:stage8.7
```

Script:

```text
scripts/check-stage8-7-cross-custody.ts
```

It creates temporary users and Contacts and verifies against the real Prisma extension/database that:

- direct cross-owner reads fail,
- direct cross-owner creates fail,
- nested custody impersonation fails,
- a named cross-owner Contact write succeeds only in the target custody,
- that target Contact remains invisible from source custody afterward,
- external Contact ingress succeeds only in the explicit target,
- custody is restored/cleared afterward,
- a second ContextSpace makes compatibility destination resolution fail,
- all temporary verification data is removed.

## Expected visible Workspace behaviour

Normal Workspace use should remain unchanged.

The only affected user-visible flows are existing public profile/lead paths, and their intended behaviour remains the same while every user has one ContextSpace:

- logged-in public-profile connection still creates the mutual connection,
- public lead capture still creates the owner's Contact/Lead,
- invite-token lead capture still creates the owner's Contact,
- lead claiming still links the prior owner's Contact and creates the claimant's reciprocal Contact.

The difference is that these behaviours now have explicit custody boundaries underneath them.

### Multi-ContextSpace testing edge

The fail-closed destination rule is deliberately observable. If you create a durable second ContextSpace on an account, public-profile connection and public/invite lead capture into that account will stop until a future explicit destination/grant mechanism exists. Use a separate single-space account for public-flow regression testing while experimenting with multiple ContextSpaces.

## Retirement path

Stage 8.7 is a compatibility/security boundary, not the intended permanent cross-person sharing model. The named reasons `PUBLIC_PROFILE_CONNECTION`, `LEAD_CLAIM`, and `PUBLIC_LEAD_CAPTURE` identify the concrete flows that a future invitation/grant model should subsume. When that real model exists, these compatibility transitions should be retired rather than becoming a parallel permanent authority system.

## Explicitly not included

Stage 8.7 does not add:

- DisclosureGrant,
- standing consent policies,
- disclosure stages,
- cross-ContextSpace sharing,
- PotentialMatch,
- automated matching,
- match projections,
- ContextSpace switching UI,
- Dorian v2.

## Roadmap correction

The older Stage 8 roadmap had conflicting numbering because ContextSpace was inserted after the first architecture plan.

The canonical roadmap is now:

```text
8.6 ContextSpace custody foundation
8.7 Cross-custody execution boundary
8.8 Consent/disclosure foundation - only when grounded by a real case
8.9 Manual PotentialMatch - only when real manual matching evidence justifies it
8.10 Progressive bilateral disclosure
8.11 Matchable projections
9.0 Controlled network matching
```

Consent and matching remain gated rather than being implemented simply because they have the next number.
