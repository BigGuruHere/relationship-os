# Relish / Relationship OS - Stage 8.16 - Three context pilot

**Three-context QR profiles, private Dorian onboarding and first-party Product Intelligence**

**Based on:** uploaded Stage 8.15.4.7g.3b source ZIP dated 22 October 2026.  
**Delivery status:** implementation source package prepared, **not live-deployment certified**.  
**Prisma migration:** **YES**, `20261022233000_stage8_16_three_context_pilot`.  
**No local build required.** The existing Railway launch scripts and telephone worker were preserved.

## 1. What this stage implements

The owner can open `/profiles` to create or edit independently stored Business, Friendship (the existing `personal` profile kind) and Dating profiles. The editor selects strictly by kind, keeps stable URLs, and has explicit public publication control. Published profiles can be shared at `/share?profile=<slug>`; the displayed QR is rendered from `/api/qr` for the current configured origin and tags its landing `?via=qr`. The public `/u/<slug>` page labels its context and offers a tailored invitation to speak to Dorian.

A visitor explicitly accepting the invitation gets a server-side `PilotProfileEntry` that records its owner, source profile, visitor and domain. A registered visitor uses their own User and canonical Person. A visitor without a login receives a **separate provisional User and Person**, held by a 60-day, host-only, HttpOnly random browser credential whose SHA-256 hash alone is stored. This is **not an authenticated account** and cannot claim or recover an existing account. Browser continuity works only while the same browser retains that cookie; private/incognito windows create distinct provisional people. Cross-device/account claiming is deliberately not implemented.

The visitor's `business`, `general` or `dating` ContextSpace gets its own self-contact, using existing General Network logic where applicable. `/pilot/dorian/<entryId>` can issue a two-hour signed-token-compatible shared ElevenLabs session only when that visitor owns the corresponding pilot entry. The shared-session resolver verifies the binding, conversation ID, token hash, entry, Person's contact and ContextSpace. **Only a pilot entry authorises the domain extension; phone/legacy Network calls remain General-only.** The webhooks continue to use provider authentication, signed post-call transcription, private encrypted conversation storage, participant evidence and the existing automatic LU pipeline. Pilot calls are added to the opt-in worker queue, with success/`NO_CHANGE`/failure recorded on their own sessions.

A visitor can optionally provide **a name, email and explicit consent** to request contact with the profile owner. The details are encrypted separately and appear on the owner's `/profiles` page. That request does not grant access to their conversation, transcript, LU, other contacts or a different ContextSpace. Friendship's existing Network join route remains separate. A legacy cross-context `connectUsers` action has been disabled rather than letting it create misleading mutual relationships.

`ProductEvent` provides typed, allowlisted, first-party events. `/general/admin/product-intelligence` is limited to the signed-in profile owner with the existing owner role and General operator context. It shows raw counts by domain, participant count after opt-in, issued sessions, provider-confirmed starts, ingested completions, connection requests, optional usefulness feedback and recent pseudonymous journey sequences. It never reads the participant's LU, messages or raw transcript. The role restriction means pilot participants cannot see each other's activity.

## 2. New / changed technical surfaces

| Area | Files |
|---|---|
| Owner hub | `src/routes/profiles/+page.server.ts`, `+page.svelte` |
| Profile isolation and publication | `src/routes/settings/profile/*`, `src/routes/u/[slug]/*`, `src/routes/share/*`, `src/routes/api/qr/+server.ts` |
| Provisional visitor / event service | `src/lib/server/pilot.ts` |
| Invitation and voice widget | `src/routes/pilot/dorian/[entryId]/*` |
| Browser profile view signal | `src/routes/api/pilot/visit/+server.ts` |
| Provider and context-aware session | `src/lib/server/integrations/elevenlabs/networkSession.ts`, `src/routes/api/webhooks/elevenlabs/{initiation,+server}.ts` |
| Automatic pilot LU | `src/lib/server/core/phoneUnderstandingAutomation.ts`, `scripts/process-stage8-15-4-7f-2-phone-queue.ts` |
| Analytics | `src/routes/general/admin/product-intelligence/*` |
| Data and retention | `prisma/schema.prisma`, new migration, `scripts/prune-stage8-16-pilot.ts` |
| Source contracts | `tests/core/stage8-16-three-context-pilot.test.mjs` |

## 3. Local installation

1. **Back up the existing development Neon database** and retain the previous source ZIP. Ensure your local `.env` is using the intended **development** `DATABASE_URL`, not production.
2. Replace your local source working tree with the complete attached source (or merge it into your development branch). Keep your environment secrets, Git history and machine-specific files outside the ZIP intact.
3. Install dependencies if needed: `npm install`.
4. **Migration required:** run `npx prisma migrate dev`. This new migration creates `PilotBrowserSession`, `PilotProfileEntry`, `ProductEvent`, `PilotConnectionRequest`, adds `Profile.isPublished` and an optional `NetworkDorianSession.pilotEntryId`. It is additive and leaves old profiles published by default.
5. Regenerate the Prisma client if not already done by your dependency installation: `npx prisma generate`.
6. Launch your existing local application using `npm run dev`. **Do not run `npm run build` locally.**
7. Test at `/profiles`, then the real mobile QR flow and voice provider callbacks.

For mobile QR tests against a public development tunnel (for example ngrok), set `APP_ORIGIN_LOCAL` to the **correct, publicly reachable HTTPS tunnel origin** before generating/scanning the QR. A localhost QR link will not work from a different phone. Validate the exact URL embedded in the QR.

### Development/prod separation

Do not copy a development browser cookie or development `DATABASE_URL` into production. The app retains host-only and environment-namespaced cookies; ProductEvent and PilotProfileEntry record their originating environment. The existing Railway `start:with-migrations` command already uses `prisma migrate deploy`. **Confirm each Railway service actually uses that command** before assuming production migrations deploy automatically. Apply and test this stage in development first. Never manually patch Neon tables to implement normal visitor onboarding.

### ElevenLabs requirements

- `RELISH_NETWORK_DORIAN_BINDING_ID` must point to the one currently configured, active shared Dorian deployment in **that environment**. Without it, the pilot page correctly displays unavailable and refuses to put a visitor inside another owner's private deployment.
- The ElevenLabs widget domain/allowlist must include the external development host and production host.
- Verify the browser's `relish_network_session` dynamic variable appears both in initiation callback `dynamic_variables` and in signed post-call transcription `conversation_initiation_client_data.dynamic_variables`. The implementation deliberately does **not** fall back to owner data or client-provided contact/user IDs when a credential is absent.
- For automatic Living Understanding across browser conversations, keep the existing `RELISH_PHONE_AUTO_LU=YES` opt-in and worker configured. It now also drains pilot browser sessions. The telephone gate, greeting contracts and existing worker supervisor stay in place.
- After a successful conversation, check signed callback delivery, correct participant-owned transcript, source evidence, queued LU and eventual `APPLIED` or `NO_CHANGE`. An acknowledged widget display or session token alone **does not** constitute a completed conversation.

**Provider caveat:** Live provider/browser round-tripping and deployment-domain configuration could not be exercised in this offline source environment. Do not treat the widget or LU callback as production-verified until you pass these tests with the actual ElevenLabs account.

## 4. Event semantics

- `qr.landing_opened`: browser-rendered public page whose URL carries `?via=qr`. This is QR-tagged traffic **not cryptographic proof of a physical scan**.
- `profile.viewed`: rendered public page from an ordinary untagged link. Visits are anonymous and not linked to an identity until explicit opt-in.
- `dorian.conversation_requested`: participant expressly chooses the profile's Dorian invitation.
- `dorian.conversation_returned`: the same known visitor has requested Dorian for this exact profile before. Anonymous browsers without retained cookies do not get silently matched.
- `dorian.session_issued`: the server issued a scoped session, not proof that speech occurred.
- `dorian.conversation_started`: authorised provider initiation carrying the server session token and validated conversation ID.
- `dorian.conversation_completed`: signed post-call transcription was imported into the participant's private ContextSpace, with participant speech evidence.
- `dorian.conversation_failed`: server-controlled voice session launch failed; it is **not** a guess about microphone denial or participant abandonment.
- `relationship.connection_requested`: participant explicitly submitted name, email and consent; encrypted details are shared with this owner only.
- `value.reported`: explicit yes/no visitor response. It is not AI-inferred value.

Events have a schema version, environment, profile ID, owner ID, domain, optional journey/visitor/conversation IDs, allowlisted source and feedback value. A database unique idempotency key prevents webhook retries/duplicate session calls inflating provider-confirmed counts. No transcript, LU, prompt, contact fields, phone number, email or credential is recorded in `ProductEvent`.

**Reporting limitation:** small pilot percentages can mislead; use the raw counts. The initial operator page loads only the most recent 4,000 events and 100 entries. It displays a cap warning and must not be used as a lifetime cohort report above those limits.

## 5. Privacy, retention and deliberate limitations

- The profile's publication toggle protects the entire public profile. Existing public fields remain public when published; this is not yet a field-by-field audience permission engine.
- A provisional cookie is **continuity**, not real-world identity verification. Anonymous visitors may share a device. Do not use this pilot to show sensitive personal records on unauthenticated public screens.
- Visitor conversation data remains in **their own domain**. No cross-context LU, match eligibility or transcript-sharing permission is derived from a QR or connection request.
- A visitor's supplied email/name are self-declared and **not verified**. Owner follow-up is manual; no introduction acceptance, matchmaking, scoring or automated reciprocal contact is implemented.
- Expiration: provisional session credential expires after **60 days**. A supplied `scripts/prune-stage8-16-pilot.ts` opt-in cleanup deletes ProductEvents after **90 days**, entry provenance and associated connection requests after **180 days**, and expired/revoked browser sessions. It does **not** erase private conversation evidence, LU or the provisional User. Run retention cleanup monthly through your own operations after legal/privacy review; it is **not automatically scheduled**.
- To run cleanup, use the intended environment's database and explicitly set `RELISH_PRUNE_PILOT=YES` and `RELISH_PRUNE_PILOT_ENV=local|dev|prod`, then invoke `node --env-file=.env --import tsx scripts/prune-stage8-16-pilot.ts`. Take a backup first. The cleanup is irreversible.
- Account claim, comprehensive subject-access/deletion workflow, merged phone/browser identities, formal owner-acceptance workflow and multi-person relationship understanding remain future work.

## 6. Test status

**Completed in this delivery:** static TypeScript parse checks on modified server/worker code; 8/8 dedicated Stage 8.16 source-contract tests pass. A focused selection of earlier Stage 8.15 phone tests returned **15 passed, 3 failed**. The failures assert obsolete source text about phone-memory withholding/greeting phrases and historic development-only worker guards that were already absent from the uploaded baseline; they are stale source assertions, not a newly demonstrated behavioural regression. **They should be updated to test current actual contracts.**

**Not completed here:** Prisma CLI validation or migration execution against Neon, SvelteKit build/typecheck (dependency installation could not be completed in the offline environment), real browser UI, real QR scan, ElevenLabs initiation/post-call callbacks, automatic LU worker processing in a live DB and production rollout. Those are mandatory before labelling the pilot field-tested.

### UI and integration acceptance checklist

1. [ ] Create the Business profile, then Dating, then Friendship; repeat in different orders. Saving/editing any kind must not overwrite another kind or slug.
2. [ ] Set distinct headlines/bios/public contacts. Unpublish one and confirm public URL and QR endpoint return 404 while owner preview remains available. Republish it.
3. [ ] Use `/profiles` to show each distinct QR, scan on mobile, verify the destination uses the configured public origin and correct context invitation.
4. [ ] An anonymous first-time participant opts in. Verify a separate provisional User/Person, exact private domain and self-contact, without creating a relationship assertion.
5. [ ] Reopen the same browser within 60 days and request the same profile: recorded as returning, not another Person. Repeat incognito/different device: unrelated provisional identity; no fabricated merge.
6. [ ] Repeat as a registered user with General, Business and Dating ContextSpaces. Verify session issuance and transcript identity never use profile owner's context.
7. [ ] Configure the shared Dorian ElevenLabs agent. Complete voice initiation and post-call callback, check entry, domain, verified signed session token, correct event counts and no duplicate events after retry.
8. [ ] Verify the worker processes browser transcripts into *the visitor's* LU and shows `APPLIED` or `NO_CHANGE`. Confirm a concurrent second attempt does not race an in-progress revision. Run existing telephone first/returning/WAIT/NO_CHANGE/FAILED tests.
9. [ ] Confirm a visitor's optional connection request only shares the entered name/email and only appears in that profile owner's `/profiles`. A different owner and other pilot participants must see nothing.
10. [ ] Verify no owner/private LU, cross-context Contact, token, phone, transcript or email appears in ProductEvent, profile page, browser analytics payload or operator view.
11. [ ] Visit the Product Intelligence view with an owner account and check exact per-context raw counts. Try as a member/guest/unauthenticated user: denied. Check dev/prod event partitioning.
12. [ ] Check empty calls, browser microphone denial, missing session credential, wrong binding, forged entry URL, expired cookie, unpublished profile, webhook replay and separate Network join/removal routes.
13. [ ] Check normal phone provisioning, caller greeting/last-call continuity, automatic worker autostart, Dorian monitor and existing Railway/Neon deployment config against the current working baseline.
14. [ ] Verify retention cleanup against a **copy of the development database** before scheduling it operationally.

## 7. Future scope fence

Do not implement automated compatibility, network-wide matching, cross-context disclosure, a person-centric identity merge or complex relational scoring as part of Stage 8.16. The value of this stage is a small, safely attributed real-world experiment.
