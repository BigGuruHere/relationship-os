# Stage 8.22.5 - Event QR Landing and Mobile Menu Fix

## Purpose

Prepare Relish for the Tech Networking Walk on 1 November 2026. Replace the **visitor-facing business QR page** temporarily with a lightweight connection and optional pilot interest page while keeping the existing Dorian page and all earlier call functionality unchanged. Fix the mobile header's three-dot dropdown so it closes when a destination is selected.

## Included changes

1. **Temporary QR route:** The existing `/u/[slug]` business profile route redirects a **public visitor** to `/u/[slug]/event` only when its slug matches `RELISH_EVENT_PROFILE_SLUG`. All other business profiles, Friendship/Dating profiles and owner-edit pages remain unchanged. `/u/[slug]?original=1` allows testing the retained original page.
2. **New event screen:** Shows the public profile name/photo, a short Relish introduction, and **Save my contact details** using the existing vCard API. It invites visitors to join a small Relish/Dorian pilot test group.
3. **Real signup:** Visitors provide a name and **either** an email **or** a mobile number (both allowed), and explicitly tick permission to be contacted about Relish testing. The server checks profile publication, validates inputs, uses a honeypot and a coarse hourly abuse limit, encrypts personal information, and deduplicates repeated submissions per profile/contact channel.
4. **Isolated test group:** Signups are stored in `RelishEventPilotSignup` under `TECH_NETWORKING_WALK_2026_11_01`. They do **not** automatically become Contacts, accounts, connections, call invitations, or consent to phone recording. Only the authenticated profile owner can see their decrypted entries at `/event-signups` (also linked in the owner's three-dot menu as **Event testers**).
5. **Mobile menu:** The top-right `<details>` uses a controlled `open` state; selecting a link, submitting Sign out, or finishing client-side navigation closes the menu.

## Activation - required before the event

Find your business QR link on **Share**. If the URL is `https://app.relish.live/u/example-slug`, the value to configure is `example-slug` (not the full URL).

Set on the **Relish application handling that QR URL** (for example Railway PROD if the printed QR links to app.relish.live):

```env
RELISH_EVENT_PROFILE_SLUG=example-slug
```

`RELISH_EVENT_LANDING_ENABLED` is optional; absence means enabled **only for the configured slug**. Setting `RELISH_EVENT_LANDING_ENABLED=NO` disables the redirect and hides the temporary event signup page. Unsetting `RELISH_EVENT_PROFILE_SLUG` also restores the original guest page. No QR regeneration is required, because the QR's existing `/u/[slug]` link remains the same.

**Important:** The route is deliberately not enabled for every profile: a founder-specific page must not appear on another member's business profile by accident. The owner remains able to edit/preview the original page when signed in; use an incognito browser to verify what guests see.

## Installation

**Prisma migration required: YES.** This stage creates an isolated signup table. It does not alter existing Contact or Conversation tables, and does not delete existing data.

Install the complete source ZIP over the latest Stage 8.22.4a source, preserving your environment file and any local customisations. On the development machine:

```powershell
# Apply only checked-in schema migrations.
npx prisma migrate dev

# Regenerate client types for RelishEventPilotSignup.
npx prisma generate

# Check the SvelteKit application.
npm run check

# Run the new QR and mobile-menu regression checks.
npm run check:stage8.22.5

# Start local development.
npm run dev
```

If Prisma unexpectedly prompts for an additional migration name after applying the checked-in stage migration, cancel the prompt, run `npx prisma migrate status`, and investigate schema drift before creating an unrelated migration.

For a Railway environment, commit and deploy the full updated source, configure the slug variable, and ensure your existing production migration startup mechanism has successfully applied the included migration before asking guests to register. Do not assume the migration has been applied merely because the page renders.

## Test checklist

1. Confirm the QR link lands on `/u/your-business-slug/event` in an incognito browser.
2. Confirm **Save my contact details** produces a vCard with the public phone/email actually configured on the profile. If those details are absent, add them to your published business profile before the event.
3. Submit **name + email**, with the opt-in ticked. Check that the confirmation appears.
4. Visit `/event-signups` while signed in as the owner and confirm the submitted entry appears with the correct contact channel. Repeat with **name + mobile**, no email.
5. Repeat an email signup and confirm it updates the existing entry rather than creating another for the same email.
6. On mobile, open the three dots, tap a destination, and verify the menu closes; check repeated internal navigation.
7. Confirm Friendship and Dating QR links still show their original guest experience.
8. Confirm `/u/your-business-slug?original=1` still shows the retained Dorian page while this temporary event is enabled.

## Rollback and retention

To restore the old business QR page, remove `RELISH_EVENT_PROFILE_SLUG` or set `RELISH_EVENT_LANDING_ENABLED=NO` and redeploy/restart as your platform requires. No schema rollback, QR regeneration or data deletion is necessary. Signups remain in their separate owner-scoped table for manual personal follow-up. Do not interpret pilot opt-in as consent to call recordings or unrelated marketing; respect withdrawal requests.

## Validation completed here

- 4 new targeted static/regression checks: passed.
- 37 existing call lifecycle and initiation checks: passed.
- Full SvelteKit/Prisma runtime integration and live phone-browser test: **not run in this environment**. Run the local validation commands and test on the actual Railway target before the event.

## Source files

- `src/routes/u/[slug]/+page.server.ts` - temporary, scoped QR redirect.
- `src/routes/u/[slug]/event/+page.server.ts` and `+page.svelte` - landing and form action.
- `src/routes/event-signups/+page.server.ts` and `+page.svelte` - authenticated owner list.
- `src/routes/+layout.svelte` - mobile menu state and owner menu link.
- `prisma/schema.prisma` and `prisma/migrations/20261101010000_stage8_22_5_event_pilot_signup/migration.sql` - isolated signup persistence.
- `tests/core/stage8-22-5-event-landing-and-mobile-navigation.test.mjs` - targeted checks.
- `package.json` - new test script.
