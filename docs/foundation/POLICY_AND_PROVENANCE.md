# Permission and provenance contract

Date: 2026-11-03. Status: target contract; implementation is staged. Existing access restrictions stay in force until replacements are tested and deliberately activated.

## Authorisation inputs

Every new domain operation resolves an authenticated actor or narrowly scoped visitor capability, custodian, resource/version, action, purpose and audience on the server. Client identifiers locate candidates; they confer no authority. Background jobs and agent tools obey the same policy boundary. Missing or inconsistent policy denies access.

Actions include record, read, derive, privately retrieve, use for discovery, disclose, subscribe to updates and propose an introduction. Permission for one does not imply the others. A service identity is not blanket participant consent.

| Situation | Required behaviour |
| --- | --- |
| Private note | Owner access and approved processing only; being its subject grants no access |
| Identity linking | Changes identity association only; does not promote private evidence into shared information |
| Context relabelling | Changes semantic association only |
| Profile exchange | Records disclosed snapshot/source and explicit permissions; no automatic mutual relationship |
| Public profile | Accessible by publication policy; recipient revocation cannot restrict its still-public fields |
| Restricted sharing | Grant identifies fields/projection, recipient and update mode; adding fields does not silently expand it |
| Joint statement | Exact version and acknowledgements tracked; one person's assertion is not joint agreement |
| Cross-account discovery | Both relevant contributions must be eligible for the purpose; recommendation/outreach itself is a disclosure decision |

A grant records issuing authority, beneficiary/audience, resource selection, permitted actions, purpose, constraints, validity, version and revocation. The authority to grant is checked separately from who recorded or is mentioned in the source. Names, relationship membership, source links and derived metadata require protection too.

## Stable evidence and derivation

Anchor segments to immutable source versions and stable turn IDs, or offsets with a specified encoding and content hash. An edited transcript cannot silently move an old anchor. Validate quoted text and speaker attribution. Retain qualifications that affect meaning; record uncertainty when attribution is ambiguous.

Statements distinguish observed/declared/inferred, speaker, perspective, subject(s), recorder and custodian. Record observed time, validity period and recorded time separately where needed. Declared willingness is not a perpetual commitment.

Derivation edges identify exact input versions and output versions. Permission to view a summary never authorises traversal to a private source. Outputs do not lose source restrictions through paraphrase. Multiple inputs require compatible authorisation; an explicit approved disclosure projection may release selected content without releasing its private derivation graph. Third-party sensitive material requires assessment rather than assuming the speaker controls every disclosure.

## Correction, expiry and withdrawal

| Event | Consequence |
| --- | --- |
| Correction | Supersede source/statement version; reassess dependent understanding |
| Changed circumstances | Historical statement may remain true, but current use becomes stale or ineligible |
| Permission withdrawal/expiry | Stop new affected processing and disclosure; invalidate eligible caches, indexes and pending outputs |
| Account/record deletion | Apply defined retention/deletion workflow to content and derived stores; history is not an excuse to retain usable deleted content |

Use dependency tracking and a durable invalidation job/outbox when asynchronous derivatives are introduced. Recheck current grant version at retrieval and immediately before disclosure or external delivery. A queued job created before withdrawal cannot bypass it. Fail closed while affected material is awaiting reassessment. Retry idempotently and expose job failure to authorised operations staff.

One withdrawn source need not invalidate a conclusion independently supported by other eligible sources, but that requires reassessment and a new eligible derivation. Historical audit receipts may remain under an explicitly defined retention policy; they should not retain the withdrawn content by default. Downloaded vCards and already learned information cannot be recalled by revoking a Relish grant.

## Secure claim requirements for stage 4

Bind a claim to the exact exchange and intended beneficiary using a server-issued, expiring, single-use capability plus appropriate account/channel verification. Store token hashes, protect against replay and session/account switching, and bind redemption atomically. A browser draft or completed-sharing cookie is never sufficient identity proof. Matching email/phone/name may suggest a review, but cannot claim another person's record by itself. Exact assurance and recovery UX must be designed before this capability is implemented.

## Acceptance tests by capability

Foundation: forged owner/custody/subject references denied; cross-owner relation traversal denied; context changes grant nothing; identity linking leaves private access unchanged.

Evidence: edited sources retain old anchors; ambiguous speaker attribution does not become verified declaration; multi-subject links do not duplicate or expose source content.

Sharing: newly added fields excluded unless authorised; public/restricted views differ correctly; expired/revoked grants fail; private overrides survive updates; claim replay and account-switch attacks fail.

Understanding/discovery: restricted inputs cannot leak through summaries, citations, candidate existence, counts or notifications; withdrawal races block pending delivery; independent evidence is reassessed; joint acknowledgement is version-specific.

Implement these tests with the corresponding capability. Do not claim future guarantees from documentation or stub policy functions.
