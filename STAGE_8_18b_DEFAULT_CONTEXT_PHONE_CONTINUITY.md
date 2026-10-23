# Stage 8.18b - Default ContextSpace and Returning Telephone Continuity

**Built on:** Stage 8.18a SMS diagnostics, retaining Stages 8.16 to 8.18.

**Migration required:** YES, `20261023180000_stage8_18b_default_context_phone_continuity`.

## Purpose

A person who first enters Relish through a Business, Friendship or Dating QR code should be able to call the **same Dorian telephone number** directly on a later day and continue in their own private ContextSpace without another QR invitation.

This stage changes *telephone context selection*, not the identity assurance of a caller ID. Phone-number recognition is provisional, not account verification.

## Current behaviour after this stage

| Scenario | Result |
| --- | --- |
| Brand-new telephone participant uses a Business QR/SMS invitation | Provisional User, canonical Person and **Business** self-contact/ContextSpace are provisioned directly; no extra General space is created. Business is their initial default. |
| First entry is Friendship QR | The underlying `general` domain remains the Friendship pilot's technical representation, and becomes the default. |
| First entry is Dating QR | A separate Dating ContextSpace is the initial default. |
| Returning direct inbound telephone call | The caller's server-resolved, owned `User.defaultContextSpaceId` is selected. Context-specific self-contact, previous call count, last-call summary and Living Understanding are used if available and enabled. |
| Earlier 8.18/8.18a participant whose first successful callback was Business or Dating | On next direct call, a NULL default is lazily resolved from their earliest validated QR-linked session, and pinned. No new identity or migration of existing transcripts. |
| Earlier direct-phone caller with existing General conversations | Preserves General as their default rather than silently redirecting personal data. |
| Another QR invitation in a different context | That conversation uses its invitation context but **does not override an existing default**. |
| Registered user visits context Settings | Can select *that owned ContextSpace* as their account's default starting space. |
| Unknown direct caller without QR | Existing General fallback is retained because there is no trusted source for another domain; it becomes their selected starting space. |
| Another future context type | `ContextSpace.domainKey` remains an extensible string. The default stores a concrete ContextSpace ID, although telephone processing must explicitly support new domain types before enabling them. |

## Custody and identity details

- A new nullable `User.defaultContextSpaceId` stores a ContextSpace ID, protected by a foreign key with `ON DELETE SET NULL`.
- Every use verifies `ContextSpace.ownerUserId` and the self-contact's owner, linked User and canonical Person. A foreign-context pointer fails closed; it never falls back to the deployment owner.
- Existing `NetworkPhoneCaller.contextSpaceId/contactId` remain for compatibility and for original General phone calls. The caller's default now lives on User and may differ from those original fields.
- Session tokens remain random, hash-stored and bound to the specified provider conversation and shared Dorian binding.
- Post-call ingestion resolves the originally issued session's actual ContextSpace, even if the person later changes their default.
- The automatic LU worker also reads context/contact from the immutable per-conversation session, not the old phone caller's General fields.
- If a QR conversation is still queued/processing, a direct return call enters the existing processing-only notice rather than incorrectly retrieving unfinished understanding.
- Preferred names are saved only under an authorised session to the session-owned self-contact.
- Returning callers are asked who is calling before Dorian is instructed to use provisional previous context. This is still not strong identity verification and should not unlock sensitive registered data.
- **No cross-context understanding is merged, shared or retrieved.** A default chooses a starting context only.

## Scope kept deliberately unchanged

- The existing single Dorian telephone number, SMS invitation and outbound callback.
- Telnyx webhook forwarding and the independent Railway proxy routing.
- Existing browser widget and QR public profile behaviour.
- Provisional caller ID rules and opt-in settings `RELISH_PHONE_LU_CONTEXT=YES` and `RELISH_PHONE_AUTO_LU=YES`.
- Existing database separation: local and Railway Dev use Neon Dev; Railway Production uses Neon Prod.
- The existing SMS Terms/Privacy notice and call-consent flow.
- The broker CRM remains outside ordinary Business navigation.
- The abandoned Stage 8.15.4.7a migration has not been restored.

## Installation for local development

1. Back up source and Neon development database.
2. Replace the local application source using the complete Stage 8.18b ZIP. No proxy source changes are needed.
3. Run:

   ```bash
   npx prisma migrate dev
   npx prisma generate
   npm run dev
   ```

4. Keep your existing `.env` and Telnyx/ElevenLabs/Railway configuration. Do **not** run a local build step.
5. Commit dev changes, then deploy through your existing dev to master workflow once the tests pass. If Railway uses `start:with-migrations`, `prisma migrate deploy` runs during the production service startup, but confirm your actual deployment configuration before releasing.

**Migration notes:** one nullable User field, index and foreign key. Existing User, ContextSpace, Contact, NetworkPhoneCaller, session, interaction and Living Understanding records are not rewritten or deleted. Existing default selections are computed on first eligible telephone call rather than backfilled in bulk.

## Acceptance tests to run in development

### A. First QR and direct-return continuity

1. Use a **new phone number not already recognised by Relish** (or a safely isolated new test identity).
2. Open Business QR → Call Dorian → send newly generated SMS within 20 minutes → answer callback.
3. Have a brief meaningful conversation and confirm the signed transcript is imported and LU worker finishes (`APPLIED` or `NO_CHANGE` as appropriate).
4. Call the saved single Dorian number directly from the same phone, without revisiting QR.
5. Confirm the incoming call resolves to the **same User, Person, Business ContextSpace and self-contact**. Verify `previous_calls > 0`, the last-call summary, and the Living Understanding when `RELISH_PHONE_LU_CONTEXT=YES`.
6. Repeat first-time paths using Friendship and Dating phones. In particular, no Business or Dating participant should have a **newly-created General space solely because of the initial SMS callback**.

### B. Privacy and switching

7. Send a second QR invitation into another context for the same provisional caller. Its call should use the new invitation context, but a later unscripted direct call should still use the original default.
8. From an authenticated account's `/space/business/settings` or corresponding Friendship/Dating Settings, select the current owned space as default and confirm it is shown as selected on reload. The telephone identity must be securely linked to that account before this setting can affect a phone-only provisional identity.
9. Test a stale or foreign-owned default ContextSpace ID: the call must not receive private context or issue a valid private session.
10. Test a second direct call while automatic LU is still queued. It should use the processing-only message.
11. Test that a previously created General phone participant with legitimate General conversation history stays in General.
12. Check the operator Conversation Monitor and automatic LU worker for imports attributed to the **actual** default/selected space. Try missing caller ID, duplicate initiation and duplicate signed webhook events.

### C. Source-level checks

```bash
node --test tests/core/stage8-15-4-7*.test.mjs \
  tests/core/stage8-16-three-context-pilot.test.mjs \
  tests/core/stage8-17-contextual-ui.test.mjs \
  tests/core/stage8-18-sms-context-callback.test.mjs \
  tests/core/stage8-18a-sms-diagnostics.test.mjs \
  tests/core/stage8-18b-default-context-continuity.test.mjs
```

## Read-only database diagnostics

Use the **Neon Development** SQL editor, not Production:

```sql
-- Examine recent provisional phone identities and their selected default spaces.
-- Intentionally omit telephone numbers, invitation codes and content.
SELECT
  c."createdAt" AS "phoneProvisionedAt",
  c."userId",
  u."personId",
  u."defaultContextSpaceId",
  d."domainKey" AS "defaultDomain",
  c."contextSpaceId" AS "originalPhoneContextSpaceId"
FROM "NetworkPhoneCaller" c
JOIN "User" u ON u."id" = c."userId"
LEFT JOIN "ContextSpace" d ON d."id" = u."defaultContextSpaceId"
ORDER BY c."createdAt" DESC
LIMIT 15;
```

`originalPhoneContextSpaceId` may still be General for an upgraded participant. That is expected. The active inbound session must use `defaultContextSpaceId`, verified against their own self-contact.

## Tests and limitations

- **98/98** focused inherited and new telephone/QR/source tests passing in the artifact environment (including six new tests that execute the real default-context resolver with mocked Prisma data).
- No TypeScript syntax diagnostics in the modified source during standalone compiler parsing.
- **Not tested here:** Prisma generation/validation against installed dependencies, full SvelteKit typecheck, live Neon migration, or real Telnyx/ElevenLabs round-trip. These are release gates, not assumed successes.
- Browser-provisional identities and phone-provisional identities still do **not** automatically merge. Linking them requires verified channel ownership and a later account-claiming stage.
- The Business review URL is now representable for processing, but a full Business Living Understanding review UI remains a separate UX task.
- `General` is retained for existing records, Friendship's current technical domain and brand-new ordinary direct callers without an invitation. No deletion/migration of legacy records is attempted.
