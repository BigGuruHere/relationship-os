# P-302 public exchange intake

Updated 2026-11-06. Implemented on `feature/p302-public-exchange` from development `9aeac97` (PR #20). Merge, DEV/device acceptance and production deployment are pending. No automatic enrollment or activation is introduced.

## Existing capability and precise change

The three-screen public profile, vCard, optional detail sharing, Send/Skip, optional signup and returning-browser receipt already exist. P-302 reuses those pages and their consent, origin, body-size, honeypot and browser-bound token checks. It changes the persistence adapter for ACTIVE profile owners. LEGACY and PREPARED destinations retain Contact/Interaction storage. SUSPENDED destinations return a retryable unavailable response. The visitor's signed-in account and submitted owner/context flags never select the destination.

No new Prisma migration. Existing FoundationSubject, Source, SourceVersion, EvidenceSegment and EvidenceSubject tables store the person and receipt in one transaction. This stage does not activate accounts or enable notes, profile claims, continuing sharing, automatic identity links or AI processing. Those capabilities retain their separate release gates.

## Narrow public authority

`policy.withPublicCapture` is a repository-only boundary. It independently verifies the signed token against profile and browser, reads the published profile owner from the database, and rechecks ACTIVE enrollment, vault lifecycle and self root under the account/vault locks. It then takes a Profile row lock, rechecks publication and ownership, and verifies token expiry again after any wait. Its transaction uses READ COMMITTED. Callback results are discarded so no private record IDs or data become a visitor response.

The PUBLIC_CAPTURE Prisma mode allows only new person/evidence records, receipt existence/MAC comparison and profile-scoped receipt counts. Subject reads, updates/deletes, memberships, perspectives, statements, analysis admission and source payload reads are denied. Receipts are confined by owner/vault and an opaque profile prefix. Runtime scope expires after the callback. Architecture tests restrict the public-boundary caller to `foundation/capture.ts`. This remains an application-code boundary, not a SQL sandbox or protection against privileged database access.

The route checks explicit contact-sharing consent before invoking the adapter. A token alone is neither evidence of consent nor proof of identity. It cannot be used to claim a person record, acquire owner authority or establish a mutual connection.

## Persistence and provenance

The shared private-person insertion helper creates encrypted name/email/phone fields using owner/vault/row/column AAD. Initial visitor-supplied values remain unverified, with origin retained separately in encrypted details. The owner detail page shows the submission date through the existing origin presentation.

Each exchange creates a CONTACT_EXCHANGE source, immutable version 1, one exact JSON evidence segment and a typed person association. The recorder is VISITOR, admission is STORED_ONLY and speaker identity remains unset. Encrypted provenance records profile ID/kind, submission time, unverified entry hint, submitted field names and the shared contact-consent version/purpose. No User, canonical Person, Contact, reciprocal record or inferred statement is created on the foundation path. Existing people with equal names/emails/phones remain distinct.

Public POST responses retain the existing generic receipt and the visitor's own entered fields. No person ID, match result, private source or owner directory is returned. Sharing receipts remain browser convenience only. Signup remains independent and grants no link to the recipient's private records.

## Retry, abuse and concurrency

A vault/profile-scoped nonce MAC identifies a submission. Exact normalized payload retries return success without another write. Reusing the token with changed details returns 409 and leaves the original intact. A fresh token is a new sharing action, not automatic deduplication by identity. Retry handling occurs before rate-limit consumption.

The existing limits remain ten submissions per browser/profile/hour in process memory and 100 per profile/hour in persistent receipts. The account/vault lock serializes receipt lookup, cap checking and insertion across application instances. Browser limits remain process-local and restartable, matching the legacy limitation; the persistent profile cap is the cluster-wide limit. Neither is a general distributed abuse-prevention service. HMACs use separate vault/purpose scopes and add no plaintext personal-information search index.

Profile withdrawal and suspension races are rechecked after locks. Storage failures roll back person, source and associations together. Successful-sharing cookies are written only after commit. Diagnostics retain only the existing redacted failure category, stage and reference. They exclude raw Prisma errors, SQL parameters and visitor fields.

## Acceptance evidence

Local Node 22 tests pass ten P-302 reported checks, covering actual routes and foundation persistence, encrypted provenance, consent/token binding/expiry, signed-in visitor isolation, repeat visits, changed-payload retries, separate duplicates, forged/private access, stored-only analysis denial, rollback, redaction, lifecycle rejection, caps and legacy/PREPARED compatibility. Twenty-five focused legacy People/capture/onboarding/navigation regressions pass. The combined local foundation selection reports 42 passes and five standard-server races deferred to CI. Svelte check passed with zero errors and warnings. PostgreSQL CI is pending.

The standard PostgreSQL suite adds concurrent identical/conflicting retries, the last profile-cap slot, account suspension and profile withdrawal. It observes real blocking before committing lifecycle changes. Existing foundation checks and F-206 Brokerage/legacy capture rehearsal remain in CI. F-206's former ACTIVE-without-token rejection now expects 403 because P-302 admits only token-authorized intake. Real devices, provider integrations and live databases are not exercised by these synthetic tests.

## Rollout and recovery

No migration or live data change is required by this branch. Merge/deploy does not prepare or activate a cohort. DEV smoke checks should cover the existing public profile, vCard, Send, Skip, Maybe later and repeat download, plus owner People and Brokerage. Foundation intake acceptance currently uses synthetic activated accounts. Before a live activation, complete the writer handoff and inventory procedure, P-303 notes, P-304 continuity, P-305 privacy operations and P-306 device/rollout acceptance.

Production remains deferred by operator choice. Before recommending promotion, review the full production diff, actual target migration state, snapshot/restore readiness and DEV evidence. After new-domain writes, suspend affected private operations and roll forward with compatible storage readers; never fall back to stale legacy data or drop tables as rollback. An emergency application rollback may make ACTIVE intake unavailable but must retain existing records and domain isolation.
