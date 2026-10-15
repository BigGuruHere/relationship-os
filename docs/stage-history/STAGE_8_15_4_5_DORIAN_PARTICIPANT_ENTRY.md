# Stage 8.15.4.5: Dorian participant entry and custody preflight

**Migration required: NO.**

## Why this is a guarded first increment
Existing ElevenLabs deployment and signed post-call ingestion are bound to an owner User and ContextSpace. A network invitee must never be sent to an inviter's agent binding, since the webhook would then store the invitee's transcript under the inviter's ownership. We therefore **do not yet support the shared Dorian agent for a brand-new participant**.

## Implemented
- `/network/dorian` is an authenticated member-facing conversation page reachable from `/network`.
- Uses only the authenticated participant's current General ContextSpace.
- Resolves exactly one active, in-date, participant-owned ElevenLabs DORIAN deployment in General.
- Requires exactly one self-contact (`linkedUserId === authenticated user ID`) in the same General ContextSpace.
- Passes the resolved self-contact ID to the existing ElevenLabs widget for identity matching, never claiming it authorises webhook custody.
- If prerequisites fail, displays a safe explanation without launching a vendor session.
- Never borrows an operator/inviter deployment, auto-creates a possibly incorrect self-contact, or grants sharing/approval.

## Still required before a Network-member Dorian pilot
1. Shared Dorian deployment architecture with *authenticated*, tamper-resistant conversation-session routing from the participant's account to the webhook's correct custody. An agent's provider ID alone is not sufficient to select the participant user.
2. Safe enrollment of a participant-owned self-understanding/contact identity (separate from someone else's notes about that person).
3. Integration tests with genuine ElevenLabs initiation and signed post-call payloads, verifying transcript custody, retries and non-disclosure.
4. Participant consent, retention/deletion and governed LU handoff UX.

## Commands (development)
```
npm run check:stage8.15.4.5
npm run check:stage8.15.4.4b
npm run check
```

## UI tests
1. Sign in as a newly invited member; `/network` has a Talk with Dorian link. Opening it must not launch someone else's provider agent. A clear not-ready state is expected.
2. Signed-out `/network/dorian` redirects to login.
3. As an account with its own active General DORIAN binding and a unique self-linked Contact, opening `/network/dorian` displays the ElevenLabs widget. Verify the vendor's allowlisted domain, consent and live webhook outcome independently.
4. An account with only a Business/Dating DORIAN deployment must not get a widget.
5. An account with 0 or 2+ self-linked Contacts must not get a widget.
6. Confirm existing Network QR, Google registration, removal, owner permissions and legacy ElevenLabs operator test harness are unaffected.

## Verification
Four focused source-level tests and four preceding-stage regression tests passed. Prisma migration, Svelte check, live web widget, real provider call, signed webhook and database-integration tests not run here. Do not treat source-level tests as proof of end-to-end voice custody.
