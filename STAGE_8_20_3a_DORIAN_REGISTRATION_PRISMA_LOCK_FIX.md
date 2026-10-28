# Stage 8.20.3a — Dorian Registration Prisma Lock Fix

This is a surgical fix on top of Stage 8.20.3 and **does not** change the binding schema or console UI.

## Symptom

A first PROD registration responds `REGISTRATION_FAILED` and Railway Relish logs only:

`[dorian-registration] registration failed PrismaClientKnownRequestError`

## Root-cause candidate and fix

In `src/lib/server/integrations/elevenlabs/dorianDeploymentRegistry.ts`, registration acquired a transaction-scoped advisory lock with:

```ts
await tx.$queryRaw`SELECT pg_advisory_xact_lock(820300031)`;
```

PostgreSQL returns a column of type `void`. Prisma raw query result deserialization may reject it, throwing a `PrismaClientKnownRequestError` **before the registration creates a binding**. The fixed query obtains the same transaction-scoped lock but returns an integer to Prisma instead:

```ts
await tx.$queryRaw`SELECT 1::integer AS locked FROM (SELECT pg_advisory_xact_lock(820300031)) AS lock_row`;
```

The endpoint now logs `{ name, code }` for unexpected registration failures, without logging secrets or participant data. If another Prisma constraint fails, the new error code can distinguish it.

## Install

- Apply the complete source over the Stage 8.20.3 Relish repository and redeploy **Railway Production Relish**. No Agent Management or proxy changes are needed.
- Keep the existing `RELISH_DORIAN_DEPLOYMENT_OWNER_USER_ID` and `RELISH_DORIAN_DEPLOYMENT_REGISTRATION_TOKEN` variables.
- **Prisma migration required: NO.** No schema changes. No `npm run build` needed locally.
- Once Production is deployed, retry **Register Dorian deployment** from Agent Management → PROD. Leave phone routing on Dev until registration succeeds.
- If registration still fails, inspect Railway Production's `[dorian-registration] registration failed { name, code }` log and share the code only (not credentials).

## Safety

- The change does not alter transaction boundaries or the serializing advisory lock, and does not bypass owner/ContextSpace validation.
- Existing bindings, Relish call records, consent and Living Understanding are unchanged.
- Registration attempts from before this patch may have created no record or (if failure arose after a committed write) some records. Always use the console's current binding status before retrying; the registration path is designed to be idempotent.

## Testing

Static regression tests check that the invalid `void` result is not selected directly. Database integration against live Neon Production has not been run.
