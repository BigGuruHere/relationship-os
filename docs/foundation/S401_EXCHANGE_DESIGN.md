# S-401 Exchange claiming and reciprocal People

Status as of 2026-11-07. Initial design merged through PR #29 at development 56eec62. Phone/email revision merged through PR #30. Runtime implementation follows in S-402 through S-404. This deliverable requires zero Prisma migrations.

> Direction correction, 2026-11-07: [S-405 / D-027](S405_ACCOUNT_CHANNELS_AND_EXCHANGE.md) supersedes the fresh-per-exchange proof requirement and manual form for existing users below. This document retains the historical design behind S-402/S-403. Account-owned reusable assurance and authenticated profile confirmation are planned in S-405, not implemented by its documentation stage.

## Agreed experience

Mark shares a selected public card. Betty chooses Save contact and sends her details back. Mark immediately receives Betty in My People. When Betty joins or signs in through that exchange, Relish automatically saves Mark's shared card in her My People. Each receives a private record of the information exchanged. Account associations are established after the claim's verification succeeds.

A future My Settings preference, “Automatically add people I exchange details with”, defaults to enabled. Disabling it applies to future automatic additions. Existing records retain their lifecycle. Ongoing profile updates have a separate permission and later delivery stage.

Use the existing three screens. Add concise copy beside Send explaining that the exchanged details will be available in My People when the visitor joins. Viewing a card grants public viewing only. Browser download completion is unobservable, so use the explicit Save contact action and successful Send as the exchange intent. Skip and abandoned submissions retain their current outcomes.

The visitor may share a phone number, email, both, or neither, with an account optional. The resulting private contact remains usable. Verification and account association can be completed later with a new explicit exchange. Historic receipts created before secure claim issuance remain historical evidence.

## Source assessment

| Current source | Reuse | Required extension |
| --- | --- | --- |
| src/routes/u/[slug]/share-details/+page.server.ts | Existing form, consent, origin checks and signup transition | Bind successful submission to durable exchange continuation |
| src/lib/server/foundation/capture.ts | Transactional private person, encrypted receipt and nonce retry protection | Issue claim in the same transaction and retain the selected shared-card snapshot |
| src/lib/server/profileOnboarding.ts | Temporary draft and allowlisted auth return | Carry a separate opaque claim continuation through signup |
| src/lib/server/foundation/provisioning.ts | Enrollment locks and private-home creation | Explicit DEV cohort admission for fresh test accounts |
| src/lib/server/foundation/policy.ts | Lifecycle checks and server-issued authority | Narrow exchange settlement operation across two private vaults |
| src/routes/auth/google/callback/+server.ts | OAuth callback with verified-email check | Fresh assurance bound to exact claim and account |
| src/lib/server/integrations/telnyx/messaging.ts | Direct outbound SMS with configured sender, timeout and redacted errors | Deliver claim codes through the existing transport |
| src/lib/server/core/relishPolicySms.ts | Durable queue and delivery lease pattern | Purpose-specific verification dispatch and expiry |
| src/lib/server/integrations/elevenlabs/phone.ts | Shared phone normalization conventions | Strict country-aware verification destination validation |
| src/lib/server/magic.ts | Existing token and URL concepts | Email delivery currently logs links. Add an email transport in the follow-on slice |
| src/lib/leads/link.ts | Historical reciprocal-contact behaviour | Retain its legacy domain boundary |
| prisma/schema.prisma | Foundation subjects, sources and private custody | Add exchange, verification and account-association persistence |

Password registration currently establishes an account with supplied email. A successful password login alone cannot establish control of the exchange's submitted address. Google email matching and browser cookies also require the exact exchange capability and account-bound verification contract.

## Proposed verification contract

The agreed design accepts either phone or email verification. If the exchange includes both, the claimant can choose an available channel. One successful verification is sufficient for the exchange claim. S-402 implements SMS first, with email delivery following on the same challenge service. The interface offers each channel once its transport is operational.

The claimant holds the exchange continuation, authenticates to the beneficiary account, and completes a challenge sent to a channel recorded in that exact exchange. Bind the challenge to exchange, claimant account, browser continuation and current session. Resolve its destination from server-held exchange data. Switching accounts invalidates the pending challenge. Switching channels or resending rotates the challenge generation and invalidates older codes across both channels.

Phone verification can associate the submitted number with the authenticated claimant even when that account signs in by email. Require a fresh challenge for changed numbers or addresses. If an existing verified association conflicts, stop automatic linking and require reviewed recovery. Keep channel normalization separate from identity matching. A shared or reassigned number must never cause account merging, account recovery or private disclosure by itself.

Use a high-entropy continuation secret and a cryptographically random short verification code. Store a keyed digest of the short code, bound to its challenge ID, and compare in constant time. Proposed initial expiry is 24 hours for continuation and 15 minutes for a challenge, with five attempts. Apply persistent limits per challenge, account, destination and request origin, plus bounded resends and a delivery budget. Resends cannot reset the aggregate failed-attempt limit. Consume verification through an authenticated same-origin POST.

The direct Telnyx sender uses TELNYX_API_KEY and RELISH_DORIAN_SMS_NUMBER in the executing application environment. The claimant enters the code in the browser. Inbound SMS routing and caller ID supply no challenge-completion proof. Before live DEV acceptance, verify its configured sender and destination allowlist using an explicitly authorized test send. Source inspection establishes transport capability, while live configuration remains unverified.

Adapt the existing durable delivery lease pattern with verification-specific state. An outbox stores the destination and retryable message encrypted until delivery or expiry, with only the keyed code digest retained for validation. Recheck challenge generation, lifecycle and expiry immediately before dispatch. Delete encrypted delivery payloads after success or expiry and during erasure. Delayed or duplicated SMS must leave older codes invalid. Diagnostics contain safe references and provider status only.

The existing phone helper permissively strips characters and infers country. S-402 must validate country and complete international number structure before normalization, reject malformed or ambiguous input, and bind the resulting canonical destination to the exchange. Changing the displayed destination requires a fresh exchange or reviewed recovery.

For an exchange without a supported channel, expired continuation or lost browser binding, keep its saved contact and offer a fresh exchange. Record successful assurance as channel type, encrypted canonical destination, verification time, method, challenge/exchange reference and authenticated beneficiary. Apply existing retention and withdrawal rules.

Dorian may later use this channel-assurance record when resolving a returning caller. Caller-ID recognition remains provisional. Sensitive access or changes can require fresh verification bound to that action. A completed exchange challenge grants only its defined claim authority.

## Proposed persistence and settlement

Physical names and final SQL constraints are confirmed in S-402 before adding a migration.

| Record | Required fields and constraints |
| --- | --- |
| Exchange | ID, origin profile and owner/vault, captured subject/source, encrypted shared-card snapshot and version, continuation hash, expiry, status, beneficiary account after binding |
| Verification challenge | Exchange, beneficiary, session binding, channel type, encrypted canonical destination, keyed code digest, verified time, expiry, attempts, consumed time, delivery status and resend generation |
| Account association | Custodian/vault/subject, associated account, assurance method, exchange, version and active/revoked state |
| Settlement receipt | Unique exchange, beneficiary, local subject IDs for both directions, selected automatic-add outcome and completion time |

Reference the originating subject/source through composite custody foreign keys. Keep the shared card snapshot limited to fields published in the selected profile at exchange time. Record publication, capture consent version and exchange intent. Shared evidence has its own owner-private encrypted copy. Claim responses expose only the claimant's own result.

Settlement locks both accounts in a deterministic order, then both vaults and the exchange. Recheck enrollment, vault state, expiry, proof, beneficiary and association status after acquiring locks. Write the verified association, Betty's private entry for Mark, reciprocal provenance and consumed receipt in one transaction. A retry by the same account returns the prior result. A competing claimant receives a generic refusal.

Implement the cross-vault operation as one narrowly scoped server service with explicit source-publication and destination-creation authority. Existing owner-private readers continue to require their owner's authority. Test query guard enforcement for every new model and operation.

For the first supported slice, both sides use ACTIVE foundation vaults in the explicit DEV cohort. Legacy and mixed-domain exchanges keep capture available while account settlement remains pending or unavailable with a clear user message. Fresh signup admission is server-managed and atomic with the new account's private roots.

Use existing verified account associations to avoid creating a second active person entry on repeated exchanges. Unverified name/email matches remain separate for owner review. An archived person requires an explicit restore choice. Repeated delivery and retry must never silently resurrect archived records.

Each future automatic-add preference is evaluated for the account receiving an automatic addition. The implementation should keep that policy decision in the settlement service, initially enabled, so later Settings can supply it. An explicit Send to Mark still delivers Betty's submitted details to Mark. The preference controls automatic saving of Mark into Betty's list.

## Changes, unlinking and erasure

A successful claim preserves the exchanged snapshot. Profile edits become available through the later continuing-sharing permission. Before settlement, profile withdrawal blocks copying the card and offers a fresh exchange when sharing resumes.

An owner can archive their own entry independently. Revoking an account association prevents future use of that association and its dependent sharing permissions. Retain private notes under their existing custody and retention rules. Reclaim after revocation requires fresh proof and explicit action.

Extend P-305 review and erasure to include exchange records, challenges, associations, settlement receipts and pending delivery work. Suspension blocks settlement under the same account/vault locks. Erasure removes secret material and private snapshots, cancels delivery, and retains only approved minimal routing/replay tombstones. Resolve inbound and outbound references before account deletion. Backup replay must reapply withdrawals before restored data serves traffic.

## Implementation slices

| Slice | Deliverable | Acceptance |
| --- | --- | --- |
| S-401 | This source-grounded design and decision record | Product flow, assurance, lifecycle and DEV scenarios specified |
| S-402a | [Exchange, challenge and dispatch schema](S402_EXCHANGE_SCHEMA.md) | Additive migration, custody and immutable binding tests |
| S-402b | SMS service, association/settlement persistence, budgets and privacy integration | Replay/account-switch rejection, atomic settlement, concurrency and erasure tests |
| S-403 | Wire existing exchange/signup/People screens and DEV test admission | Both accounts see the shared details, retry returns one result, Skip works, archived contact stays archived, password and Google flows verified |
| S-404 | Unlink/recovery UX and DEV acceptance | Revocation, expiry, suspension and erasure races exercised, clear recovery and operator evidence |
| Follow-on | Email verification through the shared challenge service | Channel switching invalidates old challenges, either supported channel settles once |
| Later | Settings preference and continuing profile updates | Preference applies to future exchanges, directional field grants and revocation verified |

S-402 and S-403 require a source-reviewed migration plan. No production promotion follows from completion of this design. Ordinary feature acceptance runs on Railway DEV with synthetic data. The operator deferred the separate hosted restore exercise on 2026-11-07 until rollout preparation.

## Two-account DEV acceptance

Use two fresh explicitly admitted foundation accounts and separate browser sessions. The current setup permits one generated test login, so S-403 must add a bounded two-account DEV fixture through the existing owner setup. Keep the canonical origin, explicit database binding and owner authorization checks. Verification delivery uses controlled test phone numbers, later email addresses and a test transport locally.

1. Mark publishes a selected test card. Betty saves it and sends her test details. Check Mark receives one private person and the source snapshot.
2. Betty completes signup and SMS verification through that exchange. Check each private directory contains the other person's shared details.
3. Repeat with an existing signed-in Betty, then retry submission and settlement. Verify one settled exchange and stable person IDs.
4. Create private notes on each side. Verify all ordinary reads, search and errors expose only the authenticated owner's records.
5. Switch accounts before verification, reuse an expired or consumed challenge, forward a continuation without its bound session, and change submitted details on retry. Verify controlled refusal and unchanged custody.
6. Run concurrent settlement, suspension and archive tests in the database suite. Inject a late failure and confirm both vault writes roll back together.
7. Exercise missing or unsupported channels, delivery failure, profile withdrawal, self-exchange, revoked association and a pre-existing unverified duplicate. Require explicit recovery where proof or active ownership is missing. S-402b refuses self-account claims before issuing proof; S-403 must return the existing self/profile experience before a new self capture.
8. Test wrong-country and malformed numbers, phone-only exchanges, channel switches, shared-number conflicts, resend abuse, delayed delivery and codes from another DEV/PROD environment. Verify only the bound challenge can complete.
9. Verify public Save contact, Send, Skip and optional signup on real mobile browsers. Record deployed SHA and outcomes.

For production readiness, retain the deferred hosted recovery exercise and the existing account closure, retention and cohort approval gates. The design enables DEV implementation while those release obligations remain tracked.
