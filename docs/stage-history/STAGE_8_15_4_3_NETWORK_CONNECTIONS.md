# Stage 8.15.4.3 - Authenticated Network connections and inviter attribution

## Migration required: YES

New migration: `20261015030000_stage8_15_4_3_network_connection_origin`.
A new `NetworkConnectionOrigin` row permanently links inviter, initiating logged-in member, public personal profile used, and the two authorised General ContextSpaces. It is **connection attribution**, not friendship, sharing consent, or permission to read any private material.

## Scope delivered

- The public `/u/<personal-profile-slug>` Connect form now POSTs to `/network/connect/<slug>` when the profile's kind is Personal. Business and other profile kinds retain their original compatibility flow.
- `/network/connect/<slug>` derives inviter from the stored personal profile and initiator from the server-authenticated session. Client-supplied owner and workspace IDs are never trusted.
- Both users must already have General ContextSpaces. The initiator's chosen General ContextSpace is explicitly checked; the owner receives a contact in their default General ContextSpace.
- Both Contact records use the existing encryption and `linkedUserId`/Person support, with the existing cross-owner custody authority. The `Contact` unique constraint and the new unique attribution pair make repeat submissions idempotent.
- Network home lists the last 50 visitors who connected via these invitations, using only each visitor's public Personal profile display name, not their private contacts or Living Understanding.

## Deliberate exclusions

- An anonymous QR visitor is **not** yet a Network member. The existing anonymous Save contact/lead form remains a separate legacy path. Guest account claiming and onboarding are future stages.
- Dorian is not part of this release.
- No social assertion, mutual agreement to be friends, sharing or matching consent is implied by connecting.
- Existing connections created by the legacy flow are not silently migrated or reattributed.
- The broad remaining API and cross-user isolation security audit is not claimed complete.

## Local installation

1. Extract the *complete* source ZIP, preserving existing local `.env` files and environment settings.
2. Run `npx prisma migrate dev` because this stage introduces the migration above.
3. Run `npx prisma generate`.
4. Run `npm run check:stage8.15.4.3`.
5. Run `npm run check`.

Never invent a new migration name in response to Prisma drift. Stop and inspect any unplanned prompt.

## Manual tests

1. User A with a Personal profile and General ContextSpace shares `/u/<personal-slug>`.
2. User B, separately signed in and with a General ContextSpace, visits that URL and presses Connect.
3. Confirm B returns to `/network?connected=1` and A's `/network` lists B's **public** profile name. Confirm an encrypted linked contact was created for both participants in their respective General contexts.
4. Repeat Connect (or rescan). Verify no duplicate `Contact` or `NetworkConnectionOrigin` rows.
5. Verify a Business profile uses the original flow, not Network-specific context attribution.
6. Verify logged-out users do not create a connection. The anonymous flow remains separate.
7. Verify a missing Personal profile, self-connection and missing General ContextSpace do not create a connection.
8. Confirm no privately stored notes, LU, or other ContextSpace contacts are visible from the new list.

## Verification limits

Source-level tests validate code shapes, **not** database execution. No live PostgreSQL integration, Prisma generation, Svelte check or browser tests were run in this environment.
