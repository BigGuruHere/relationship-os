# Stage 8.14.0.3 - Build Health and Initial Route Stabilisation

## Purpose

This release continues the build-health cleanup after the complete `svelte-check` output revealed 43 remaining errors. It also hardens the production initial Living Understanding route and moves historical Stage markdown documents out of the repository root.

## Initial Living Understanding route

- The production `/understanding/initial` route no longer imports another route page as a Svelte component.
- It renders its own copy of the reviewed workflow UI.
- The server route delegates to the reviewed server workflow through an explicit production wrapper.
- Unexpected non-SvelteKit load failures are logged as `[living-understanding] initial route load failed`.
- In development, the 500 response includes the underlying load error message so the next failure is diagnosable rather than silent.
- Redirects and explicit HTTP errors remain unchanged.

## Build-health corrections

The remaining reported compiler-error classes were addressed, including:

- Node HKDF key typing for HMAC/AES use.
- Byte-only encrypted email index typing for Prisma `Bytes` fields.
- Extended Prisma client generic recursion at the shared Person access seam.
- Outreach callback signature typing.
- Missing login throttle bucket type.
- Stale `contextSpaceId` arguments supplied to Want/Offer helper contracts.
- Zod v4 `issues` access and non-null Interaction `occurredAt` handling.
- Prisma extended-client / transaction-client type seams in legacy Dating understanding helpers.
- Dynamic `chainHistory` working state on read-only revision results.
- Local `qrcode` module declaration.
- Node FormData audio Blob construction.
- Magic-token helper contract and magic-link token verification.
- Nullable public slug return handling.
- Profile ownership field naming for QR generation.
- Prisma tag-query mode typing.
- Dating audio route handler literal-path typing.
- Market Lead Want/Offer relation selection.
- ProfileKind narrowing.
- Share profile re-read shape consistency.
- Task recurrence field selection.

## Documentation cleanup

155 root-level `STAGE*.md` files were moved to:

`docs/stage-history/`

Known code/test references to those files were updated. Prisma migrations were not moved.

## Validation

- Stage 8.12-8.14 source-level regression suite: 59/59 passing.
- Production migration integrity: 81/81 deployed migrations byte-for-byte unchanged.
- No Prisma migration.
- No dependency changes.

The packaging environment could not complete dependency installation, so `npm run check` must still be run in the normal development checkout. The intended acceptance target is 0 errors; warnings can remain for a later UI-quality pass.
