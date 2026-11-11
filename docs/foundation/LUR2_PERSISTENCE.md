# LUR-2 private conversation and understanding persistence

Implemented on `feature/lu-foundation-persistence` from Development `f79cd8af`, which includes [LUR-1](LUR1_CONTRACTS.md). Merged via PR #67 at `b855aa45`. Hosted verification has not been recorded. This stage connects the existing owner-only DEV Dorian conversation to Foundation storage and provides the repositories for the next semantic stage.

## User flow

Finish a conversation from a person in My People. Relish drafts a summary from your side of the conversation and lets you edit it. **Save private conversation** stores the provider transcript and the summary together. The person page opens the summary and offers a collapsed transcript showing both speakers. Editing the summary appends an independent version. Saved conversations remain accessible to the vault owner through My People, independently of the Dorian launch gate.

The save action verifies the signed launch against the current session, person, agent and vault epoch. It fetches the matching completed transcript server-side and stores the speech turns in provider order with stable IDs. Repeat saves with the same summary return the original receipt even if the provider can no longer return the transcript. The caller-only summary can fail independently and the owner can write their own. An incomplete transcript is marked as such and is ineligible for LU preparation. The stored record starts with `STORED_ONLY` admission. A separate repository operation records an owner-authorised correction or an explicit analysis-admission change.

Earlier Dorian summary notes retain their existing note format. The simple note reviewer remains available for eligible notes. Newly saved conversations wait for the richer review integration in LUR-3 and LUR-4. This stage exercises the new approval writer with synthetic candidates.

## Physical contract

The migration adds ten tables and a context evidence role. It reuses `FoundationSourceVersion` for the encrypted transcript envelope and its content MAC. The initial `FoundationSourcePresentationVersion` provides the scoped conversation-to-person binding and exact source version. Summary successors preserve that binding and reference the source version available when edited. Origin metadata on the first presentation records whether the summary was drafted or edited from a model result. Subsequent edits have their own provenance and keep the previous version.

`FoundationLuMeaningOrigin` stores content kind, epistemic basis, attributed asserter and generator beside the existing statement version. This keeps the legacy statement schema and historical rows intact while requiring classification on each new LU meaning. The exact primary supporting segment and any context dependencies stay separate. Transcript anchors use UTF-16 offsets and turn IDs. Reused excerpts share a segment while each statement retains its own support relation. Conversation excerpts stay out of ordinary note pagination.

Streams use the private subject and owner perspective. Revision membership references the exact topic version in the same stream and vault. Topic versions preserve inherited meaning references and membership roles. Unchanged topics reuse the original version. Candidate and approval records bind exact source and baseline versions. The approval transaction checks the full baseline, writes all selected streams atomically and records deferred changes. A repeat request returns the original receipt. A no-change outcome creates a candidate receipt without an empty revision.

LU reads verify eligible statement inputs and every supporting or contextual dependency before decrypting topic prose. Source correction or admission withdrawal suppresses affected topics, including in historical snapshots, while other eligible topics remain available. The owner can still read their saved transcript. Archived people and suspended vaults block the corresponding retrieval. The reviewed erasure operation removes the new lineages in dependency order. The review export includes summaries and topic text without provider bindings or internal candidate payloads.

## Migration and validation

Migration `20261111010000_lur2_private_understanding` is additive. For a local disposable database, use `npx prisma migrate dev`. The migration was rehearsed against synthetic Foundation notes and an already approved statement. The isolated runs passed 75 contract, schema and persistence checks, 69 People, notes, privacy and exchange checks, and 15 onboarding and Dorian route checks. Svelte diagnostics reported zero errors and warnings. No hosted database migration has been run for this branch.

Before the first conversation write, an application rollback can leave the additive schema in place. Once conversation records exist, retain their guarded readers and erasure support while stopping affected writers and rolling forward. Dropping the new tables would delete saved conversation summaries and LU history.

Run `node --test tests/foundation/lur2-persistence.test.mjs` for isolated persistence checks and `node --test tests/foundation/p306-dev-pilot.test.mjs` for the Dorian route and existing onboarding journey. The PostgreSQL PR job also runs the persistence suite against a separate empty localhost database. Hosted Dorian capture and model quality require their own acceptance. The semantic engine, candidate review and activation remain separate delivery stages.
