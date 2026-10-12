# Stage 8.14.2.4 - Widget Test Custody and Vite Host Hotfix

## Purpose

Fix the ElevenLabs widget test harness when the authenticated settings request is currently inside a different same-owner ContextSpace from the selected agent deployment. Also carry the ngrok Vite allowed-host configuration in the source package.

## Custody fix

The test harness previously queried `Contact` with an explicit deployment `contextSpaceId` while the request remained in the currently active workspace custody. The Prisma custody extension correctly rejected that query with `Explicit ContextSpace does not match the active custody context.`

The harness now explicitly enters the selected agent deployment's same-owner ContextSpace with `runWithWorkspaceCustody()` before resolving the supplied Contact/Person UUID. This does not weaken the custody guard and does not create cross-owner authority.

## Vite/ngrok

`vite.config.ts` now reads `DEV_ALLOWED_HOSTS` or `DEV_ALLOWED_HOST` and passes the configured hostnames to Vite `server.allowedHosts`. The current test hostname remains the development fallback. Multiple hosts can be comma-separated in `DEV_ALLOWED_HOSTS`.

Example:

```env
DEV_ALLOWED_HOST=creative-basilisk-painfully.ngrok-free.app
```

## Database

No Prisma migration.
