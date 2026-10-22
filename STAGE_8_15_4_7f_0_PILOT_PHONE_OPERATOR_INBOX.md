# Stage 8.15.4.7f.0 — Restricted provisional telephone review queue (partial)

This is **NOT** the finished manual-approval workflow. It provides an opt-in, ADMIN-capability-gated read-only view of pending provisional telephone Living Understanding handoffs. It does not expose approvals or allow acting as another User. The existing underlying cross-custody policy is retained and a tightly constrained read-only PILOT_PHONE_REVIEW transition added.

## Enable (development only)

Set `RELISH_PILOT_REVIEW_OPERATOR_USER_IDS=<YOUR_AUTHENTICATED_RELISH_USER_UUID>` in the development `.env` and restart the dev server. This must not be set for untrusted users. Open `/general/admin/pilot-phone-reviews` from a General workspace ADMIN account. This is an explicit opt-in, not a general admin entitlement.

## Important limitations

- Manual approval is **not** enabled. The current initial/impact workflows use the authenticated owner's User ID for all writes; a secure operator action needs separate actor and data-owner identities, audit attribution, source and contact validation, and tightly bounded cross-custody write permissions. It must be implemented and integration-tested before live use.
- `NetworkPhoneCaller` directory listing is not yet cursor-paginated beyond 100; only a pilot queue.
- Caller ID absent or invalid: existing `normalizePhoneForIdentity` initiation returns null and does not create an identifiable provisional caller. No caller-ID bypass is added.
- Future "call me" outbound callback is deferred; it is not authentication by itself.

## Verification

No Prisma migration. Source change only. Run `npm run check` on local dev, and inspect one existing provisional caller. Cross-custody read must be verified against a real DEV Neon database and any resulting 403 handled before extending the feature. This package has not been tested on the user's live database.
