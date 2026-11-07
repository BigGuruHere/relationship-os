# S-405b Owned-profile exchange

Date: 2026-11-07. Implemented on `feature/s405b-profile-exchange`, based on development `8fe9117` (PR #37). Not merged or deployed at this writing.

## Behavior and reuse

An authenticated ACTIVE foundation user can choose **Share my details back** on another ACTIVE user's public card. The existing share-details screen shows owned profile previews and a confirmation button for each. It also offers the existing profile editor to create an unpublished card and return to confirmation. Continue later/cancel returns without sharing. Existing guest capture and SMS claiming remain available.

The service lives in the existing exchangeClaims module and reuses persisted session checks, sorted account/vault locks, profile row locks, private person/evidence writers and PROFILE account associations. Both private entries, receipts and the settlement outcome commit together. Existing ACTIVE account links are reused and another receipt appended without overwriting private notes or directory fields. Unverified duplicate contacts are not merged; archived/revoked associations require recovery. No continuing sharing, mutual Connection, channel verification or automatic publication follows.

An encrypted 30-minute preview binds the account, session, browser, target, selected profile and exact name/email/phone projections. Confirmation rechecks ownership and both projections under locks; changed fields require a fresh preview. Retry uses the immutable exchange ID. Existing global exchange serialization covers confirmation, suspension and privacy cleanup; persistent hourly account/target budgets bound new confirmations. No SMS challenge, dispatch or false phone/email assurance is created.

Profile creation reuses an encrypted account-bound 30-minute return cookie and a fixed internal path. The editor can save a draft and return without publication. The new path is gated by the existing DEV browser flag, realm and database binding, with both roots ACTIVE. Legacy and mixed-domain cases retain established capture. A foundation failure does not fall through into legacy writes.

## Migration and rollback

No Prisma migration is required. Existing FoundationExchange supports a completed PROFILE-authorised exchange with no SMS challenge, and existing association constraints already allow PROFILE. Schema count remains 109 migrations / 20 foundation tables. Do not run a migration for this stage. Disable the existing exchange browser flag to stop new exchange UI; retain compatible exchange privacy handlers for saved records. Never drop additive schema or route records into Brokerage as rollback.

## Verification

Focused local service and regression checks cover no-send confirmation, unpublished selection, concurrent retries, existing-link reuse, changed previews, tampered tokens, wrong session/browser/target, expired previews, forged profile ownership, late rollback and suspension/erase cleanup. Route tests exercise same-origin refusal, fixed-target forwarding and account-bound editor return. The native Chromium fixture adds owned-profile form submission with no code or retyped contact inputs. Local Chromium cannot launch in this runtime because the process singleton socket is denied; CI browser and PostgreSQL results are recorded in the PR. Local validation: 51 focused service, boundary, route, onboarding and multi-profile checks passed; Svelte check reported zero errors/warnings. CI PostgreSQL and native Chromium results are recorded in the PR.

## DEV acceptance after merge/deployment

1. Use two separate admitted test logins. Publish Mark's selected card. With Betty signed in, open it and choose Share my details back.
2. Confirm an existing Betty profile. Check both My People lists; no SMS should be requested or sent. Repeat and check person IDs/history remain stable.
3. Choose Create a new profile, save it unpublished, then confirm from the returned preview. Check its public link remains unpublished and exchanged fields match the preview.
4. Cancel creation and Continue later; confirm no exchange is created. Edit details after opening a preview and submit the old form; it should request a reload rather than share changed fields.
5. Check guest Send/Skip/SMS claim and existing Brokerage flows still work. Record running SHA and actual results. Production remains deferred.

Account-channel persistence/reusable phone and email assurance remain S-405c/d, not implemented by this stage. Logged-out existing users can choose Sign in to choose a profile; a temporary encrypted navigation hint returns through the existing fixed auth destination. No exchange is completed until profile confirmation.
