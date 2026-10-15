# Stage 8.15.4.2a - Network navigation and profile flow

## Purpose

Keep the first Network pilot profile and QR experience in Network, without switching into the Business application. Keep an operator's existing administration experience available on established privileged routes. Avoid public URL collisions for newly created Network profiles.

## Changes

- The common layout presents Network-only navigation while on `/network`, `/network/share`, and Network-entry profile/share routes (`?entry=network`).
- Accounts without ADMIN, OPERATOR or BROKER capabilities receive the simplified Network navigation in the common layout. **This is not an exhaustive route/API authorisation audit:** later work must enforce access at each sensitive server endpoint before inviting external pilot members.
- The profile editor receives a Network-entry signal and restricts Network-created/edited profiles to the `personal` kind. Server-side checks prevent an existing Business/Dating profile ID from being modified through this flow.
- Saving a Network profile returns to `/network` instead of the generic Business-oriented share screen. Network QR sharing explicitly targets the owner's personal profile.
- New Network profiles receive an opaque, random `p-<UUID>` public slug. Existing profile slugs remain unchanged so their public links keep working. Database uniqueness remains the final guard against slug collision.
- Preserves the Stage 8.15.3.5 deployed index-name map in `prisma/schema.prisma`, avoiding the known repeat Prisma rename migration prompt.
- No SQL migration and no change to existing public URLs.

## Local installation

```powershell
# Validate your pinned Prisma schema and migration history.
npx --no-install prisma validate
npx --no-install prisma migrate dev
npx --no-install prisma generate

# Run focused source-contract regression tests.
npm run check:stage8.15.4.2a
npm run check:stage8.15.4.2

# Verify the complete Svelte application.
npm run check
npm run build
```

Do not approve any unexpected reset or generate an unsolicited migration. Preserve all existing applied migrations.

## Manual acceptance tests

1. **Network navigation:** Open `/network` as your privileged account. The sidebar should show Network home, Share my QR, and My profile, without an Applications panel. Navigate to the existing operator/admin areas separately and ensure they still work.
2. **Create personal profile:** With no personal profile, select Create my profile. Ensure Personal is selected and cannot be changed in the Network flow. Save. You should arrive back at `/network`, not Business.
3. **Edit personal profile:** Select Edit profile from `/network`, change a public field, save and confirm you return to `/network`. Your existing Business profile should remain unchanged.
4. **Share:** Select Share my QR and open the QR link in an incognito browser. Verify only your chosen Personal public fields appear. The sidebar of the authenticated Share page should stay Network-focused.
5. **Identical names:** In development use two accounts with identical profile display names. Create new Network profiles and confirm their public URLs differ without requiring name suffixes. Do not expect existing profiles to be renamed.
6. **Member navigation:** Sign in with a normal MEMBER account. Confirm Network-only sidebar navigation. Attempt direct privileged URLs separately in the 8.15.4.2b security audit: hiding a link alone does not establish server-side security.
7. **Regression:** Confirm existing Business, Dating, and General operator routes remain available to the appropriate privileged accounts. Run `npm run check` and `npm run build`.

## Verification performed in packaging environment

- Stage 8.15.4.2 tests: 3 passing.
- Stage 8.15.4.2a tests: 4 passing.
- Prisma CLI validation, Svelte check, production build, live DB and browser E2E: **not run** in the packaging environment.

## Remaining boundaries

This stage does not create a relationship from QR scanning, create provisional participants, launch Dorian, or implement an exhaustive member permission audit. The Network query parameter controls presentation and the personal profile edit workflow, **not data custody or role elevation**. Public profile sharing remains governed by the existing public share code. The next security step should audit the direct route/API access available to a MEMBER account before an external pilot.
