# My People Stage 2 — profile/QR Contact capture and optional summaries

## Branches and scope

Stage 1 and its existing transcription diagnostics were fast-forwarded into `development` at `15b43d9`. The merged `feature/my-people-stage-1` branch was deleted locally and on GitHub to mark it complete. Its commits remain reachable from development. Stage 2 starts there on `feature/my-people-stage-2-qr-capture`; it is not merged into development or master.

No transcription provider, model, microphone constraint, audio chunk handling or recording logic was changed in Stage 2. The shared note form changes are confined to optional summaries. No Railway deployment or configuration operation was invoked. Existing Git-triggered deployment behavior, if configured by the user, remains outside this code change.

## User experience

Existing published profile URLs and QR codes continue to work. `/u/[slug]` now includes **Share your details**, separately from Dorian. The configured event landing also offers it without removing event signup. Existing QR infrastructure opens these profiles; QR codes need not be regenerated when their public destination is unchanged.

The link opens `/u/[slug]/share-details`: a mobile form for a name plus optional email/telephone. It explicitly requests permission to save details privately for personal follow-up. This is distinct from a pilot/signup consent or a request to establish a mutual relationship.

A successful submission appears as a newly created Contact near the top of the owner's `/people` directory under **Recently added**. The owner opens the Contact and uses the same Stage 1 voice-note route and recorder. Contact history shows when details were shared through the profile.

An optional **Summarize** button is restored on the My People note screen. It sends the owner's current draft to the existing summary helper/model only on request. The owner can edit the generated summary and explicitly save it alongside the original note. Both are encrypted and retrievable in history. Summary failure leaves note saving available. This does not create embeddings, grant disclosure/matching permission, or admit the note to Living Understanding.

## Ownership, provenance and identity

- The published profile resolves the owner server-side. Submitted owner, context, Contact and identity IDs are ignored.
- Both manual and QR capture use Core's shared Contact creation service. Optional transactional client support allows Contact and provenance to commit atomically.
- Destination is the profile owner's existing/new neutral private WORKSPACE, resolved through Stage 1's private-home service. Profile kind is origin information, not Contact classification. Existing defaults and Contacts are unchanged.
- The named `PUBLIC_CONTACT_CAPTURE` custody boundary permits flat Contact creation plus read/create/count of capture receipts. It grants no Contact lookup, update or delete permission. Signed-in visitors receive the same public capture authority through an explicit cross-owner boundary.
- Contact `source=INBOUND` and `sourceProfileId` record the intake. A dedicated encrypted Interaction with channel `CONTACT_CAPTURE`, sourceType `API`, and `STORED_ONLY` stores versioned structured provenance: profile ID/kind, capture channel, submission time, supplied-field names, unverified identity status, and the explicit consent purpose/version/time.
- `entryHint` distinguishes QR/event/profile-link URLs but is explicitly marked as an **unverified link hint**. A URL parameter is not proof that a physical QR was scanned or an event was attended.
- The public receipt reveals no private Contact ID, match or owner-private information. Owner history renders the capture event as origin information rather than an owner-authored note or established fact.
- No User, Person identity bridge, reciprocal connection, Brokerage Lead, pilot signup or verified link is created. Existing same-name/email/phone Contacts are never queried, merged or overwritten.
- Submitted details and provenance remain available for a future verified linking workflow. They are not identity proof or consent to merge/disclose private histories. That future workflow is deliberately not implemented.

## Retry and abuse protection

A server-signed, profile-bound, 30-minute token is also bound to an anonymous HttpOnly/SameSite browser cookie. It contains no submitted details. POST requires the same origin, explicit consent, valid fields and a valid receipt. A honeypot returns a generic receipt without writes. Bodies larger than 8 KB and unsupported form encodings are rejected.

The signed submission nonce determines the capture Interaction's unique external reference. A per-profile PostgreSQL advisory transaction lock serializes duplicate retries and quota checks. Replaying the same successful receipt cannot create a second Contact or change its details. A fresh form submission with the same name/email/phone is separate unverified information, not an automatic identity match.

A persistent per-profile limit allows up to 100 new captures/hour. A bounded, short-lived in-memory limiter adds a 10/hour cap per current browser-cookie/profile pair. The persistent cap applies across instances; the browser cap is supplementary and is not identity verification. Already-successful receipt retries remain safe when the cap is reached. No raw IP address or visitor details are logged by this intake.

## Database migration

**None required.** Existing Contact fields, ContextSpaces and encrypted Interactions are reused. No existing records are migrated, reclassified, merged, reset or deleted by application code. The local test runners create and delete only their own synthetic fixture accounts/records.

## Validation

- `npm run check`: zero errors/warnings.
- `npm run build`: passed without live provider credentials.
- `npm test`: 870 tests, 820 passed and the same 50 pre-existing assertion failures. No new failing names compared with the saved baseline.
- `scripts/check-contact-capture.mjs`: 11 local integration checks passed, including two-browser mobile capture/record/edit-summary/save/reload, anonymous/signed-in visitors, consent, origin/token tampering, profile/browser binding, encrypted provenance, retry concurrency, quotas, publication revocation and unchanged pre-existing Contacts/Interactions.
- Stage 1's `scripts/check-my-people.mjs`: all 14 checks passed against the Stage 2 build, retaining manual and Brokerage behavior.
- All AI/transcription behavior in integration tests is mocked. No external provider, production credential or production database was used.

To reproduce in Codex with the normal injected development variables:

```sh
export PATH=/workspace/.cloud-tools/node_modules/node/bin:$PATH
export DATABASE_URL=postgresql://agent@127.0.0.1:5432/relish_local
npm run check
npm test
npm run build
```

Start the local build in another terminal with the same local database:

```sh
HOST=127.0.0.1 PORT=5177 ORIGIN=http://127.0.0.1:5177 RELISH_EVENT_PROFILE_SLUG=local-stage2-test-event RELISH_CONTROL_PLANE_ENABLED=NO RELISH_PHONE_AUTO_LU=NO node build/index.js
```

Then run `node scripts/check-contact-capture.mjs`. It rejects non-loopback/non-relish_local databases. Run `PEOPLE_TEST_ORIGIN=http://127.0.0.1:5177 node scripts/check-my-people.mjs` separately, not concurrently with the other fixture runner. Chromium and Python Playwright are already available in this Codex environment.

## Railway DEV test procedure

1. Review and deploy **feature/my-people-stage-2-qr-capture** to the Railway **DEV** application using your normal manual process. Do not select the production service or master. Stage 2 is not yet on development.
2. Confirm the DEV app uses its DEV database and DEV APP_ORIGIN/cookies/credentials. No new configuration variable or Prisma migration is required. Existing transcription/summary provider credentials are needed only to exercise those optional external actions. No production credential should be copied.
3. Sign in as a profile owner on DEV. Open an existing published profile/Share screen and display its QR. Verify its link uses the DEV host, not app.relish.live.
4. With a second device or private browser, scan the QR. On the profile (or configured event landing), choose **Share your details**. Submit a distinctive test name and optional email/phone, with the separate private-contact consent. Do not choose Dorian or event signup for this test.
5. Confirm the visitor sees a generic thank-you without login/account prompts. In the owner's DEV session, open `/people` and refresh: the new Contact should be near the top of Recently added. Use search if needed.
6. Open that Contact, choose **Record voice note / Add note**, record and review/edit the transcript. Optionally choose **Summarize**, review/edit the summary, and explicitly **Save note**. Reload the Contact and verify both original note and summary remain visible.
7. Verify that the existing Brokerage Contacts still work at their current routes and are not reclassified into My People. Existing event signup and Dorian options should still be present and separate.
8. For a retry test, resubmit the same browser POST/receipt: no second Contact should be created. Opening a fresh form and deliberately submitting identical details creates a separate Contact; it never silently overwrites or links identity.

A second DEV account must not be able to open the captured Contact or its note/summary endpoint. Do not use real sensitive personal details for these tests. No live microphone/transcription or summary provider result has been independently validated by Codex for this release; local end-to-end tests use offline mocks.

## Main files

- Core: `contacts.ts` transactional reuse, `contextSpace.ts` narrow capture reason, new `contactCapture.ts` and `contactCaptureToken.ts`.
- Public UI: new `routes/u/[slug]/share-details/`; small links/load data additions to the existing profile and event pages.
- Notes: shared `ContactNoteForm.svelte`; new private Contact-scoped summary endpoint; existing People save/detail/history adapters persist and render summaries and capture origin.
- `ai.ts`: summary error logging redacted; transcription code unchanged.
- Tests: `tests/core/contact-capture.test.ts`, `scripts/check-contact-capture.mjs`, `scripts/check-contact-capture-browser.py`.
