# Stage 8.15.4.7b.2 — Provisional caller ContextSpace provisioning fix

**Basis**: Stage 8.15.4.7b.1 complete source archive; all other source files copied unchanged.

## Bug fixed
First telephone call attempted to create a second default ContextSpace after User creation, failing PostgreSQL check with `P0001: Only one default ContextSpace is allowed per owner`.

`src/lib/server/integrations/elevenlabs/phoneOnboarding.ts` now calls existing `ensureOwnedDomainContextSpace(tx, { ownerUserId, domainKey: 'general', displayName: 'General' })` within the same transaction. This reuses the user's general space when it exists, or creates one without `isDefault: true` when necessary. No database triggers or constraints have been changed.

## Migration status
No new migration required for this code-only fix. Both 8.15.4.7b phone caller and 8.15.4.7b.1 updatedAt correction migrations remain in the source. Abandoned 8.15.4.7a migration is deliberately excluded.

## Installation / verification
- Back up your local changes and compare against this archive before replacing your tree. This archive is based on the most recent source package supplied in this conversation; it is **not** a byte-for-byte snapshot of your live Windows folder.
- `npm run check`
- `node --test tests/core/stage8-15-4-7b-phone-provisional.test.mjs`
- Don't run `prisma migrate dev` for this code change. Only use `npx prisma generate` if the Prisma Client has not been generated successfully; stop Node/Studio first to avoid EPERM.
- Start local dev server and place one call; look for successful initiation and a stored transcript. Call again and confirm reuse of the same `NetworkPhoneCaller` and the returning greeting.

## Verification limitations
Static archive inspection and targeted patch checks completed. Full Svelte compilation, Neon database execution, Telnyx call and phone-first runtime tests were not executed here.
