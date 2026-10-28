# Stage 8.20.4 — Context-Independent Dorian Deployments

**Deliverables:** Two independent complete source packages: (1) Relish / RelationshipOS, based on Stage 8.20.3a, and (2) standalone Agent Management, based on Stage 8.20.3. Stage 8.20.1 Call Recovery, Stage 8.20.2 Consent Continuity and the Stage 8.20.3a Prisma advisory-lock correction are retained.

**Prisma migration required: NO.** This stage deliberately retains the current `AgentProviderBinding.contextSpaceId` foreign key as a *legacy schema anchor* for backward compatibility. The anchor is **not** a conversational scope, a participant identity, or a grant of access to the owner's records. It is chosen server-side on new registrations (prefer the configured owner's General space, otherwise another owned supported space) and preserved unchanged for existing registrations. Eventually making this FK optional may warrant a separate migration, but that is **not** part of this pilot stage.

**New environment variables: NONE.** **Proxy changes: NONE.** **Published prompt updates: NONE.** No existing Dorian binding needs to be deleted, recreated or rotated.

## Architectural contract

1. **Deployment identity**: The ElevenLabs provider ID and existing `AgentProviderBinding` connect to the correct Relish environment and identify the DORIAN agent. The registration API continues to require an environment-specific bearer secret, server-configured owner, exact agent ID and explicit `REGISTER` confirmation.
2. **Conversation context**: Dorian's active ContextSpace comes from a server-validated participant session or, for direct phone calls, the participant-owned provisional phone identity and verified default ContextSpace. A new cold phone caller starts in their own General/Network context. An authorized invitation/pilot entry may select Business or Dating. Unrecognized or unauthorized contexts fail closed.
3. **Privacy**: The deployment owner's historical ContextSpace FK is never used as a fallback to read or store Dorian conversation data. Post-call ingestion requires a matching server-issued participant session and binding. The provider cannot select `userId`, `contextSpaceId` or memory scope through arbitrary dynamic variables.
4. **Call lifecycle**: Consent acceptance, previous-call processing protection, Living Understanding, phone-number provisional continuity, signed post-call webhooks and Stage 8.20.1 Call Recovery retain their existing behaviour. Context switching **during** an in-flight call is **not** introduced: the selected participant ContextSpace is fixed for that session.
5. **Non-Dorian internal agents**: Existing provider binding context and internal agent controls are unchanged.

## Source changes

### Relish

- `src/lib/server/integrations/elevenlabs/dorianDeploymentRegistry.ts`
  - `registerDorianDeployment({environment, agentId})` no longer takes an operator ContextSpace ID.
  - New bindings use a deterministic server-selected, owner-owned legacy FK; existing bindings are reused regardless of their historical ContextSpace if agent ID, environment and owner match.
  - Registration remains serialized and conflict-safe, including the Stage 8.20.3a safe PostgreSQL lock-result query.
  - Status includes `runtimeContextSource: 'PARTICIPANT_SESSION'`, omits historical binding context from the public binding display, and detects a mismatched provider environment.
  - New Dorian definitions list supported pilot domains but do not acquire read/write data-policy permissions. Existing definitions' data permissions are not broadened by registering again.
- `src/lib/server/integrations/elevenlabs/deployment.ts`
  - Provider identity still resolves as before. For **DORIAN only**, the returned deployment `contextSpaceId` and `domainKey` are `null` to prevent treating legacy binding metadata as participant authority. Other agent types retain the existing fields.
- `src/routes/api/webhooks/elevenlabs/initiation/+server.ts`
  - The shared Dorian branch accepts Dorian identity with no deployment-derived context, derives scope from participant credentials, and explicitly refuses a DORIAN binding that is not the configured shared deployment. It cannot fall through to the legacy owner workspace path.
- `src/routes/api/webhooks/elevenlabs/+server.ts`
  - Same security boundary for transcript ingestion. Missing session or mismatched shared Dorian binding prevents import to the deployment owner's workspace. Authorized session supplies the user, context and domain.
- Tests updated/added under `tests/core/`.

### Standalone Agent Management

- `src/ui.mjs`: Removes the *deployment registration* ContextSpace selector and stops displaying a binding's legacy FK. **The Call Preview ContextSpace selector remains**, because selecting a context for previewing the respective instructions is useful and unrelated to binding registration.
- `src/server.mjs`, `src/deployment.mjs`: Register with `{environment, agentId, confirm:'REGISTER'}` without a ContextSpace. The environment is always selected explicitly and validated by Relish.
- Tests under `test/` cover the new request shape and removal of deployment selector.

## Installation and rollout

**Use the updated Relish package with the updated standalone console package.** They are separate Git repositories and Railway services.

1. Save any uncommitted changes in both repositories. Unzip the **complete Relish source** into the **RelationshipOS repository root** (the ZIP contains a `relationship-os-development/` top-level folder; merge its contents, do not create a nested app). Commit and push to the Local/Development branch.
2. Restart Local Relish. No `npx prisma migrate dev`, `npx prisma generate` or local build is required for this stage.
3. Unzip the **complete standalone Agent Management source** into its own `relish-agent-management` repository root. Commit, push and deploy its Railway service. No new console database changes.
4. In the console's **LOCAL** tab, confirm the previously registered binding appears unchanged. The deployment section should **not** ask for a ContextSpace. The Call Preview still offers Network/Business/Dating.
5. Repeat with Railway **DEV** running the new Relish code; ensure the existing Development binding UUID is still displayed. LOCAL and DEV share a Neon Development database but have separate registration tokens and published instructions.
6. Make a new cold direct telephone call routed to DEV, and verify initiation, current-consent procedure, transcript ingestion, post-call LU processing and the caller returning to READY. Then test a returning caller with their authorized default context and, if available, an invitation-based Business or Dating test to verify only that domain's instructions and data are used.
7. **Only after DEV passes**, deploy Relish Stage 8.20.4 to Production. In Agent Management **PROD**, inspect the existing registered binding; do not re-register it unless one is missing. Keep the proxy on Development until you are ready for a controlled Production call. Confirm Production remains isolated to its own Neon database.
8. Make a controlled Production telephone test, inspect logs, consent, transcript, understanding and call recovery. Do not route unsolicited production calls to the new version before validation.

### Example read-only database verification

Run in the intended Neon branch and compare the returned conversation IDs with ElevenLabs and the Relish Conversation Monitor:

```sql
SELECT s."conversationId", s."userId" AS "participantUserId",
       s."contextSpaceId" AS "participantContextSpaceId",
       cs."ownerUserId" AS "contextOwnerUserId", cs."domainKey",
       s."agentBindingId", s."createdAt"
FROM "NetworkDorianSession" s
JOIN "ContextSpace" cs ON cs."id" = s."contextSpaceId"
ORDER BY s."createdAt" DESC LIMIT 25;
```

For every participant-scoped session, `participantUserId` should equal `contextOwnerUserId`. The `agentBindingId` can be the *same* across Network/Business/Dating; it identifies the deployment, **not** the participant's context. The old FK on `AgentProviderBinding` is deliberately not joined here.

To confirm the original provider bindings remain untouched:

```sql
SELECT b."id", b."environment", b."isActive", b."contextSpaceId" AS "legacyAnchorOnly",
       a."key", a."userId" AS "deploymentOwner"
FROM "AgentProviderBinding" b
JOIN "AgentDefinition" a ON a."id" = b."agentDefinitionId"
WHERE a."key" = 'DORIAN' ORDER BY b."createdAt" DESC;
```

**Do not edit or delete any binding/anchor in Neon.** Because the schema's current FK has `onDelete: Cascade`, deleting its owner ContextSpace could delete that binding. This remains a legacy schema constraint and should be revisited in a separate migration only after the runtime scope has been validated.

## Validation status

- **Standalone Console:** `node --test test/*.test.mjs` — 14 passed, 0 failed.
- **Targeted Relish test suites:** `node --experimental-strip-types --test tests/core/stage8-20-3-dorian-deployment-registration.test.mjs tests/core/stage8-20-4-context-independent-dorian.test.mjs tests/core/stage8-15-4-6-shared-dorian.test.mjs tests/core/stage8-15-4-7b-phone-provisional.test.mjs tests/core/stage8-20-1-dorian-recovery.test.mjs tests/core/stage8-20-2-consent-context-continuity.test.mjs` — 31 passed, 0 failed (before final packaging).
- Four changed Relish TypeScript files: syntax/transpilation check passed using TypeScript 5.8.3; **not** a full project typecheck.
- Standalone modified `.mjs` files: `node --check` passed.
- **Not executed here**: complete SvelteKit typecheck/build, connected Neon database integration, live ElevenLabs call. Test locally and in Development before Production cutover.

## Known boundaries / later work

- The required binding ContextSpace FK remains a database schema compatibility anchor; removing it entirely will require a distinct controlled Prisma migration.
- Only the supported pilot domains (`general`, `business`, `dating`) are available for automatic phone-context continuity. Unknown domains fail closed.
- Agent Management Call Preview is an instructional simulation; it does not convey participant data or switch the agent's live context.
- No new within-call ContextSpace switching or automatic cross-context disclosure is enabled.
- Distinct provider agent IDs per environment are still recommended eventually. Shared IDs work while the proxy deliberately routes them to only one Relish environment at a time.
