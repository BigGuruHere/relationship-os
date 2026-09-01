# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Relish" (repo name RelationshipOS) is a SvelteKit CRM for relationship-driven deal-making: contacts, companies, deals, projects, and a "leads" staging layer, plus a Prisma-backed AI agent system (research, enrichment, opportunity scoring, outreach drafting).

Stack: SvelteKit 2 / Svelte 5, TypeScript (strict), Prisma 6 + Postgres, OpenAI SDK, Argon2 for auth, `@sveltejs/adapter-node`, deployed on Railway via Nixpacks.

## Commands

```bash
npm run dev              # vite dev server
npm run build             # prisma generate && vite build
npm run preview           # preview production build
npm run check              # svelte-kit sync && svelte-check (type checking)
npm run check:watch
npm run lint                # prettier --check . && eslint .
npm run format              # prettier --write .

npm run generate            # prisma generate
npm run migrate:dev          # scripts/safe-migrate-dev.js -> guarded `prisma migrate dev`
npm run migrate:deploy        # prisma migrate deploy (safe for prod)
npm test                     # node:test Core behavioural suite via tsx
npm run check:stage8.6       # real Postgres ContextSpace verification
npm run check:stage8.7       # real Postgres cross-custody verification
```

Core behavioural tests live under `tests/core/*.test.ts` and run through `tsx --test`. Stage-specific scripts under `scripts/check-stage8-*.ts` add real PostgreSQL verification where the invariant depends on Prisma/database behaviour.

`npm run dev` binds Vite's default port; the app treats `http://localhost:5173` as the canonical local origin (see Environments below), so keep dev running there when testing auth/cookie flows.

### Migrations — read this before touching prisma/migrations

- **Never run `npx prisma migrate dev` directly.** Use `npm run migrate:dev`, which wraps it in `scripts/safe-migrate-dev.js`. That script refuses to run unless `APP_ORIGIN` is `http://localhost:5173` or `https://dev.relish.live` and `NODE_ENV !== 'production'` — it exists specifically to stop `migrate dev` from touching the production database.
- This repo has already had a production incident from migration ordering (`STAGE6_9_PRODUCTION_MIGRATION_ORDER_FIX_NOTES.md`): a locally-generated "sync" migration referenced a table that didn't exist yet in production because migration folder timestamps didn't match the order tables were actually created in prod. When adding a migration that alters a table introduced in an *earlier* migration, double check the deployed migration history's actual order, not just the local timestamp order — consider a small idempotent "prepare" migration if there's any doubt, and be ready to `prisma migrate resolve --rolled-back <name>` against prod if one fails partway.
- Each stage of work tends to ship a `STAGE*_RELEASE_NOTES.md` / `*_NOTES.md` file at the repo root documenting what changed, the new migration name, and a manual test flow. Check for one when working in an area that has one, and add one for a new stage-sized change following the existing naming/structure (`STAGEn_m_TOPIC_NOTES.md` or `STAGEn_m_TOPIC_RELEASE_NOTES.md`).

## Architecture

### Multi-environment origin/cookie inference

There's no separate config file per environment. `src/hooks.server.ts` infers the runtime env (`local` | `dev` | `prod`) from the request's `Host` header via `src/lib/env.ts` (`app.relish.live` → prod, `dev.relish.live` → dev, everything else → local), then computes the origin and session-cookie config for that env and attaches them to `event.locals` (`locals.env`, `locals.appOrigin`, `locals.sessionCookie`) before any route code runs. Downstream code should read cookie name/options from `locals.sessionCookie`, not hardcode a name — `src/lib/auth.ts` keeps a legacy `SESSION_COOKIE_NAME` constant only for backward compatibility.

### Auth

Custom-rolled, not a library: Argon2id password hashes (`src/lib/auth.ts`), HMAC-signed session cookies (session id + random token, only a hash of the token stored in `Session`), Google OAuth (`src/routes/auth/google`), and passwordless magic links (`src/lib/server/magic.ts`, `src/routes/auth/magic`). `hooks.server.ts` only ever attaches `locals.user = { id }` — never the email — to keep decrypted PII out of locals (see Encryption below).

### Encryption / PII handling

PII fields (email, names, deal titles, etc.) are stored encrypted at rest with per-record AES-256-GCM (`src/lib/crypto.ts`), with separate `encKey`/`macKey` derived via HKDF from a single `SECRET_MASTER_KEY` env var. Equality search on encrypted fields is done via a deterministic, scoped HMAC index (`*Idx` columns, built with `buildIndexToken`/`buildIndexTokenBytes`) — this is index-only and not reversible; anything beyond an exact match requires decrypting a bounded result set server-side.

Rules enforced by convention (see comments in `src/hooks.server.ts`, `src/lib/crypto.ts`, route files):
- Decrypt only in server-side load functions or actions, never send ciphertext-adjacent secrets to the client unnecessarily.
- Contextual Core/Workspace data is scoped by both `userId` ownership and `contextSpaceId` custody. Do not treat `userId` alone as a sufficient Core boundary.
- Stage 8.7 forbids an active Workspace from implicitly resolving or querying another owner. Existing public-profile connection, lead-claim, and public lead-ingress flows must use the named cross-custody helpers in `src/lib/server/core/contextSpace.ts`.
- Comments prefixed `IT:` mark implementation-tricky/security-relevant lines — a convention used throughout `src/lib` and `src/lib/server`; preserve this pattern when editing nearby code.

### Data model (`prisma/schema.prisma`)

Core CRM: `User`, `Contact`, `Company`, `Deal` (+ `DealContact`, `DealCompany`, `DealNote`), `Project` (+ `ProjectWorkstream`, `ProjectDeal`, `ProjectNote`), `Task`, `Reminder`, `Tag`/`TagAlias`, `Interaction` (+ `InteractionEmbedding` for semantic search), `ContactRelationship`/`CompanyRelationship` (person-to-person and company-to-company graph, not just to the owning user).

Leads: there are **two distinct lead concepts** — don't confuse them:
- `Lead` — the older model, used for public claim/invite flows (QR/vCard sharing, guest onboarding).
- `MarketLead` (+ `MarketLeadNote`, `LeadSource`) — the newer market-making staging layer (buyer/seller/company/contact/mandate/asset/referrer), shown in the UI simply as "Leads" (`/leads`). It converts into real `Contact`, `Company`, `Deal`, `Want`, or `Offer` records while keeping a link back to the originating lead. Server logic lives in `src/lib/server/marketLeads.ts` and `src/lib/leads/` (`link.ts`, `reciprocal.ts`).

Relationship intent: `Want` and `Offer` are separate first-class Core concepts. Legacy `ExchangeItem` authority has been retired and must not be reintroduced as a generic Intent table without a new architectural decision.

AI agent system: `AgentDefinition`/`AgentPromptVersion`/`AgentToolDefinition`/`AgentToolPermission` (config, versioned prompts, per-agent tool allowlist), `AgentRun`/`AgentStep`/`AgentToolCall`/`ModelInvocation`/`AgentArtifact` (durable execution log — every run, step, tool call and model call is persisted), `ApprovalRequest` (human-in-the-loop gate for tools flagged as requiring approval), `AgentRunEntity` (links a run back to the CRM entities it touched). Also `ResearchCandidate`/`ResearchSource`, `ContactEnrichment`, `OpportunityScore`/`OpportunityScoreFactor` — structured outputs the agents write.

### Agent runtime (`src/lib/server/agents/`)

Agents don't call Prisma directly for side effects — they go through a registered **tool** layer:
- `runtime.ts` — `startAgentRun`/`completeAgentRun`/`failAgentRun` create/close the durable `AgentRun` row before/after any AI work.
- `toolRegistry.ts` — `executeAgentTool(key, input, context)` is the single entry point tools are invoked through. It re-validates that the run belongs to the calling user, checks the tool is enabled and the agent has permission (`AgentToolPermission`), and if the tool or permission is flagged `requiresApproval`, it writes an `ApprovalRequest` and **throws instead of executing** — approval is a hard gate, not advisory. Every call is logged to `AgentToolCall` with status/input/output/error regardless of outcome.
- `agents/*.ts` (`brokerBriefAgent`, `contactEnrichmentAgent`, `opportunityScoringAgent`, `outreachAgent`) — per-agent orchestration logic, one file per agent surfaced under `/agents/*`.
- `tools/*.ts` — individual tool implementations (`readEntityContext`, `createArtifact`, `createResearchCandidate`, `createOpportunityScore`, `createApprovalRequest`, `createTask`, `researchWebSearch`, `createResearchSource`, `createContactEnrichment`), registered in `toolRegistry.ts`'s `ensureRegistered()`.
- `modelGateway.ts` / `researchGateway.ts` — wrap the actual OpenAI/model calls (logged as `ModelInvocation`).

When adding a new agent capability, prefer adding a tool + registering it over having an agent write to Prisma directly, so the approval/audit trail stays intact.

### Routes (`src/routes/`)

Standard SvelteKit file-based routing with `+page.server.ts` loads/actions doing the tenant-scoped Prisma queries and `+page.svelte` for UI. Notable non-obvious surfaces under `src/routes/api/`: `transcribe`/`transcribe-result`/`upload-chunk` (chunked audio upload + async transcription, paired with `src/lib/recording/`'s `VoiceTextField.svelte`/`RecordingGuard.svelte`), `summarize` (AI summarization of interactions), `vcard`/`qr` (contact sharing), `guest` (invite/claim flow tied to the older `Lead` model), `sms`.

`src/routes/u/[slug]` and `src/lib/server/owner.ts` implement public profile pages resolved by `Profile.slug` first, falling back to `User.publicSlug`/id — this is the one path that intentionally does read-only lookups without the normal tenant-scoping-to-signed-in-user pattern, since it's serving another user's public page.

## Conventions

- File-top comment blocks (`// PURPOSE:`, `// SECURITY:`, sometimes `// NOTES:`/`// ENV:`) are used throughout `src/lib` and `src/lib/server` — follow this when adding new lib modules, especially anything touching auth, crypto, or tenant scoping.
- `IT:` inline comments flag security- or correctness-critical lines (normalization before hashing, scoping before a query, etc.) — keep using this marker in code you touch in these areas rather than removing it.
- Prettier/ESLint (flat config, `eslint.config.js`) with `eslint-plugin-svelte` and `prettier-plugin-svelte`; run `npm run lint` before considering a change done.


## Environment

Requires a populated `.env` — `src/lib/crypto.ts` throws at import time if
`SECRET_MASTER_KEY` is not 64 hex chars, so the app will not start without it.

Required: DATABASE_URL, SHADOW_DATABASE_URL (migrate dev only), SECRET_MASTER_KEY
(`openssl rand -hex 32`), SESSION_COOKIE_SECRET, APP_ORIGIN, OPENAI_API_KEY.
Optional: APP_ORIGIN_LOCAL/_DEV/_PROD (override the defaults in src/lib/env.ts),
SESSION_DAYS, DB_KEEPALIVE_MINUTES, GOOGLE_CLIENT_ID/_SECRET, OAUTH_REDIRECT_URI,
ALLOWED_GOOGLE_DOMAIN, ALLOWED_EMAIL_DOMAINS, AGENT_DEFAULT_MODEL,
RESEARCH_PROVIDER, RESEARCH_OPENAI_MODEL, BRAVE_SEARCH_API_KEY, TAVILY_API_KEY.

Never read, print, or commit `.env`.