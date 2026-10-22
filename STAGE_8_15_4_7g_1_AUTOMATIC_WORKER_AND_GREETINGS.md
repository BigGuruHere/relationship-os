# Stage 8.15.4.7g.1 - Automatic Worker Startup, Diagnostics and Dorian Greetings

## Scope and baseline
Implemented against the uploaded `relationship-os-development (1).zip`, using the current project at the archive root (`relationship-os-development/`). The archive also included a nested `RelationshipOS/` copy, which was not used as the baseline. No database schema or Prisma migration files were changed.

## Changes

1. `scripts/start-relish.mjs` supervises the web app and an opt-in queue worker as sibling child processes. Both inherit the exact environment and database URL of the parent deployment. The worker runs when `RELISH_PHONE_AUTO_LU=YES`, starts without a separate terminal, restarts after unexpected exit, and stops with the application. No additional Railway service is required for the pilot.
2. `npm run dev -- --port 8080`, `npm start`, and `npm run start:with-migrations` now run through the supervisor. The existing production migration step remains unchanged.
3. The queue worker no longer requires development-only test flags, and does not reject `NODE_ENV=production`. It requires explicit automatic-learning opt-in in its own deployment environment. It retains the atomic database state transition to claim a queued conversation.
4. Failure logs include a short hash of the conversation ID, error class and safe machine error code. Never log the token, name, transcript or unredacted provider message. The existing manual recovery command remains available; automatic retries of failed processing and missing-webhook recovery are **not** introduced.
5. Dorian greetings are more natural. First call: `Hi there. This is Dorian Kreed - your AI networking partner. How can I help you today?` Returning named caller: `Hi [preferred name], how are you today?` Returning unnamed caller: `Hi there, good to speak with you again. How are you today?`
6. Moved `tsx` to runtime dependencies to ensure the worker entry point is present when the Railway runtime installs production-only dependencies.

## Important environment handling

The supervisor does **not** select a database using `NODE_ENV`. The worker inherits the exact runtime's `DATABASE_URL` and other environment variables. Railway DEV and Railway PROD continue to deploy from GitHub as before. Set `RELISH_PHONE_AUTO_LU=YES` **only** in environments where automatic learning is intended and tested. It is disabled otherwise. Local `npm run dev` automatically loads `.env` when present using Node's `--env-file-if-exists` flag. Explicit environment variables take precedence.

If an environment already runs a separate queue worker, stop it before enabling the integrated worker to avoid redundant processes. Atomic claims prevent ordinary duplicate pickup but don't yet provide automated recovery for jobs left in `WORKING` after a crash.

## Install

Back up or commit your current project, then extract the complete ZIP into the project folder, preserving your environment files. The ZIP has a single `relationship-os-development/` root. For existing local folder named `RelationshipOS`, copy the **contents** of that archive folder into your local project folder.

**Prisma migration: NO.** Do not run `prisma migrate dev` for this stage.
**Local build: Not required.** Continue using your normal development command.

## Checks

```powershell
# Verify stage contract tests and SvelteKit/TypeScript.
npm run check:stage8.15.4.7g.1
npm run check

# Enable automatic learning for LOCAL development in your .env if you are ready.
# RELISH_PHONE_AUTO_LU=YES
npm run dev -- --port 8080
```

Watch the same terminal for `[Phone LU Supervisor] Auto worker enabled for this application environment`, then make a test call and verify `[Phone LU Worker] Completed` and the new authoritative revision. Use an additional call to verify the greeting. In each Railway environment, the normal GitHub deploy should run the same updated start scripts. Check that the deployed command invokes `npm start` or `npm run start:with-migrations`; if Railway overrides those with `node build/index.js`, the worker won't start until the Railway start command is updated.

## Validation actually performed

- New Node test suite: 3/3 pass.
- Startup script `node --check`: pass.
- Lockfile offline refresh: pass.
- `npm run check`: could not run in this container because dependencies were not installed (`svelte-kit: not found`).
- No live Neon, webhook, local Vite or Railway tests were performed.

## Not yet resolved

Failed jobs remain blocked until operator recovery; missing webhooks and stale `WORKING` jobs remain manual recovery scenarios. The next pilot acceptance stage should verify two-caller separation, duplicate post-call events, worker restarts, and that DEV and PROD point to their intended databases. Worker logs intentionally omit exception messages to avoid leaking participant or provider content.
