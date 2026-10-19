# Stage 8.15.4.6c - Agent Gateway and Administration Architecture Audit

Status: audit and implementation specification only. No runtime application changes. No database migration.
Baseline: Relish Stage 8.15.4.6b; original `proxy_server_ai_app-development.zip` reviewed as reference (not shipped into Relish).

## Executive decision

Preserve the operator's one-setting workflow: choose Local, Development, or Production on an agent configuration and have ALL its ElevenLabs backend callbacks go to the selected destination. Implement it via an independently deployed, stable-URL gateway with configuration managed in Relish. DO NOT use the original proxy unchanged. Keep the routing selection distinct from the `AgentProviderBinding.environment` metadata (which describes the provider deployment rather than a live callback destination).

### What is already implemented in Relish

- `AgentDefinition` in `prisma/schema.prisma` provides stable Relish agent identity, data scope, purpose and permissions, with user-scoped unique key.
- `AgentProviderBinding` provides provider agent ID and inbound number, encrypted at rest, with validity intervals, active status, and owning user/context; replacing a provider deployment records a new binding and deactivates the previous one.
- `/settings/agents` already lists/creates agents and replaces/deactivates external bindings. The existing surface is owner-scoped, **not** currently a global multi-tenant routing control plane. Inspect route capabilities before widening any permissions.
- `src/lib/server/integrations/elevenlabs/deployment.ts` matches inbound provider agent IDs or phone numbers using deterministic HMAC indexes. Unknown or conflicting provider identities must fail closed.
- `/api/webhooks/elevenlabs` validates the post-call HMAC on the raw request body before parsing; `/api/webhooks/elevenlabs/initiation` checks a separate authorization header.
- `NetworkDorianSession` stores participant/context/contact and agent binding, with hashed short-lived launch token and a provider conversation ID that may be claimed once. For shared Dorian, a missing or invalid session must never fall back to the deployment owner's private data.
- Shared Dorian selection currently comes from `RELISH_NETWORK_DORIAN_BINDING_ID` in the app environment. This and per-environment DB IDs should not be conflated with a routing rule.

### What is in the legacy proxy

Files: `proxy_server.js`, `config/agentMapping.js`, `package.json`. Expressed in Fastify, with hardcoded mapping from external ElevenLabs agent IDs to objects containing `{ environment, name }`, plus development/production upstream URLs.

Important defects/limitations that **must not** be carried forward:

1. `targetEnv = agentMapping[agentId]` assigns the whole object, but the subsequent branch compares to the literal string `'dev'`. It must use `agentMapping[agentId].environment`.
2. Unknown agents default to production. Reject unknown/unroutable agents instead. Never default to production.
3. `package.json` start script refers to `server.js`, while the supplied entry file is `proxy_server.js`.
4. No explicit Local target in the inspected proxy implementation; the mapping example exposes only dev/prod.
5. Dynamic routing depends on agent IDs in request body/query; future initiation, tool and post-call payloads may put identifiers at different paths. Tool requests may not include agent ID at all. Do not derive privileged routing solely from untrusted body values.
6. Reverse proxy forwarding must preserve original raw request bytes and signature/authorization headers; provider retries, size limits, timeouts, redirects and idempotency require testing.
7. The legacy proxy has no protected admin API, routing change audit log, durable per-conversation pin, or fail-closed production switch.

## Proposed components

### Gateway (separately deployed)

- Stable public DNS and HTTPS. Forward only explicitly registered ElevenLabs callback/tool routes; reject other paths, unsupported methods, and unknown agents.
- Central backend routing config: target `LOCAL` (public HTTPS tunnel), `DEV`, or `PRODUCTION`; explicit allowlisted upstream URL for each, no arbitrary SSRF-capable URL field.
- Protected configuration refresh/control-plane channel. Never expose it to end users or public webhook callers. Require administrative authorization and logs.
- Authenticate/verify provider webhook calls at Relish destination regardless of proxy; ideally also reject malformed/oversize requests early at gateway.
- Forward raw bodies and relevant original signature headers unchanged. Treat destination redirects as errors; no forwarding of sensitive bearer tokens to uncontrolled hosts.
- Emit correlation IDs, environment, route, provider conversation ID and status only; never log full transcripts, names, session tokens or credentials.
- Health/readiness endpoint and bounded proxy retries. Do not automatically retry POST after an indeterminate response without idempotency design.

### Administration UI within Relish

- Expand existing `/settings/agents`, do not create a parallel `AgentDefinition` registry.
- Show agent definitions, provider deployments and version history separately from gateway routing policy.
- Add/replace provider ID by creating a new binding and preserving prior binding history, with checks for active conflicting provider ID.
- Add an owner-authorised routing configuration to choose Local/Dev/Production for each **configured gateway agent key**; indicate destination hostname and last sync acknowledgement.
- Production route changes require explicit confirmation, audit log, and a valid production destination. Do not assume `ADMIN` alone grants cross-tenant private data access.
- Store gateway routing configuration in a dedicated operator/control-plane custody scope, not under arbitrary participants' General ContextSpaces.

## Fundamental identity and routing distinctions

- `AgentDefinition.id` = stable logical agent (Dorian).
- `AgentProviderBinding.id` = versioned external provider deployment in one Relish database.
- Provider `agent_id` = ElevenLabs identity, changes when agent is copied.
- `NetworkDorianSession` = participant-owned conversation launch in its own Relish environment/database.
- `gateway route target` = selected backend. This is NOT the same as binding `environment`, and a route switch MUST NOT change participant ownership.

### Session pinning (mandatory before production usage)

At initiation, associate the provider conversation ID or a securely verifiable opaque session reference with the target environment. Persist the mapping at the gateway (TTL sufficient for post-call retries). Subsequent initiation/tool/post-call requests for that conversation MUST go to the pinned environment despite later changes to the selected default. If a call cannot be safely attributed, fail closed instead of redirecting to whichever environment was last selected. Verify ElevenLabs supplies sufficient identifiers in each actual callback type; if not, design one-time environment-specific callback credentials or route-specific credentials.

Production and development databases may have different `AgentProviderBinding.id` values even for the same ElevenLabs agent ID. The gateway should select an environment, then the target Relish app must resolve its own binding. The current shared binding env var must remain environment-specific until deliberately redesigned.

### Security and risks

- Never accept `user_id` or `agent_id` as authority to modify private user data in mid-call tools. Use session credentials resolved server-side with scoped authorisation.
- Production outbound/proxy routing cannot be implicitly changed by development accounts. Use owner-only control, high-friction confirmation, audit entry and, ideally, second-factor protection.
- Local tunnel offline => unavailable error, not production fallback.
- Webhook raw-body signature preservation and correct per-environment ElevenLabs secrets need end-to-end testing.
- Domain allowlist errors (`... not allowed to connect to this agent`) and browser microphone capture are separate from inbound webhook proxying.
- A single shared agent serving production and development simultaneously requires reliable per-conversation pinning. A global switch alone cannot guarantee this.

## Sequenced implementation

**8.15.4.6d - Safe standalone gateway**: standalone audited Fastify service, stable public endpoints, explicit route config, Local/Dev/Production destinations, fail-closed routing, raw webhook forwarding, health logging, unit tests. Initially permit a single controlled non-production route; defer switching active calls until pinning is demonstrably reliable.

**8.15.4.6e - Agent administration controls**: extend `/settings/agents` with gateway routing control and agent/provider binding management (much already exists); protected gateway control-plane and audit history. Prisma migration likely required for routing config and audit records; determine exact migration during implementation.

**8.15.4.6f - End-to-end test and release gate**: two authenticated members, distinct Relish General ContextSpaces, initiation and mid-call tools (if enabled), signed post-call, participant-specific session attribution, retries, duplicate protection, production isolation, route switch during an active conversation and negative authorization tests. Do not invite external members until custody tests pass.

## Stage 8.15.4.6c validation

Read-only architecture and source audit; no application code, Prisma schema or migrations changed. No test passing claims are made for runtime integration. Original proxy is reference material only and not included in full source package. No `npm run check` is required solely for this documentation update. Before shipping 8.15.4.6d, exercise automated gateway tests and later full Svelte checks for any Relish changes.
