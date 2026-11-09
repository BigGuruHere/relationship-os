# S-405 Account channels and simpler profile exchange

Date: 2026-11-07. Status: accepted product direction and implementation design on `feature/account-channel-exchange`, based on development `4a4ddb2` (PR #36). This stage, S-405a, changes documentation only. It does not implement the new flow, add a migration, send a message or change DEV/PROD. [S-405b](S405B_PROFILE_EXCHANGE.md) implements signed-in selection and confirmation on its feature branch; [S-405c](S405C_ACCOUNT_CHANNELS.md) implements account records and SMS settings on its feature branch; [S-405d](S405D_GUEST_ASSURANCE.md) implements guest assurance reuse and email/Google proof on its feature branch; S-405e remains planned. S-404 remains the recovery/acceptance work; its relevant obligations are incorporated here rather than silently marked complete.

## Product contract

An existing Relish user opens another person's public card, chooses **Share my details back**, selects an owned profile or creates one, previews the details and confirms. Each then sees the other in My People. Selecting a profile they control requires no retyping and no SMS merely for exchanging that profile. Authentication and server-checked profile ownership authorise this action. They do not assert that every address or number printed on the profile is verified.

A new visitor can submit a name and at least one contact channel. The sharer receives those details immediately. Signup or sign-in through that exchange opens **Verify your account** first. The authenticated visitor receives a private copy of the sharer's published card before their own verification. Only exact submitted channel proof can link the visitor's account to the sharer's existing contact record. The published card's one-way profile reference is separate from this guest link.

Each account phone and email has its own pending, verified or revoked state and proof history. When the visitor shares a mobile, it is the required channel. Email is the required channel for an email-only submission. Existing current proof for that exact channel can be reused. An additional email remains independently pending unless it already has its own proof, and can be checked later in Phone and email settings. Published profile field verification is a future policy decision.

Normal later exchanges reuse current assurance. A replacement channel, a revoked assurance, recovery or a sensitive operation can require new proof. Existing users who are logged out may sign in and return to profile selection. A password login by itself proves neither a newly submitted email nor a phone.

## Reuse assessment against development 4a4ddb2

| Existing capability | Actual gap | Minimum change and preservation |
| --- | --- | --- |
| `Profile`, `/profiles`, `/settings/profile` support multiple owned profiles and unpublished drafts | The share-details route always asks for typed fields | Add owner-scoped selection and confirmation to that route, reuse the editor with a bounded return continuation; keep stable slugs, public publication and QR/vCard behavior |
| `foundation/capture.ts` atomically saves visitor details and evidence | Only supported AU phone submissions receive a claim continuation | Retain immediate capture; issue a versioned continuation for supported submitted channels without sending a message |
| `exchangeClaims.ts` validates sessions, locks both roots, creates reciprocal receipts and associations | Claim verification is coupled to each exchange; direct profile exchange is missing | Extract the common settlement operation and give it two distinct server-issued authority inputs: authenticated profile confirmation, or exact-submission claim backed by account-channel proof |
| `FoundationAccountAssociation` links a custodian's private subject to an account | It is private relationship evidence, not an account's channel registry | Retain it and its owner-private access; introduce account-level channel assurance separately |
| `exchangeOnboarding.ts` stores an encrypted, browser-bound, expiring continuation | No profile creation/selection return binding | Version the continuation; retain fixed allowlisted destinations and bind account, profile selection, target and expiry |
| SMS challenge/outbox, budgets, encryption and Telnyx sender exist | Challenges are owned by the sharer's vault and require an exchange | Move new account-channel challenges to account custody; adapt reviewed cryptography, limits and dispatch semantics rather than reuse another owner's challenge as global account authority |
| Google callback checks an ID token and `email_verified`; password registration stores encrypted email | Neither persists reusable account-channel assurance; callback validation needs hardening before becoming proof authority | Accept new trusted Google proof only after strict issuer, audience, expiry, nonce and boolean verified-email validation; no historical OAuth/password backfill |
| `magic.ts` builds tokens but logs links instead of delivering email | No operational email verification transport exists in inspected source | Add a real bounded email adapter before offering email code delivery; do not use the logging stub or claim email support already works |
| P-305 privacy and exchange cleanup handle vault-owned records | Account channels have a different lifecycle from a private vault | Add account-owned review/revoke/erase handling and keep vault erasure distinct from whole-account closure |

Classification: simplifying existing exchange behavior plus a genuinely new account-channel persistence capability. Legacy Brokerage, auth credential semantics, notes, public capture and private custody remain intact. No automatic cohort enrollment, account merging or continuing profile subscription follows.

## Authority boundaries

Keep these four facts separate:

1. **Authenticated account:** a valid persisted session identifies the acting account. Revalidate it within the mutation transaction.
2. **Profile sharing:** that account owns the selected profile and explicitly confirms the exact contact projection for this recipient. No channel challenge is required for this authority.
3. **Channel assurance:** that account completed a check for an exact canonical phone/email, with method, time, generation and revocation state. This is not legal identity, proof of every profile fact, or a permanent guarantee against reassignment.
4. **Exchange claim:** a valid, unexpired continuation locates an exact submitted receipt. Matching usable account-channel assurance can authorise attaching that receipt to the account. Assurance alone cannot search and claim all records with the same address.

Do not add an account-wide `isVerified` flag. Do not let a route manufacture proof by supplying a channel record ID, owner ID or `verified=true`. A private contact's account association never grants access to the other party's notes, observations, relationships or sources.

A person can include a company switchboard or another contact address on a profile. Profile text is not automatically enrolled as an account-owned channel. Account verification is an explicit claim of control with an independent check. A profile editor can offer verification of a new personal channel, but must not silently replace login credentials or send a message on page load.

## Proposed account persistence

These are proposed physical responsibilities, not existing Prisma models. Final migration SQL and names are reviewed in S-405c before activation.

| Record | Required fields and constraints |
| --- | --- |
| `AccountChannel` | ID, account/User FK, type PHONE or EMAIL, encrypted canonical value, purpose/realm-separated lookup HMAC and normalization version, status PENDING/VERIFIED/REVOKED, assurance generation, created/updated times. Canonical value and owner are immutable; replacement uses another record. Unique account/type/canonical key. |
| `AccountChannelVerification` | Immutable proof ID, account/channel composite FK, generation, method SMS_CODE/EMAIL_CODE/GOOGLE_OIDC, verified time, proof reference, optional policy expiry, revocation time and fixed reason. No raw code, OAuth token or provider payload. Reverification creates a new proof; it does not erase prior revocation. |
| `AccountChannelChallenge` | Account/channel/generation, purpose, keyed code digest, session binding, expiry, aggregate attempt/send limits, status and timestamps. Changing channel or revoking it invalidates outstanding proof. Unique retry key bound to account and purpose. |
| `AccountChannelDispatch` | Challenge FK, encrypted destination/message until delivery or expiry, state, bounded attempts, lease metadata and fixed error code. Scrub payload after success/cancellation/expiry and during erasure. |

The registry belongs to the account, not Mark's or Betty's relationship vault. Use encrypted canonical values with authenticated data including account/channel/field identity, and HMAC indexes only for necessary equality/conflict checks. Account owners get their own masked status projection and controlled edit view. Other users, ordinary directory searches and Dorian receive no registry enumeration access.

The first pilot permits one current verified account claim per canonical channel across accounts, enforced transactionally with a database uniqueness guarantee. Pending entries do not reserve a channel against its real controller. Shared/reassigned-number conflicts return a generic recovery outcome, never the other account's details; they cannot merge accounts or transfer assurance automatically. Releasing a revoked claim does not revive old proofs or old pending challenges. Wider shared-channel support is a deliberate later policy change.

Use the existing strict AU mobile normalization for the SMS pilot, retaining local `04` and `+614` equivalence. Do not expand international handling silently. For email, use one validated, versioned normalization contract consistent with current credentials, without provider-specific dot/plus stripping. Matching must not create new login aliases. The registry can contain multiple channels while the existing credential email remains a separate login field.

## Challenge and assurance lifecycle

Adding a channel makes its status pending and offers **Verify**. An explicit same-origin request starts delivery, with the canonical masked destination shown. Verification success writes the proof and verified state atomically under current account/session and generation checks. A delivery receipt does not prove control. Expired or failed challenges leave the channel pending; retries retain cumulative abuse limits.

Preserve the existing initial limits unless separately measured and changed: code expiry 15 minutes, five failed attempts, 60-second resend cooldown and bounded sends. Adapt persistent account, destination, request-origin and global budgets across settings and exchange entry points so opening a new exchange or switching UI cannot reset protection. Revocation also cancels unsent payloads. Dispatch rechecks current challenge state; external message delivery may duplicate after a provider-accepted/database-failed attempt, but proof consumption remains idempotent.

Current verification is normally reusable without arbitrary per-exchange expiry. A later sensitive operation can specify a maximum proof age and stronger session assurance. Its successful challenge does not automatically grant unrelated permissions. Replacing a phone/email creates a new pending channel; the old one remains verified until explicitly removed/revoked. Removing a channel revokes current assurance and blocks new use immediately, while retained history records what happened under the applicable retention policy.

Google assurance is an explicit trusted adapter, not a client assertion. Before recording it, require the expected issuer, correct audience, valid signature/time, exact stored nonce including rejection of missing nonce, a real subject and `email_verified === true`. Reuse only a newly validated callback, not the existence of an old OAuthAccount row. Its proof verifies only that exact email. It must never silently revive a revoked channel or change account-linking policy.

## Existing-user journey

Reuse the public card and share-details route; no separate onboarding application is needed.

1. On another person's card, offer **Share my details back** for the authenticated eligible user. Keep **Save contact** available as the device contact download. This intentionally revises the earlier one-action public screen for the existing-user path; guest simplicity remains.
2. Show only owned profiles, their label and the exact contact preview. Offer **Create a profile** through the existing editor. Carry a bounded server-validated return to the exchange; cancellation returns without creating a contact. Do not force publication to share a snapshot with one recipient.
3. Confirm both the recipient and selected fields in a same-origin POST. Load the profile again by authenticated owner, recheck session and target publication, and compare its preview version. If the profile changed after preview, ask for a refreshed confirmation rather than sharing newly added fields silently.
4. Commit the reciprocal private entries, independent evidence copies, account associations and immutable exchange outcome atomically. Return success only after both sides commit. A retry returns the prior result.

The initial contact projection is name, email and phone, matching the existing foundation exchange. The preview must show precisely those fields; extending it requires explicitly adding and testing fields. An unpublished selected profile can be shared as this recipient-specific snapshot without changing `isPublished` or granting general access to the draft. Do not create an ongoing grant merely to represent a one-off exchange receipt.

Idempotency is scoped to the account, target profile, selected profile/version and confirmation intent. Repeated explicit exchanges reuse existing ACTIVE account associations and append receipt evidence without overwriting notes or owner-maintained details. Never deduplicate by email/name/phone. Archived entries or revoked associations require the defined restore/recovery choice. A conflicting previously unverified private entry remains separate unless its exact claim continuation is proven.

Self-exchange returns the existing profile experience before capture. Both roots must be ACTIVE in the admitted cohort; legacy or mixed-domain cases keep their established capture behavior with an honest unavailable message for reciprocal completion. A failed foundation operation must never fall through into legacy writes.

## New-user journey and retained assurance


### Email-first guest verification, 2026-11-09

Confirm the account's sign-in email on the existing guest continuation before settling a new v2 exchange. Reuse current email proof when present. Password signup and Google sign-in using an outside mailbox use the existing Relish email code. The Google callback records trusted proof for Gmail and verified Google Workspace mailboxes from validated token claims. Historic Google proofs without independently identifiable mailbox authority need fresh proof. The existing authentication rules and general signup journey continue independently of the guest continuation.

A verified sign-in email settles the exchange when it matches a shared email. A different sign-in email stays private. In that case, the guest can prove one of the original shared channels, or continue with the saved published card and a pending exchange. A shared phone remains independent. Prior disclosure, private notes and settled exchange records are retained. Replacing an earlier shared address or number requires a separate, consented correction action.


Preserve guest Send, Skip, Save contact and Continue later. Send commits the sharer's private person/receipt immediately. New claim issuance stores the exact eligible submitted channels encrypted, selected originating card snapshot, expiry and a continuation version. It must support email-only submissions once the email adapter is ready. A submission without a supported channel remains a useful saved contact, without falsely promising a claim.

Signup/sign-in resumes the browser-bound continuation. Authentication may ask which account to use, but must not silently switch a claim already bound to another beneficiary. Resolve any usable matching channel from that account server-side. When it exists, settle through an explicit exchange-completion intent already carried through the flow without sending another code. Otherwise ask the visitor to verify a supported supplied channel. Never let the verification form redirect proof to an unrelated replacement destination.

After a successful channel check, retain its account proof and settle the exact exchange automatically. Verification and settlement are distinct outcomes: if profile withdrawal, archive or another lifecycle change blocks settlement, the successfully verified channel remains valid and the UI explains that the exchange is unfinished. The original contact is retained. A retry reuses proof and rechecks all exchange authority; it does not send a fresh code unnecessarily.

If both phone and email were supplied, show each independently: for example, **Phone verified; email verification pending**. Offer the remaining check after exchange completion or in account settings. Verification of one never updates the other. Continue later preserves pending state and uses a real navigation outcome.

An expired/lost continuation cannot be recovered merely by finding a matching channel. Offer a fresh exchange or explicit reviewed recovery. Historic S-402 receipts are not bulk-claimed or silently upgraded. During migration, old pending continuations either retain the compatible SMS handler for their original 24-hour lifetime or are explicitly invalidated with a fresh-exchange path; the implementation must pick and test one before release. The proposed default is to drain the old 24-hour path, then retire its writer. New exchanges use only the new writer.

## Concurrency, privacy and compatibility

Reuse the current pilot exchange serialization lock for the new channel writers and settlement during the bounded DEV phase. Under that lock, acquire sorted account/root locks, revalidate session, channels, both profiles and association states, then settle. Profile locks use a stable order. The same ordering must cover revocation and privacy operations; do not introduce a channel lock after an inverse account-lock path. Real PostgreSQL tests must exercise overlapping transactions, not only mocked promises.

Services, not routes, own database scopes. Add a narrow account-channel guard with explicit read/write and proof-consumption operations; do not broaden EXCHANGE_LOOKUP to expose channel plaintext. Existing F-204 import and query-boundary tests must cover new internal constructors and reject unscoped access. Common settlement accepts only internally resolved authority, never arbitrary proof structures from a browser.

Channel revocation prevents new claims using that assurance. It does not delete another custodian's independently saved contact or notes, and it does not rewrite a prior exchange as though it never occurred. Account-association revocation remains a separate choice. Sensitive phone access checks current proof/revocation policy each time; caller ID alone remains a recognition signal.

Vault suspension blocks foundation exchange use even if an account has a verified channel. Vault-only erasure cancels dependent exchange work but does not silently destroy account credentials/channels. Whole-account closure must explicitly revoke/scrub channel proofs, dispatch payloads and indexes and remove dependencies. Retention review includes proof metadata and backups. No new automatic recovery, login-by-phone or Dorian private-data access is enabled by this project.

No automatic backfill marks existing User email, profile text, contacts, old SMS account associations or old OAuth rows verified. They do not all contain adequate, account-owned proof/lifecycle history. Existing associations and exchange receipts remain intact. New proofs are recorded from successful checks after activation.

## Delivery stages and model choice

| Stage | Deliverable | Model recommendation | Completion gate |
| --- | --- | --- | --- |
| S-405a | This architecture correction, supersession, source inventory and ordered implementation plan | Astra Medium | Source and document consistency/link checks; branch committed and pushed; no runtime claim |
| S-405b | Existing-user profile selection/create-return/confirmation and shared settlement service | 6.1 Sol High | No SMS or retyping; two private People entries; owned-profile/version, retry, archive and privacy race tests; native browser flow |
| S-405c | Account-channel schema, guarded proof service, SMS settings UI, revoke/reverify and cleanup | 6.1 Sol High | Additive migration, independent states, reusable proof, cross-account denial and database concurrency tests; controlled DEV SMS acceptance |
| S-405d | Guest claim integration, assurance reuse, email-only and dual-channel support, hardened Google proof adapter | 6.1 Sol High | Exact-continuation binding, no fresh code for valid assurance, independent second-channel check, real email adapter with mocked transport tests and authorised DEV delivery |
| S-405e | Combined acceptance and recovery completion | 6.1 Sol High | Existing/new user matrix, mobile testing, expiry/revocation/conflict recovery and privacy regressions; actual deployed SHA and operator results recorded |

S-405b is the next user-visible improvement and does not depend on channel verification. Before its code change, inspect SQL constraints and decide whether the existing exchange schema can express authenticated profile confirmation safely. Add a small additive migration if required; do not fabricate an SMS challenge or weaken old proof constraints to avoid a migration. S-405c necessarily adds persistence; S-405d may extend exact-submission channel storage. The implementation PRs must state their actual migration count and rollback boundaries.

The email provider and sender domain are not established in source. S-405d must identify an available configured adapter or obtain the operator's provider choice/configuration before live email acceptance. Secrets belong in environment settings, never chat or Git. Neither this decision nor a mock sender is evidence of working email delivery. No live external message is sent by this design stage.

All feature branches start from the latest development. Keep the current DEV flag/cohort gating while replacing each writer. Run synthetic migration/service/concurrency tests locally or in CI and ordinary user testing on DEV as requested; do not require another hosted snapshot exercise for each slice. Production remains deferred, including its separate recovery/closure/retention gates.

Application rollback disables new entry points but retains compatible readers and privacy handlers for populated records. Leave additive tables intact. Never route completed new records back into legacy Brokerage or restore the old per-exchange writer for new-version continuations. Historical receipts remain readable under their existing custody.

## Required acceptance evidence

- Existing signed-in user selects an existing profile and completes both People entries with zero message dispatches. A new unpublished profile can be created, selected and shared without making it public.
- Logged-out existing user signs in and returns safely. Forged profile IDs, changed preview versions, account/session switches, wrong origins and self-exchanges are rejected before writes.
- Guest submission persists immediately; signup with matching phone or email proof settles that exact submission. Another account's proof, another destination and another continuation cannot settle it.
- Phone-only, email-only, both channels, second channel added later, replacement and explicit revocation each produce independent correct statuses. Pending fields never display verified badges.
- Reusable proof avoids another send. Revoked or replaced proofs, failed/expired challenges, replayed codes and mismatched generations fail. Budgets survive UI changes, retries and multiple exchanges.
- Concurrent verification of the same channel by two accounts yields at most one active verified claim and no identity merge. Unknown/conflicting channels do not disclose account existence.
- Duplicate confirmation/settlement produces one result; both-vault writes roll back on injected failure. Prior private notes and owner-edited fields remain unchanged.
- Concurrent archive, suspension, profile withdrawal and revocation serialize safely. Verified channel can survive a failed exchange without claiming completion.
- Google proof rejects missing/mismatched nonce, issuer/audience errors, unverified or non-boolean flags. Password login and profile editing never invent email assurance.
- Delivery failures, Continue later, expired continuations and recovery provide usable outcomes. No private content, destination, code, token or OAuth payload appears in diagnostics.
- Existing public Save contact/Send/Skip, auth, legacy Brokerage, P-305 privacy operations and native form validation regressions pass. Record DEV deployment and phone/email acceptance separately from CI.

## S-405a validation record

Source review: latest development `4a4ddb2`; inspected current profile manager, share-details and claim routes, exchange issuance/crypto/settlement/privacy, browser continuation, Prisma records, Google callback and email helpers. The six-digit input fix is merged through PR #36. Runtime tests from that PR are historical evidence, not tests run for this documentation change.

Documentation validation passed: 145 relative links across 12 changed documents, 16 referenced source paths, and `git diff --check`. Runtime tests were not rerun for this documentation-only stage. No runtime source, Prisma schema, migration or environment configuration changes in S-405a. DEV and PROD behavior remain as before this branch.
