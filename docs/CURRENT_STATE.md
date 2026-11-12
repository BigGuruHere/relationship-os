# Relish: Current State and Open Work

Status: updated **2026-11-10**. The production-base feature branch starts at remote development `61e3356` (PR #41) and incorporates direction commit `9cccfb6`. Environment observations below are separately attributed.

Profile publishing cleanup is implemented on `feature/profile-publishing-cleanup` for Development review. The owner editor has explicit publish/private-save actions, existing-card visibility controls, and a shared entry from public preview. My Profiles drops pilot content and Share omits type labels. See [profile continuity](foundation/P304_PROFILE_CONTINUITY.md#profile-publishing-cleanup-2026-11-10). No migration or deployment.


Exchange and notes follow-up is implemented on `feature/exchange-voice-note-followup`. Sign-in with sufficient existing channel proof can finish the exchange and open the saved person’s voice-note invitation directly. Explicit proof and signed-in profile exchange use the same destination. Owner-private notes support text, summary and timestamp edits. Foundation edits append a revision. Existing stored-only legacy notes are updated within their owner’s contact workspace. No migration or deployment.

## Context-neutral navigation

`fix/context-neutral-navigation` removes the shared context picker and uses global navigation destinations on desktop and mobile, including Operator Tools and Manage Users. Context-specific workflows retain their own routes, permissions and data scope. The operator reports that DEV and PROD accounts were reset. No database change is required for this navigation update.

## Dorian browser voice test

`feature/dorian-webrtc-dev` adds an owner-only page at `/settings/dorian-voice-test` on the canonical DEV origin. It uses ElevenLabs' JavaScript SDK and WebRTC with a short-lived token issued by Relish. The page requires the existing server-only `ELEVENLABS_API_KEY` and a dedicated, private DEV agent in `RELISH_DORIAN_WEB_TEST_AGENT_ID`. Use an agent with no tools, Relish webhooks or memory ingestion and verify its provider retention settings before speaking. Use synthetic conversation details. Relish sends no contact data and saves no transcript or note in this test. No migration.

Token requests now have a Relish reference visible on failure and in Railway logs. The logs distinguish provider rejection and its HTTP status, connection failures, timeouts, and invalid responses. Browser console stages distinguish token, SDK load and WebRTC failures. For this transport test, use a self-contained agent with static prompt and greeting or defaults for every required dynamic variable. The existing Dorian browser initiation webhook is a separate path that requires an authorized Relish session token.

On real devices, sign in as owner, open the page, start and end a conversation twice, and check for repeat microphone permission prompts. Note whether Dorian plays through the earpiece, speaker or connected headphones. Repeat in iPhone Safari, Android Chrome and their installed Relish web apps. Check that ending the conversation releases the microphone. Hosted and handset acceptance is pending.

## Living Understanding review from a note

`feature/note-understanding-review` adds an owner-only DEV review to saved My People notes, including Dorian notes. The owner explicitly requests OpenAI suggestions, sees the exact supporting quotes and approves individual updates. General preferences belong under Me. Wishes tied to the selected relationship belong under Our relationship, even if only the owner expressed them. Person observations preserve reported speech or impressions. Approved statements record the owner's perspective.

The first approved relationship statement creates a default private relationship reference for the pair. Later reviewed notes reuse it. The review page shows the approved statements for that note. Editing the note supersedes its evidence and opens the corrected version for a fresh review. One approval batch is supported per note version. Hosted DEV acceptance is pending. No migration.

## LUR-1 shared validation contracts

[LUR-1](foundation/LUR1_CONTRACTS.md) merged through PR #66 at `f79cd8af`. Existing validators moved into a shared module with typed source and candidate contracts.

## LUR-2 private conversations and revision persistence

[LUR-2](foundation/LUR2_PERSISTENCE.md) merged through PR #67 at `b855aa45`. It saves both speakers' turns and an independently versioned summary in the existing owner-only DEV Dorian flow. Hosted acceptance has not been recorded.

## LUR-3 Foundation semantic assessment

[LUR-3](foundation/LUR3_SEMANTIC_ASSESSMENT.md) merged into Development in PR #68 at `992a8121`. The operator ran all eight synthetic semantic assessment checks on Railway DEV successfully. This does not establish live model quality or hosted end-to-end acceptance.

## LUR-4 Private Living Understanding review

[LUR-4](foundation/LUR4_OWNER_REVIEW.md) merged in PR #69 at Development `b5f133b3`. PostgreSQL and Chromium CI passed. The My People conversation review groups updates by private subject, keeps the full transcript and summary separate, validates owner wording edits, and saves only selected updates. The same screen displays eligible current paragraphs, prior versions and source evidence. Writes require the existing owner-only DEV boundary and an explicit opt-in. No Prisma migration. The owner reached review on DEV and reported a live validation failure. Diagnostics merged in PR #70 and identified a citation failure in decomposition. The citation fix adds exact whole-turn anchors and server-resolved unique excerpts. A later hosted retry reached the audit and logged `BAD_SUBJECT`. The subject repair merged in PR #72. Subsequent DEV retries logged a model timeout and an attribution failure. PR #73 added stage timings, reason codes, an owner-only failure panel and structured attribution repair. The next hosted trace confirmed GPT-6 Luna hit the 45-second extraction deadline. The timeout patch extends extraction to 90 seconds and gives analysis a shared four-minute model budget. The hosted retry completed extraction and hit unsupported prose after the quote repair. The wording patch gives prose-only findings a separate repair and full re-audit inside the same deadline. Hosted verification remains pending. PR #76 added owner-only stage previews. A DEV review reopened after a failed run showed no panels. The recovery patch adds a migration and encrypted failed receipts so the latest failed preview can be recovered for one hour.

## Dorian notes in My People

The owner-only DEV flow is live-tested by the operator through note save. The `feature/dorian-person-note-quality` branch replaces provider call recaps with a person-centred draft from caller speech through the existing OpenAI summariser. The user can still review, edit, save, or discard. If no draft is generated, the editor opens blank and offers the caller's own words as reference. Existing saved notes remain editable. No migration.

On `fix/dorian-first-message`, My People sends the personalised greeting as a first-message override. On the dedicated ElevenLabs web test agent, enable **First message** under **Security** conversation overrides. Set the agent's regular First message to a static greeting such as “Hi, what would you like to remember?” for standalone calls. Keep defaults for `caller_name` (for example, “there”), `person_name` (for example, “this person”), and `call_intention` (for example, “Help the caller capture a short private note about someone.”). Reference `{{call_intention}}` in its system prompt and treat the names as labels. My People calls supply those variables from Relish. Keep the dedicated web agent's legacy tools and webhooks detached. DEV needs the existing OpenAI key for drafts. Hosted verification of the greeting is pending. No migration.

## QR exchange follow-up

On `feature/people-recency-exchange`, My People lists the most recently modified contact records first. A pending guest exchange resumes after sign-in even from a generic auth URL. Completed exchanges open the voice-note choice once the required account proof is available. A share without a claim opens My People without an automatic reciprocal contact. The profile editor is separate from both share return paths. No migration or hosted configuration change.

On `feature/clean-exchange-followup`, the recipient sees a simple voice-note choice after saving the sharer. An active Foundation account showing its published profile on Share or Share QR sees a matching prompt after a new contact arrives for that profile. Share checks for new receipts for up to 15 minutes and opens the prompt while the tab is visible. Both prompts open the existing recorder or return Home. The install banner appears on the recorder after an exchange. No schema migration is required.

## Brokerage cutover

The operator reports that broker-relish has a separate deployment and database. [D-030](DECISION_LOG.md#d-030-separate-brokerage-deployment-and-relish-design) removes Brokerage from Relish architecture requirements. On `feature/disable-brokerage-in-relish` from Development `5da72d4a`, Relish hides the Brokerage entry points and returns 404 for its legacy CRM routes, including commercial Contacts, Tasks and Projects screens and guest lead intake. Automatic lead claiming is disabled. My People, notes, QR capture, sign-in and operator tools retain their boundaries. The code, grants, schema and records are retained. There is no migration. A Brokerage service that adopts this revision must explicitly set `RELISH_BROKERAGE_ENABLED=YES` to keep its CRM enabled. Hosted cutover and production release checks remain pending. Local checks covered disabled and enabled Brokerage behavior, owner navigation, real Chromium 404 responses and isolated My People access. The existing capability test for /general still fails on the unchanged Development baseline.

## Ordinary production onboarding

[D-029](DECISION_LOG.md#d-029-ordinary-onboarding-and-an-incremental-production-launch) replaces the invited-cohort launch approach. Implementation commit `fb0d3d5` and direction commit `9cccfb6` are bundled in the Development integration PR. Hosted DEV acceptance and production promotion are pending.

- New password and Google accounts receive an ACTIVE private vault, encrypted self reference and unpublished profile in the account transaction. Ordinary signup uses neither exchange admission nor operator-created logins. A matching credential email alone cannot attach a new Google login to an enrolled account. Existing accounts keep their storage domain and profile state.
- After sign-up, the existing editor offers owner review and publication. The public card offers one primary action, Save contact. QR capture keeps visitor consent and writes to the published card owner's storage. My People, manual capture and private voice-note draft processing and retrieval reuse their existing guarded Foundation routes.
- Reciprocal exchange and channel delivery are available in DEV and have a separate production activation gate. Foundation members use neutral navigation, and legacy-only Network, lead and profile Dorian entry points cannot write for the Foundation journey. Published profiles and configured events keep their established routes. Legacy-to-legacy Network behavior is preserved.
- Password self-service recovery merged into Development via PR #48. Hosted email delivery remains to be confirmed. Ordinary password signup does not verify mailbox ownership. The existing Privacy and support page is reachable from the account menu.

The [production-base register](foundation/IMPLEMENTATION_PLAN.md#production-base-backlog-d-029) records verification, provider and recovery gaps. Production promotion must reconcile the pending migration list against the actual target database.

## Production exchange, password recovery and contact download

Merged into Development via PR #48 at `5da72d4a`. Password reset uses Resend and revokes existing sessions after a single-use link succeeds. Verified v2 exchange supports an explicitly enabled, database-bound production runtime. Phone contact downloads add public URLs alongside Relish. The password reset migration is additive. Hosted provider and device acceptance are pending. See [rollout and recovery](foundation/PRODUCTION_EXCHANGE_AND_RECOVERY.md).

## Guest sharing and account verification


The `feature/email-first-guest-verification` branch changes the v2 guest continuation to confirm the sign-in email first. An exact shared email match completes the exchange without SMS. A different sign-in email stays private and a shared channel still needs its own proof. A validated Gmail or verified Google Workspace mailbox can supply email proof, while outside Google sign-in addresses require a Relish code. The additive proof migration retains historic records. Hosted acceptance is pending.


On `feature/guest-sharing-account-verification`, guest Send requires email or mobile. An authenticated guest receives the published card in My People before verification. The verification screen asks for the exact submitted mobile when present, or email for email-only sharing. Proof links the guest to the original private entry. Account channels remain independent. No migration. Feature branch validation uses isolated databases and simulated providers. Hosted acceptance is pending. See the [exchange contract](foundation/S405_ACCOUNT_CHANNELS_AND_EXCHANGE.md).

PR #45 merged into Development at `87f9205`. The operator confirmed that a guest could see the sharer's card on DEV before verification and reported a redundant sign-in choice screen and a `P2002` error. The `fix/guest-verification-entry` branch routes guests directly to the existing account screen and reports competing verified-channel ownership separately from other verification errors. The supplied log does not name the live constraint. No migration or deployed change.

## Channel verification diagnostic follow-up

Operator reported `/settings/channels` HTTP 400 and an `operation:add` / `reason:UNAVAILABLE` event at 2026-11-08 11:15:18 UTC (22:15 Melbourne), reference `bbea31cb-26bc-4c5f-83b7-d416df68f5ee`. Its relationship to the latest click is unknown. Add precedes delivery, so this event is not evidence of a Resend failure. The add form defaults to PHONE; entering email without choosing EMAIL is one possible cause, not a confirmed diagnosis.

`fix/channel-verification-diagnostics`, based on development `6239d4a` (merged PR #40), adds specific validation/access/database reasons and safe provider HTTP categories, with on-page support references including failed dispatch. Source behavior otherwise remains unchanged. Local 34 focused checks pass and Svelte reports zero errors/warnings. No migration or live send; runtime cause remains unconfirmed pending one fresh DEV attempt after deployment.

## S-405d guest assurance reuse and email

[Guest assurance, email setup and DEV acceptance](foundation/S405D_GUEST_ASSURANCE.md) are implemented on `feature/s405d-guest-assurance`, based on merged PR #39 (`7205d53`). New exact-submission claims reuse verified account channels, or verify a supplied phone/email and retain its proof. Phone/email statuses remain independent; Google callback proof is hardened. One additive migration brings totals to 111 migrations / 24 Foundation tables. Resend delivery remains disabled until sender/key/DEV recipient configuration. No live send, migration or deployment; full DEV acceptance pending.

## S-405c account channels and SMS verification

PR #39 is merged at `7205d53`; deployment and live SMS acceptance remain unverified. The feature-branch implementation description below records its delivery state before that merge.

[Account channel service and migration](foundation/S405C_ACCOUNT_CHANNELS.md) are implemented on `feature/s405c-account-channels`, based on merged PR #38 (`42ae818`). Account settings separately track pending/verified/revoked phones and emails, with SMS proof/revoke/reverify and privacy/expiry cleanup. Email remains pending; reusable guest claims follow in S-405d. One additive migration brings totals to 110 migrations / 24 Foundation tables. No live migration/message/deployment performed; DEV acceptance pending.

## S-405b owned-profile exchange

PR #38 is merged at `42ae818`; live DEV acceptance remains unverified.

[Implementation and DEV checks](foundation/S405B_PROFILE_EXCHANGE.md) are on `feature/s405b-profile-exchange`, based on merged PR #37 (`8fe9117`). Eligible signed-in users select an owned profile or create an unpublished card, then confirm reciprocal saving without SMS. Existing account links are reused and private history preserved. No migration; 109 migrations / 20 foundation tables remain. Local and CI evidence is recorded in the PR. Not merged/deployed; live DEV acceptance pending. Account-channel registry and email remain S-405c/d.

## S-405 account channels and simpler exchange

The operator requested owned-profile exchange without redundant SMS and independent reusable verification for each account phone/email. [S-405a](foundation/S405_ACCOUNT_CHANNELS_AND_EXCHANGE.md) records the accepted architecture and ordered runtime stages on `feature/account-channel-exchange`. Documentation only: the current source still requires exchange-bound SMS and has no reusable account-channel registry or working email sender. S-405b implements profile selection first; S-405c/d add channel persistence and guest/email integration. No migration, message, merge or deployment is claimed for S-405a.

## S-403 six-digit input fix

PR #36 is merged at `4a4ddb2`; deployed code-entry and full reciprocal completion remain unverified.

The operator's diagnostic event identified SELF_EXCHANGE, explained by signing into the card owner's account. After switching to the separate recipient account, the operator received SMS but browser pattern validation blocked code entry. `fix/exchange-code-input` preserves the six-digit regex quantifier as a Svelte string literal; the previous quoted attribute interpolated its braces and rendered `[0-9]6`. Rendered-component tests cover six digits, leading zeros and invalid lengths/text. Native Chromium now enters and submits a synthetic six-digit code. No migration, live send or credential/code logging. Full live reciprocal completion remains pending.

## S-403 pre-SMS diagnostic follow-up

PR #35 merged at `1785b70`. The operator supplied its sanitized SELF_EXCHANGE event; separate accounts then allowed SMS delivery. `fix/exchange-send-diagnostics` adds sanitized operation/reason logging and an on-page support reference, plus canonical allowlist comparison. Tests confirm existing local-AU normalization. [Diagnostic operation](foundation/S403_SEND_DIAGNOSTICS.md) explains the next single DEV reproduction and safe log collection. No migration, live send or account-state change.

## S-403 DEV acceptance fixes

On 2026-11-07 the operator reported successful DEV deployment and capture into Mark's People, but blocked verification and Continue later forms. PR #34 merged at `d19c12c`; it fixes the native form referrer-policy/origin conflict and adds prominent profile publication actions. No migration or live send. [Fixes and log diagnosis](foundation/S403_DEV_FIXES.md) records tests, direct migration connection guidance and the separate legacy OAuth warning. Live reciprocal SMS acceptance remains pending.

## S-403 browser integration

Merged through PR #33 at development `0b3444a`. [Browser flow and DEV acceptance](foundation/S403_EXCHANGE_BROWSER.md) connects supported exchanges through password/Google auth to SMS verification and reciprocal My People saving. Browser activation defaults off behind an explicit DEV flag. Owner setup supports two generated logins; a separate two-email allowlist can admit genuinely new DEV signups atomically. Ordinary capture and public signup retain their prior cohort policy. No new migration, live SMS or deployment is claimed. Automated results are recorded in the PR; live mobile/provider acceptance remains pending.

## S-402b SMS verification and settlement

Merged through PR #32 at development `dd1d7d0`. The [service and operations guide](foundation/S402_EXCHANGE_SERVICE.md) records session/exchange-bound SMS proof, encrypted outbox, persistent budgets, reciprocal private card/evidence copies, and inbound/outbound privacy cleanup. One additive migration brings the schema to 109 migrations / 20 foundation tables. The S-403 feature branch adds the browser adapter; runtime activation remains an explicit DEV operator choice. Controlled DEV SMS is limited to explicitly allowlisted Australian mobiles. No live delivery, deployment, enrollment or production promotion is claimed. Local validation passed 34 focused checks and 70 regressions, with zero Svelte errors/warnings. PostgreSQL CI results are recorded in the PR.

## S-402a exchange persistence

Merged through PR #31 at development `477adb9`, confirmed from Git. The [schema slice](foundation/S402_EXCHANGE_SCHEMA.md) adds exchange, challenge and delivery records with custody constraints and immutable proof fields. The merged schema gated writers; the S-402b feature branch adds the internal service and privacy integration while public routes remain unchanged. One additive Prisma migration is required. Runtime SMS acceptance remains pending.

## S-401 exchange design

The [Stage 4 design](foundation/S401_EXCHANGE_DESIGN.md) merged through PR #29 at `56eec62`. The revision on `docs/s401-sms-verification` specifies either channel, SMS first, after inspecting the direct Telnyx sender and durable queue pattern. Live DEV delivery remains unverified. It specifies reciprocal saving after a real exchange, verified account association, a future automatic-add preference enabled by default, and separate continuing-update permission. Runtime work is planned in S-402 through S-404. Validation covers source references and document links. This design requires zero migrations.

PR #28 merged at `d572b1a`. The operator chose on 2026-11-07 to defer the hosted snapshot/erase replay and continue ordinary testing on DEV. Hosted recovery remains a production-readiness item. The existing internal pilot acceptance is operator-reported.

## P-306 DEV acceptance (in progress)

The operator reported matching Neon DEV and snapshot restore counts (15 foundation tables, 0 enrollments/vaults, 9 Users, 29 Contacts, 128 Interactions, 107 applied migrations, 0 unfinished) and a successful existing-account Railway DEV smoke test. The first synthetic hosted seed returned an unclassified error before verified suspension or erasure.

The [one-account DEV test](foundation/P306_DEV_TEST_ACCOUNT.md) merged via [PR #27](https://github.com/BigGuruHere/relationship-os/pull/27) at `cfbfabe`. The operator reported the test worked. Exact running SHA and individual device/browser/provider outcomes were not recorded. This is internal test acceptance.

PR #28 merged the tooling from `feature/p306-dev-pilot-replay`, which adds an [offline hosted replay procedure](foundation/P306_DEV_REHEARSAL.md) using two independent copies of one post-test DEV snapshot and the existing synthetic test login. Local tests verify proof matching across restore, rejection of the source endpoint and wrong proof/key, erasure and preservation of account/profile rows. Hosted replay, full account closure/retention, remaining device/provider evidence and cohort approval are pending. No new migration, hosted operation or deployment in this change.

Release comparison at development `cfbfabe` against production Git branch `master` at `b58ba02` shows one added migration file, `20261104010000_f202_foundation_schema`. PROD schema and migration status require separate verification before a promotion. Production remains deferred.

## P-305 privacy and operations readiness (merged)

`feature/p305-privacy-operations` adds owner archiving, an offline support command for one foundation vault, redacted note failure references and a recovery rehearsal. Support can inspect counts, prepare a protected review file, suspend foundation authority and erase the locked vault transactionally. An empty suspended routing record prevents legacy fallback. See [P-305 scope and runbook](foundation/P305_PRIVACY_OPERATIONS.md). [PR #24](https://github.com/BigGuruHere/relationship-os/pull/24) merged at `de9a875`. [CI run 42154492443](https://github.com/BigGuruHere/relationship-os/actions/runs/42154492443) passed all 171 checks on `15087d7`. No migration or activation. Hosted DEV restore/replay, full account closure handling across the other stores, retention verification and live device acceptance remain rollout gates.

## P-304 profile and authentication continuity (merged)

`feature/p304-profile-continuity` binds signup prefills to the new account and exact profile, keeps the new card unpublished until the owner chooses to publish, and sends existing accounts to My Profiles unless resuming their own draft. Share and QR preview use the selected owned profile. Existing public slugs and aliases remain valid. See [P-304 scope and acceptance](foundation/P304_PROFILE_CONTINUITY.md). [PR #23](https://github.com/BigGuruHere/relationship-os/pull/23) merged at `d6950e2`. [CI run 42148654526](https://github.com/BigGuruHere/relationship-os/actions/runs/42148654526) passed all 160 checks on `6208c95`. Local focused tests passed 43 checks, with zero Svelte errors/warnings. Live DEV/provider/device testing remains pending. No migration or activation.

## P-303 private notes (merged)

`feature/p303-private-notes` reuses the shared recorder and People pages for foundation text/voice notes, full-text history, stable retry keys and explicit transient draft processing. Saving remains stored-only. Audio jobs are bound to owner/domain/vault/epoch and checked again after provider work and on polling. No migration or activation. See [scope, tests, DEV checks and transport limitations](foundation/P303_NOTES.md). Local acceptance passes 15 P-303 checks, 20 existing directory/capture/boundary checks, 25 focused legacy regressions and 12 shared audio/Dating checks. Svelte passes with zero errors/warnings. [PR #22](https://github.com/BigGuruHere/relationship-os/pull/22) merged at `4b0d7a3`. [CI run 42107460820](https://github.com/BigGuruHere/relationship-os/actions/runs/42107460820) passed all 131 foundation checks with zero failures/skips on `9114981`; live DEV/provider/mobile checks remain pending. The inherited audio transport is process-local and does not guarantee recovery after restart or replica switching. P-304 profile/auth continuity is implemented on its feature branch. Production remains deferred.

## P-302 public exchange intake (merged, 2026-11-06)

`feature/p302-public-exchange` connects the existing public detail-sharing flow to narrowly authorized foundation intake for ACTIVE profile owners. Person and stored-only exchange evidence commit together. Retry handling, consent, repeat-browser behavior, private provenance, transactional caps and lifecycle checks are covered by synthetic tests. No new migration or cohort activation. See [P-302 scope, acceptance and recovery](foundation/P302_EXCHANGE.md). [CI run 42051104009](https://github.com/BigGuruHere/relationship-os/actions/runs/42051104009) passed all 116 foundation checks with zero failures/skips on `9113b06`. Local Node 22 also passed 25 legacy regressions and Svelte check with zero errors/warnings. [PR #21](https://github.com/BigGuruHere/relationship-os/pull/21) merged at `4baa0bf`. DEV/device testing and production remain pending.

## P-301 private People directory (merged, 2026-11-06)

`feature/p301-private-people` adapts the existing directory, manual create and person detail pages for ACTIVE foundation accounts. Owner-only name/email/phone search has bounded pages and explicit continuation. Name and optional contact fields use existing encrypted subject columns. Legacy/PREPARED accounts retain their Contact path, with an account lock spanning manual create. Notes and public capture remain gated for foundation accounts pending P-303/P-302. No new migration, enrollment, activation or production deployment. See [scope, acceptance and recovery](foundation/P301_PEOPLE.md). Merged via PR #20 at `9aeac97`; DEV/device checks remain unconfirmed. Local Node 22 validation passed nine P-301 reported tests and 25 focused legacy regressions. Svelte check passed with zero errors and warnings. [CI run 41990600972](https://github.com/BigGuruHere/relationship-os/actions/runs/41990600972) passed all 104 foundation checks with zero failures/skips on `4996c98`. [PR #20](https://github.com/BigGuruHere/relationship-os/pull/20) is merged. DEV/device verification remains pending. The operator has chosen to defer production until release readiness is explicitly reviewed.

## F-206 internal integration rehearsal (merged, 2026-11-05)

The F-206 branch exercises legacy capture, Brokerage, owner-private evidence and corrected understanding together on synthetic accounts. The QR adapter now checks enrollment inside the transaction that creates the private home, Contact and receipt. Scope, rollback and release gates are in [the rehearsal record](foundation/F206_REHEARSAL.md). Merged via PR #19 at `7b92036`. CI run 41957382850 passed all 95 foundation checks. DEV smoke verification remains unconfirmed.

## F-205 private evidence (merged, 2026-11-05)

Merged via PR #18 at `8d895f8`. DEV smoke confirmation is pending. One note can concern several subjects and support a private statement with a distinct perspective. Corrections retain exact historic excerpts and invalidate stale understanding. Migration count is unchanged. F-206 integration rehearsal is merged. See [F-205 evidence and acceptance](foundation/F205_EVIDENCE.md).

## F-204 owner-private access and repositories (merged, 2026-11-05)

Implemented on `feature/f204-foundation-access-20261105` from development `bdd5ef8`, merged through PR #17 at `33f87f3`. DEV smoke confirmation is pending. Adds runtime-issued owner access handles, transactional state/epoch checks, guarded Prisma operations and private person/relationship/perspective services. No new migration, public route activation or cohort enrollment. [CI run 41911636542](https://github.com/BigGuruHere/relationship-os/actions/runs/41911636542) passed all ten F-204 tests plus 69 F-202/F-203 checks on code commit `77c0d0b`; the subsequent commit updates documentation only. Svelte check: zero errors/warnings. Six pre-existing audit failures reproduce on unchanged development. [Acceptance and usage](foundation/F204_ACCESS.md) records tests, limitations and rollback obligations. Next: F-205 evidence/versioned understanding slice; stage 2 remains open.

## F-203 account provisioning isolation (merged, DEV confirmed, 2026-11-05)

Merged via PR #16 at `bdd5ef874cd63a64450950861702d46ecde5a2fd`. Operator confirmed the requested DEV login, My People and share checks all work. Exact running Railway SHA was not independently inspected. Shared authentication now checks server-managed enrollment before issuing sessions. Internal idempotent preparation creates a private vault/self subject; no shipped signup or route invokes enrollment. Enrolled accounts skip legacy automatic claims; ACTIVE/SUSPENDED private People/capture paths fail closed pending their new adapters. Brokerage and voice remain on their existing model. No new migration or cohort activation. PostgreSQL 18.6 CI run 41898613496 passed all 21 F-203 tests, including concurrency, on `6fe087e`; Svelte check has zero errors/warnings. Six older audit failures reproduce on unchanged development and are documented. See [implementation and acceptance](foundation/F203_PROVISIONING.md).

## F-202 additive foundation schema (merged, DEV confirmed)

PR #15 merged into development at `2d6d1a3b15b99d1cec69b51d118522a5c7db0a51`. Operator confirmed successful Railway DEV deployment/migration and working login, My People and sharing. Exact running Railway commit was not independently inspected. No PROD deployment or foundation user activation is claimed. Migration `20261104010000_f202_foundation_schema` adds 15 tables; rehearsal/concurrency and operator evidence appear below.

## F-201 physical design and dependency inventory (merged, 2026-11-04)

Branch `docs/f201-physical-foundation-20261104` is based on latest development `d789464b67dd36524e637e8c35f3610f5ffce278`. It adds [physical schema/constraints/service contracts](foundation/PHYSICAL_MODEL.md), [source dependency and data inventory](foundation/DEPENDENCY_INVENTORY.md), and a commented [read-only aggregate inventory query](../scripts/foundation/inventory-readonly.sql). D-024 records why new private custody/typed subjects are separate from legacy ContextSpace and Contact.

Status: design/source inventory merged via PR #14 at `c3eb501dfaf9eb83339b127cfff570ab0b365646`. That documentation change made no Prisma schema, runtime or database changes; F-202 schema work is tracked above. Operator-reported DEV inventory, migration parity and backup/restore evidence are recorded below; the agent has not directly queried DEV/PROD. Stage 2 itself is not complete. Validation: all 56 relative links across 14 living/foundation documents resolve; the inventory SQL parses as 10 PostgreSQL statements limited to read-only transaction setup, SELECT and rollback; referenced tables were checked against Prisma. `git diff --check` passed. No SQL execution or application tests were performed for this design change.

## Relationship foundation programme (merged, 2026-11-04)

Source baseline for this review: development `77a8b2b58232b9413d57b86e853bf478bbee0492`. Branch `docs/relationship-foundation-plan-20261103` adds the [architecture and glossary](foundation/ARCHITECTURE.md), [decisions](foundation/DECISIONS.md), [policy/provenance contract](foundation/POLICY_AND_PROVENANCE.md), [stage-2/3 backlog and rollout plan](foundation/IMPLEMENTATION_PLAN.md), and [developer guide](foundation/DEVELOPER_GUIDE.md). Living product, architecture, roadmap and standing documentation rules are updated together.

Status: documentation merged through [PR #13](https://github.com/BigGuruHere/relationship-os/pull/13), development commit `d789464b67dd36524e637e8c35f3610f5ffce278`, confirmed 2026-11-04. No runtime implementation, Prisma migration, data movement or deployment. F-201 design/source inventory is now delivered as described above; F-202 additive schema and an internal proof follow. Stage 3 adapts existing QR, People and note interfaces for an invited cohort. Later relationship understanding and discovery remain planned. Documentation validation belongs to this PR; previous application test results below are historical and were not rerun for this change.

## Three-screen contact exchange and optional signup (merged into Development)

Implemented on `feature/three-step-profile-onboarding-20261103`, based on Development `4bb88fe7d84559ac1531653790518efc789f9fd8`. Merged into `development` on 2026-11-03 via [PR #10](https://github.com/BigGuruHere/relationship-os/pull/10), merge commit `841e59cc1d68a2f41d2404474bfa0576b265debb`. Deployment and real-device validation remain unverified.

1. Published visitor profile shows public details and **Save contact**. With JavaScript, the existing vCard download starts and navigation follows to the existing share-details route. Browser/OS completion of saving a contact is not detectable. The follow-up fix removes the secondary sharing button so this screen has one exchange action; automatic continuation requires JavaScript.
2. Optional **Share your details** form retains name, optional email/telephone, explicit consent, capture token, custody, provenance and abuse protections. **Skip** writes no Contact.
3. Send or Skip shows an optional **Create my Relish profile** invitation. A successful Send displays a receipt and a private preview using only the visitor's entered details. Skip shows an empty preview, without a false sharing confirmation. Close/Maybe later returns to the original profile. Signed-in visitors go to My Profiles.

Only the explicit profile-creation button stores a bounded, authenticated encrypted HttpOnly draft cookie for 30 minutes. It is form convenience, not identity evidence. Existing registration, login and Google OAuth allow one exact new return destination (`/settings/profile?onboarding=1`) alongside existing Network invitation returns. New profiles created by this flow begin unpublished; regular registration defaults are preserved. The existing owner-scoped editor prefills blank email/phone fields for review, then returns to Share/QR. P-304 adds account/profile binding and clears the draft on a matching successful save. Existing profiles are not overwritten by signup. No Contact/Person/User matching, mutual Connection, Dorian call or private-note disclosure is inferred. No Prisma migration.

Validation: Node 22 Svelte/TypeScript check passed with zero errors/warnings. All 28 focused tests passed, covering real route handlers with an in-memory persistence boundary, draft encryption/expiry, redirect restrictions, rendered screens and compatibility. The full suite recorded 839 passes and 52 failures out of 891 tests; unchanged Development at `4bb88fe` recorded 827 passes and the same 52 failure names out of 879 tests in a separate prepared worktree. No new full-suite failures were introduced. These are local checks, not live database/provider tests. Browser/device vCard handoff, actual database capture and real Google OAuth remain unverified; Chromium was unavailable and its download failed in this environment. The configuration-specific event landing redirect remains intact and can still supersede the normal profile landing.

### Contact exchange layout fix (2026-11-03)

`fix/profile-exchange-layout-20261103`, based on Development `adaf26a`, removes the secondary Share your details action from the guest profile. Save contact retains its vCard download and continuation to screen two. The consent checkbox now overrides global full-width input styling with a fixed 18px width; the adjacent text can fill and wrap within the remaining row. No server behavior or Prisma migration changes. Validation: 12 onboarding tests and the focused profile action regression check passed; Node 22 Svelte/TypeScript check passed with zero errors/warnings. Merged into `development` on 2026-11-03 via [PR #11](https://github.com/BigGuruHere/relationship-os/pull/11), merge commit `c4c643d6ab2d38bf7e5e5e9f57c6b6785f3a9daa`. Deployment and real-device verification remain unconfirmed.

### Returning contact exchange visitors (merged, 2026-11-03)

`fix/contact-exchange-return-visit-20261103`, based on Development `5ccf29d`, remembers successful detail sharing with an encrypted HttpOnly browser receipt. After Maybe later returns to screen one, downloading the contact again opens screen three directly through the existing share-details route. The receipt contains profile IDs/timestamps only, lasts 30 days, and retains at most 16 profiles. It is written only after successful capture, never after Skip, validation/storage failure or honeypot submissions. Different profiles, cleared cookies and other browsers still start at the sharing form. It cannot retroactively recognise shares completed before this fix. It grants no data access, identity link or mutual Connection, and makes no additional Contact write on a repeat visit. Existing signup remains independent: it does not automatically add the sharer to the new user's My People list. No Prisma migration. Validation: all 15 onboarding route/helper/render tests passed, and Node 22 Svelte/TypeScript check passed with zero errors/warnings. The existing browser check now covers the repeat-download journey but has not been run against a live database. Merged into development via [PR #12](https://github.com/BigGuruHere/relationship-os/pull/12), commit `77a8b2b58232b9413d57b86e853bf478bbee0492`. Deployment remains unverified.

### Corrections to older branch-status notes below

Source inspected at Development `4bb88fe` already contains the private-only My People reversal, repaired People navigation, and the multi-profile manager. The older feature-branch-only paragraphs below are historical status descriptions, not current evidence that these changes remain unmerged. Their live DEV/PROD deployment remains unverified. Type-check results above apply to this new feature branch.

## What is implemented in Development

| Capability | Source status | Verification caveat |
| --- | --- | --- |
| Existing Brokerage CRM / Contact and Interaction workflows | Preserved in main app | Regression-test on changes that touch shared services |
| My People Stage 1: manual Contact, search, owner notes and voice-note flow | Merged into `development` | Codex reported local tests; real devices/providers still need testing across platforms |
| My People Stage 2: QR/profile opt-in share-details capture, provenance, private Contact and optional note summaries | Merged into `development` via `5cc7cc5` and `47c00d4` | Its stage note still says feature branch only; that branch-status sentence is now historical and stale |
| Existing profile, QR, event signup and optional Dorian routes | Present | Event redirect may be configuration-specific; test the actual public visitor path |
| Dorian consent, call routing and Living Understanding pipeline | Present from earlier work | Operating behavior, provider settings and actual Railway deployment are not verified by this document |
| `AGENTS.md` development rules | Merged at `54a11ef` | Standing rule requires new Codex feature branches from Development by default |

Stage 2's checked-in test report records `npm run check` with zero errors/warnings, 820 passes and 50 existing assertion failures out of 870 tests, and focused integration tests including 11 QR capture checks and 14 Stage 1 checks. These are **reported Codex test results**, not tests independently rerun for this documentation update. No new Prisma migration was needed for Stage 1 or Stage 2.

## UI cleanup integrated into Development

Pull request [#2](https://github.com/BigGuruHere/relationship-os/pull/2) merged `feature/context-neutral-home-ui-cleanup` into `development` at `bb8c4d0030f22e355d78ed216bc84c6060ece35a` on 2026-11-02, covering three requested improvements:

1. Make `/` a context-neutral authenticated Home instead of redirecting to the first `/space/[context]`.
2. Hide the public invitation to speak to Dorian while retaining its implementation for later.
3. Remove the Settings destination from primary desktop and mobile navigation without removing routes or operator controls.

The code is merged into `development`, but type-check, browser testing and Railway deployment remain unverified here. Do not mark the UI work deployed or pilot-validated until those steps are confirmed.

## Legacy Personal-tag organiser reversal (not yet merged)

On 2026-11-03 the owner elected to abandon the temporary Personal-tag bridge between Brokerage and My People in favour of adding a small number of personal Contacts afresh.

- The organiser originally landed on `development` (commit `b36d8a4d460ce6d51477a7896af04b19b7a1a163`), despite its earlier feature-branch-only documentation.
- `revert/owner-personal-contact-organiser-20261103` restores the original private-only My People directory and removes the organiser page, tag helper and corresponding tests.
- Existing Brokerage Contact records, IDs, notes and historical relationships are not deleted or moved. Previously applied Personal classification tags are not used by the restored directory. No database writes are part of this reversal.
- Any Contact separately created in the private My People storage remains there; it is not a copy created by the Personal checkbox and must be reviewed individually before deletion.
- Reversal is committed only to the feature branch. Integration and deployment are separate steps; production/DEV state has not been verified.

## Navigation and mobile header corrections (feature branch only)

On 2026-11-03, `fix/people-navigation-mobile-header-20261103` restores the common Home, People, Profile and Share navigation on desktop and mobile for My People routes. It also restores mobile right alignment of the header action and three-dot menu on pages without a ContextSpace selector. Focused source regression checks were added. This is not merged or deployed; type-check and real browser validation remain outstanding.

The Business/Friendship/Dating selector still navigates ContextSpaces, not profiles. Multiple independently labelled profiles per kind are not yet supported by the existing editor workflow, despite the Profile model already having a label field. This is a separate product decision.

## Multiple independently labelled shareable profiles (feature branch)

On 2026-11-03, `feature/multi-labelled-profiles-20261103` adds a profile manager that lists **all** owner-created Profile records, including multiple profiles with the same `kind`. The existing editor supports an explicit `mode=new` creation path and stores an owner-facing `Profile.label` separately from public `displayName`. Each profile keeps its independent slug, published status, QR destination and source-profile provenance for new Contacts. New profiles created from My Profiles begin unpublished unless explicitly published; established first-time onboarding keeps its prior publication default.

Existing Business/Friendship/Dating ContextSpace selection remains unchanged. Legacy contextual profile selection now prefers the established oldest profile of a kind (or the account's default), so adding a new same-kind profile does not automatically replace it in the existing context UI. This does **not** introduce a new ContextSpace, permission or custody relationship. No Prisma migration is needed because `Profile.label` and one-to-many User profiles already exist.

Status: code committed to feature branch only, not merged or deployed. Added focused source regression tests. Runtime Svelte checks, database tests, browser testing and QR verification are still required before pilot rollout.

## Context-neutral profile navigation and label-based Share selector (feature branch)

On 2026-11-03, `fix/profile-share-context-neutral-selector-20261103` removes the Business/Friendship/Dating ContextSpace selector from neutral `/profiles`, `/settings/profile` and `/share` routes. Those routes now use the same global navigation as Home and My People; selectors on genuinely contextual workspace pages remain unchanged.

The Share page now provides a dropdown of **all profiles owned by the signed-in user** with the owner's label (falling back to the public name for legacy default labels), plus type as secondary context. Selecting a profile navigates to its exact `/share?profile=<slug>`, keeping QR and share actions consistent. Unknown explicit profile slugs return 404 rather than silently choosing another profile. This uses existing Profile fields with no migration.

Status: feature branch committed, not merged or deployed. Focused source regression coverage added; full application checks and real mobile/browser tests still outstanding.

## Problems and limits worth tracking

- The user observed transcription returning "You" on one Windows laptop while voice transcription worked on other machines. This appears device-specific, but the browser/microphone root cause is **not verified**. Do not rewrite the common transcription service solely on this evidence.
- Test suites contain about 50 known legacy/source-pattern assertion failures at the last reported baseline; re-evaluate their relevance before treating them as harmless or changing them.
- The current My People directory is for the new neutral private home. The original Brokerage Contact records remain in their existing custody and are **not yet consolidated into My People**.
- ContextSpace-specific UI and some old documentation still give the impression that people belong to one exclusive relationship domain. That is not the long-term product model.
- Previous stage documents include old operating and deployment instructions. This snapshot does not assert anything has been deployed to Railway DEV or PROD.
- `README.md` and `CLAUDE.md` historically contained older product/stage framing; the living documentation set now provides the intended current context.

## Next verification sequence

1. Run type and browser checks against merged Development for the neutral Home UI; confirm it does not hide public QR capture or useful navigation.
2. On Railway DEV, manually test sign-in -> Home -> Share -> visitor QR -> details submission -> My People -> voice note -> refresh/retrieve.
3. Test both existing Brokerage Contacts and other public profile/event pages for regressions.
4. Confirm actual DEV/PROD branch mappings and deployments before promotion; no implicit production change.
5. Record the verified results and commit/branch identifiers in this document after each accepted change.

## Status maintenance

When a branch is merged, tested or deployed, update the corresponding status and date here. Do not leave "in development", "not merged" or test counts frozen forever. Keep this file concise and move historical detail to stage notes or the Git history.

## F-202 rollout readiness, 2026-11-05

PR #15 is merged at `2d6d1a3`. Operator confirmed DEV deployment and migration succeeded and login, My People and sharing still work. PROD status is unverified.

- PostgreSQL 18.6 CI: 23 embedded schema tests and 25 concurrent-session tests passed ([run](https://github.com/BigGuruHere/relationship-os/actions/runs/41753717094)).
- Operator-reported development inventory: 106 completed migrations, no unfinished/rolled-back attempts; only F-202 pending. 105 checksums match bytes exactly, one matches CRLF line endings. Three legacy Contact links reference missing accounts; no custody mismatches. No automatic repair or reuse of these links.
- SQL rehearsal on the development child branch: 15 Foundation tables, zero enrollments/vaults, 9 Users / 28 Contacts / 127 Interactions matching the earlier development counts.
- Development snapshot created and restored to a separate branch. Restored checks: zero Foundation tables, 106 applied migrations, zero unfinished; 9 Users / 28 Contacts / 127 Interactions.
- Prisma `migrate deploy` on that restored branch applied only F-202; `migrate status` reported up to date. Subsequent operator checks: 15 tables, zero enrollments/vaults and the same three legacy counts.
- Operator chose `npm run start:with-migrations` for Railway development and reports adding it. This existing script runs `prisma migrate deploy && node scripts/start-relish.mjs`. The historical shadow-database replay issue remains unresolved, but does not block the rehearsed deploy workflow. Do not require `migrate dev` for this rollout.

These are operator-reported Neon results, not direct agent database access or a full data-equivalence/schema-drift audit. DEV deployment and application smoke results are operator-reported; exact running SHA and post-deployment parent database counts have not been independently inspected. Retain the snapshot under the agreed retention policy. See [validation details](foundation/F202_INVARIANTS.md).
