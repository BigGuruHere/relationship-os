# Stage 8.15.4.7f.2b - Continuous DEVELOPMENT understanding worker

## Delivery scope
Adds an opt-in continuous polling mode to the existing separate Stage 8.15.4.7f.2a worker. The worker polls PostgreSQL every 10 seconds while running, atomically claims queued (`PROCESSING`) work, processes one caller at a time using existing initial/impact Living Understanding workflows and validated authoritative persistence, and exits gracefully on SIGINT/SIGTERM after an active job. No new understanding store or approval path is created.

This is NOT a production worker or pilot-ready implementation. It deliberately remains development-only. `FAILED`, stale `WORKING`, and stale `IN_CALL` states are reported for operator attention rather than being automatically unlocked. Absent-webhook recovery, bounded automatic retries, worker health monitoring and safe retrieval of understanding for returning telephone callers remain outstanding. Review-history retention and admin access have not yet been end-to-end audited.

## Source changes
- `scripts/process-stage8-15-4-7f-2-phone-queue.ts`: development-only watch polling mode and blocked-state reporting, retains existing one-shot mode.
- `package.json`: watch/test commands.
- `tests/core/stage8-15-4-7f-2b-worker-loop.test.mjs`: 3 structural regression tests.

## Install
The complete baseline archive is not the user's current local checkout: the newer `src/routes/general/admin/pilot-phone-reviews/+page.server.ts` page is absent. Use only the small overlay ZIP to retain local changes. Back up or commit before extraction. No database migration in this increment; the 8.15.4.7f.1 schema migration must already exist. Do not run a local production build.

## Checks
In PowerShell in `C:\Users\teren\Coding\RelationshipOS`:

```powershell
# Structural regression tests for the existing queue and new watch mode.
npm run check:stage8.15.4.7f.2b

# TypeScript and SvelteKit check.
npm run check
```

## Controlled development test ONLY
Confirm the Neon database URL belongs to DEVELOPMENT before running. Do not paste credentials or transcript text into chat. Keep the worker in its own VS Code terminal and Relish server in a different terminal. Do not enable for external participants.

```powershell
# DEV database permission and explicit private-learning opt-in.
$env:ALLOW_RELISH_PHONE_DEV_DB_TEST = 'YES'
$env:RELISH_DB_ENV = 'development'
$env:RELISH_PHONE_AUTO_LU = 'YES'
try {
  # Stays running until Ctrl+C; polls for queued imported conversations.
  npm run watch:stage8.15.4.7f.2:dev
} finally {
  # Clean up the permissions even when a test fails.
  Remove-Item Env:ALLOW_RELISH_PHONE_DEV_DB_TEST -ErrorAction SilentlyContinue
  Remove-Item Env:RELISH_DB_ENV -ErrorAction SilentlyContinue
  Remove-Item Env:RELISH_PHONE_AUTO_LU -ErrorAction SilentlyContinue
}
```

In a separate terminal, enable `RELISH_PHONE_AUTO_LU=YES` ONLY for an informed consenting DEVELOPMENT test participant and restart the Relish server. Call Dorian and let the webhook import the transcript. The worker should find the `PROCESSING` record and move it to `READY` after validated processing. Check the current Living Understanding and authoritative revision manually. If processing fails, check the safe status logs and use the earlier controlled DEV recovery process only after diagnosis. NEVER manually force `READY` merely to allow another call.

## Verified
Six local structural tests passed, including three from the earlier 2a stage. No Neon database, AI processing, webhook, production deployment, or SvelteKit checks were run in the packaging environment.

## Next
Implement bounded recovery for missing webhooks and stale jobs, production-safe worker scheduling and monitoring, a secure returning-caller context handoff with appropriate identity assurance, and inspect historic analysis/review artifacts after auto-approval. Complete the two-caller and duplicate-event database tests before enabling the external pilot.
