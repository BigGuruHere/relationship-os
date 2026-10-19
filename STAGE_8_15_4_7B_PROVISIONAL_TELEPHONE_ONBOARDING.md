# Stage 8.15.4.7b — Provisional Telephone Onboarding

## Summary

Retains the original Dorian caller experience (new caller / returning caller), with a dedicated provisional Relish identity instead of conflating caller ID with an existing authenticated Relish login.

- A phone number is normalised and HMAC-indexed, encrypted at rest.
- Unknown number creates a passwordless/email-less provisional User, canonical Person, separate General ContextSpace, linked self-contact, and NetworkPhoneCaller, in one transaction.
- A unique conversation ID, shared binding and generated opaque `relish_network_session` bind the initiation response to the existing post-call custody validator. No token is logged.
- Returning callers receive a generic welcome based on historical sessions (not prior private data). Prior private understanding is **not** injected into caller-ID-only conversations.
- Unmatched/invalid, missing conversation ID, or already-used conversation ID never gain an authenticated user's private workspace.
- The old per-agent configurable greeting templates are not migrated in this slice; two safe fallback messages are used. Agent configuration UI is a separate follow-up.
- The current 8.15.4.7 signed empty-call handling stays intact.

## Limits to confirm before public pilot

- Caller-ID spoofing and reassignment mean number recognition is not authentication. Do not allow authenticated account linking, LU reads, account modifications or sensitive tool actions without independent verification.
- Provisional `User` records are internal storage containers, *not* login-enabled accounts; their eventual account-claiming/merging requires an explicit verified flow.
- The first message override must be enabled in ElevenLabs Security > Overrides. If disabled, the fixed first message applies but custody still works.
- Review telephone consent and retention disclosures and confirm the provider's returned conversation ID matches initiation and post-call callbacks.
- A session created but not completed can count as a previous attempt. A later stage should count only completed participant interactions and handle failed calls on a per-call status.

## Migration: REQUIRED

Run on the *development* database only after backup and review:

```powershell
npx prisma migrate dev
npx prisma generate
npm run check
node --test tests/core/stage8-15-4-7b-phone-provisional.test.mjs
```

Do not run `npm run build` locally. No Telnyx or ElevenLabs secret changes are needed.

## Live acceptance

1. Call Dorian from a new test number. Confirm initial first message, valid initiation response and conversation transcript.
2. Confirm `NetworkPhoneCaller` exists and maps to **its own** User/Person/ContextSpace/Contact, not the deployment owner.
3. Confirm post-call `STORE` and `ATTACH` refer to that same provisional User and ContextSpace.
4. Call again and confirm returning greeting and same provisional identity (no duplicate user).
5. Call without caller ID. Expect generic conversation but no participant transcript import.
6. Call from a second number. Confirm complete isolation and no retrieval of the first caller's private data.
7. Test concurrent calls and retry handling. Inspect failed-call behaviour before public rollout.

This code has not been tested against live Neon/ElevenLabs. Validate migrations on your dev database and run the end-to-end checks.
