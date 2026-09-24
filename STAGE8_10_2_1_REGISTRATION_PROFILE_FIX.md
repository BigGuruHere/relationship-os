# Stage 8.10.2.1 - Fix default profile creation on registration

## Problem
New email/password registrations created a User and stored its encrypted email, then failed creating the default Profile because Profile.slug is required. The next login worked because the User already existed.

## Changes
- `ensureDefaultProfile` now creates a random UUID-based public slug, fixing that helper for Google OAuth as well.
- Email/password registration creates its Person, encrypted indexed email and default Profile as **one nested Prisma User.create transaction**. If default profile creation fails, User creation rolls back.
- Shared encrypted email field preparation avoids copying encryption/HMAC logic.
- Existing users are retained. Successful password login attempts to repair a missing default profile (best effort, after password verification). No schema migration is needed.

## Install and verify on Mac
1. Preserve `.env` and use the new source package.
2. Run `npm ci` (if dependencies have changed) and `npx prisma generate`.
3. Run `node --test tests/core/stage8-10-2-1-registration-profile.test.mjs`.
4. Run `npm run check` and `npm run build`.
5. Create a NEW account through `/auth/register`. Check that registration redirects and that the user's default profile exists. Then sign out and sign back in.
6. Log into an account created by the old broken route: successful login attempts to create its missing default profile. Do not re-register or reset the database.

No migration or `prisma migrate dev` required for this code-only patch. No live DB or HTTP registration test was run while packaging.
