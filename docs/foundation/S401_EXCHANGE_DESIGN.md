# S-401 Exchange claiming and reciprocal People

Status as of 2026-11-07. Design delivered on docs/stage-4-exchange-claims from development d572b1a. Runtime implementation follows in S-402 through S-404. This deliverable requires zero Prisma migrations.

## Agreed experience

Mark shares a selected public card. Betty chooses Save contact and sends her details back. Mark immediately receives Betty in My People. When Betty joins or signs in through that exchange, Relish automatically saves Mark's shared card in her My People. Each receives a private record of the information exchanged. Account associations are established after the claim's verification succeeds.

A future My Settings preference, “Automatically add people I exchange details with”, defaults to enabled. Disabling it applies to future automatic additions. Existing records retain their lifecycle. Ongoing profile updates have a separate permission and later delivery stage.

Use the existing three screens. Add concise copy beside Send explaining that the exchanged details will be available in My People when the visitor joins. Viewing a card grants public viewing only. Browser download completion is unobservable, so use the explicit Save contact action and successful Send as the exchange intent. Skip and abandoned submissions retain their current outcomes.

The visitor may share without an email or account. The resulting private contact remains usable. Verification and account association can be completed later with a new explicit exchange. Historic receipts created before secure claim issuance remain historical evidence.

## Source assessment

| Current source | Reuse | Required extension |
| --- | --- | --- |
| src/routes/u/[slug]/share-details/+page.server.ts | Existing form, consent, origin checks and signup transition | Bind successful submission to durable exchange continuation |
| src/lib/server/foundation/capture.ts | Transactional private person, encrypted receipt and nonce retry protection | Issue claim in the same transaction and retain the selected shared-card snapshot |
| src/lib/server/profileOnboarding.ts | Temporary draft and allowlisted auth return | Carry a separate opaque claim continuation through signup |
| src/lib/server/foundation/provisioning.ts | Enrollment locks and private-home creation | Explicit DEV cohort admission for fresh test accounts |
| src/lib/server/foundation/policy.ts | Lifecycle checks and server-issued authority | Narrow exchange settlement operation across two private vaults |
| src/routes/auth/google/callback/+server.ts | OAuth callback with verified-email check | Fresh assurance bound to exact claim and account |
| src/lib/server/magic.ts | Existing token and URL concepts | Sender currently logs links. Verified delivery requires an implemented transport |
| src/lib/leads/link.ts | Historical reciprocal-contact behaviour | Retain its legacy domain boundary |
| prisma/schema.prisma | Foundation subjects, sources and private custody | Add exchange, verification and account-association persistence |

Password registration currently establishes an account with supplied email. A successful password login alone cannot establish control of the exchange's submitted address. Google email matching and browser cookies also require the exact exchange capability and account-bound verification contract.

## Proposed verification contract

The initial complete flow uses a purpose-specific email challenge to the address submitted in the exchange. This is an engineering proposal for S-402. It works with password and Google accounts through the same claim boundary. Provider selection and operational delivery configuration belong to implementation.

The claimant must hold the opaque exchange continuation, be authenticated as the intended beneficiary, and complete a short-lived challenge sent to the submitted address. Bind the challenge to the exchange ID, claimant account ID, browser continuation and current authenticated session. Require the account's address to match the verified exchange address. Address changes require fresh verification. Any account switch invalidates the pending challenge.

Generate independent high-entropy secrets and store only hashes. Proposed initial expiry is 24 hours for continuation and 15 minutes for a challenge, with five verification attempts and bounded resends. Persist abuse limits across replicas. Resend invalidates the previous challenge. Return generic outcomes that avoid exposing account existence. Consume verification on an explicit same-origin POST so email scanners cannot claim an exchange.

Keep secrets out of analytics, application logs, browser history and referrers. Use a short code entered in the authenticated continuation page, or a token fragment exchanged into that page before an explicit POST. Redact delivery errors. Model outbound delivery with durable retry state and expiry. Send only after the exchange transaction commits.

For missing email, expiry, lost browser continuation or mismatched accounts, preserve saved contacts and offer a fresh exchange. Reissuing a claim requires fresh capture or reviewed recovery. Email possession verifies a channel and account association, with that assurance recorded in provenance.

## Proposed persistence and settlement

Physical names and final SQL constraints are confirmed in S-402 before adding a migration.

| Record | Required fields and constraints |
| --- | --- |
| Exchange | ID, origin profile and owner/vault, captured subject/source, encrypted shared-card snapshot and version, continuation hash, expiry, status, beneficiary account after binding |
| Verification challenge | Exchange, beneficiary, session binding, secret hash, expiry, attempts, consumed time, delivery status and resend generation |
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
| S-402 | Additive claim persistence, verification delivery and atomic service | Migration and custody tests, replay/account-switch rejection, partial failure rollback, deterministic concurrent settlement, privacy operations coverage |
| S-403 | Wire existing exchange/signup/People screens and DEV test admission | Both accounts see the shared details, retry returns one result, Skip works, archived contact stays archived, password and Google flows verified |
| S-404 | Unlink/recovery UX and DEV acceptance | Revocation, expiry, suspension and erasure races exercised, clear recovery and operator evidence |
| Later | Settings preference and continuing profile updates | Preference applies to future exchanges, directional field grants and revocation verified |

S-402 and S-403 require a source-reviewed migration plan. No production promotion follows from completion of this design. Ordinary feature acceptance runs on Railway DEV with synthetic data. The operator deferred the separate hosted restore exercise on 2026-11-07 until rollout preparation.

## Two-account DEV acceptance

Use two fresh explicitly admitted foundation accounts and separate browser sessions. The current setup permits one generated test login, so S-403 must add a bounded two-account DEV fixture through the existing owner setup. Keep the canonical origin, explicit database binding and owner authorization checks. Verification delivery uses controlled test addresses and a test transport locally.

1. Mark publishes a selected test card. Betty saves it and sends her test details. Check Mark receives one private person and the source snapshot.
2. Betty completes signup and email verification through that exchange. Check each private directory contains the other person's shared details.
3. Repeat with an existing signed-in Betty, then retry submission and settlement. Verify one settled exchange and stable person IDs.
4. Create private notes on each side. Verify all ordinary reads, search and errors expose only the authenticated owner's records.
5. Switch accounts before verification, reuse an expired or consumed challenge, forward a continuation without its bound session, and change submitted details on retry. Verify controlled refusal and unchanged custody.
6. Run concurrent settlement, suspension and archive tests in the database suite. Inject a late failure and confirm both vault writes roll back together.
7. Exercise missing email, delivery failure, profile withdrawal, self-exchange, revoked association and a pre-existing unverified duplicate. Require explicit recovery where proof or active ownership is missing. Self-exchange should complete without a duplicate self person.
8. Verify public Save contact, Send, Skip and optional signup on real mobile browsers. Record deployed SHA and outcomes.

For production readiness, retain the deferred hosted recovery exercise and the existing account closure, retention and cohort approval gates. The design enables DEV implementation while those release obligations remain tracked.
