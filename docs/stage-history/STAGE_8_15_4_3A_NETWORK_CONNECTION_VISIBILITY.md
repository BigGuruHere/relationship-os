# Stage 8.15.4.3a — Network Connection Visibility and State

## Migration required: NO

No Prisma migration, changes to `schema.prisma`, or database write to existing contacts is required. Baseline: complete Stage 8.15.4.3 source ZIP. Stage 8.15.4.3's `NetworkConnectionOrigin` migration should already be applied.

## Changes

1. Network home (`src/routes/network/+page.server.ts`) loads `NetworkConnectionOrigin` records where the current user is either inviter **or** visitor. It deduplicates the other user, and displays their **current Personal public profile name**. This is a read-time projection; it does not overwrite the owner-recorded name, notes, or Living Understanding in the Contact table.
2. Network home (`src/routes/network/+page.svelte`) labels this section `Your connections` instead of `People who connected with you`.
3. Personal public profile (`src/routes/u/[slug]/+page.server.ts`) reads a matching `NetworkConnectionOrigin` in either direction and sets `isAlreadyConnected`. Non-Personal public profiles retain the existing Contact-based check. The public profile UI already displays `You're already connected` when this flag is set, so no second button should appear after refresh.
4. Tests and `check:stage8.15.4.3a` npm command added.

## Local checks (no build and no migrate dev)

```powershell
npm run check:stage8.15.4.3a
npm run check:stage8.15.4.3
npm run check
```

## UI acceptance

- Two accounts, A and B: after B connects using A's Personal public profile, A's `/network` **and** B's `/network` both show the other person.
- Reload A's Personal public profile as B: `You're already connected` appears, no Connect button. Verify the same after A visits B's Personal profile (where one exists).
- Repeat the connection or QR scan: confirm no duplicate contact or `NetworkConnectionOrigin` record.
- Change B's Personal profile display name: A's Network list reflects the new public name on refresh. A's independently saved Contact name remains unchanged in General.
- Confirm Business profile and non-Network public connect flow remain functional.
- Owner, ordinary member and guest permission checks should remain unchanged.

## Verification

New focused static source tests: 4 passed; previous Stage 8.15.4.3 static source tests: 4 passed. No live database/browser integration tests or `npm run check` were run in the packaging environment. The previously observed user-reported browser journey must be retested locally.

## Limitations

Network list intentionally uses the latest public Personal name as a read-only display value; Contact names are not synchronised. The view is based on durable `NetworkConnectionOrigin` rows; historic contacts created before the Stage 8.15.4.3 flow may not appear until an origin exists. Guest onboarding and account claiming remain future work.
