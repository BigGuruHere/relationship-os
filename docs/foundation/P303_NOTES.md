# P-303 private notes and retrieval

Implemented on `feature/p303-private-notes` from development `4baa0bf` (P-302 PR #21). Merge, DEV/provider/device acceptance and production deployment remain pending. No account has been activated by this work.

## Existing capability and change

The shared `ContactNoteForm`, People note page, summary action, chunk recorder, transcription provider and poll endpoints already exist. P-303 connects those surfaces to F-205 evidence for ACTIVE foundation accounts. It does not introduce another recorder, note page or provider integration. LEGACY and PREPARED accounts retain Contact/Interaction storage; Brokerage retains its existing routes and model.

The foundation form loads a draft retry UUID. Save scopes that key to the authenticated owner's vault and selected person. Identical retries succeed without duplicating evidence; changed content under the same key returns a conflict and preserves the draft. Validation/storage errors retain text, summary, channel and retry key. Enhanced private forms keep drafts visible on a failed network response. Drafts are not durably autosaved: closing/reloading an unsaved form can lose its contents.

Text and reviewed voice transcripts save through `appendOwnerNote` as OWNER_NOTE or VOICE_NOTE, recorded by the owner with STORED_ONLY admission. The complete text is encrypted, up to 64,000 UTF-16 code units; the exact initial evidence excerpt is bounded at 8,000 without splitting a surrogate pair. An optional reviewed summary is encrypted in provenance. Saving never creates a statement, embedding, identity link or disclosure grant. Existing F-205 requests omit the new optional fields and retain their original replay representation.

## Retrieval and authority

`READ_NOTES` is a separate owner-private evidence operation. The person page retrieves the current associated version of an active note source, not the original version after a correction. Original evidence excerpts remain unchanged. Disabled sources and non-active subjects cannot be opened. Full-text note retrieval does not widen `READ_SEGMENT` or statement authority.

History scans at most 50 evidence associations per page and exposes a continuation cursor belonging to that person. Non-note exchanges and superseded versions can consume scan slots, so a page may contain fewer than 50 notes or no visible notes while still offering More history. Related records are batch-loaded, with bounded point lookups for current source versions. No unbounded correction history is loaded. This stage supports editing the unsaved draft; a saved-note correction UI remains future work.

`PROCESS_DRAFT` authorizes an explicit request to transcribe uploaded audio or summarise submitted text. It provides no stored-source read/write capability and no permission for later analysis. Provider calls run outside database transactions, with current account/vault/epoch checks before and after the call. A revoked in-flight result is withheld. This cannot retract input already sent to a provider before revocation.

## Transient audio and recovery

The shared transport binds jobs and assemblies to the authenticated user and a server-created domain scope. Foundation scope includes vault and enrollment epoch; no submitted context selects it. Polling resolves current authority again. Another owner, a legacy endpoint, suspension, or a changed epoch cannot retrieve a foundation transcript.

Chunk writes serialize per upload key in each process. Completed uploads reject subsequent chunks so provider input cannot change after queueing. New assemblies overwrite abandoned files instead of appending to them. Empty transcripts and provider failures report an error, not a successful empty note. Foundation polling retains completed results for retry until the one-hour expiry; legacy polling remains one-shot. Cleanup removes expired in-memory jobs and old temporary audio on a best-effort timer. Navigation stops recording and cancels further polling.

The inherited transport remains process-local, with temporary disk audio and in-memory jobs. Restart, replica switching, or a lost final-upload response can require recording again. It is not a durable distributed queue or a guarantee of audio recovery. Verify single-instance/sticky routing and real device behavior before pilot activation, or implement durable transport in a separately reviewed slice. No live provider call was made by the synthetic acceptance tests.

## Acceptance and rollout

Local Node 22 validation passes 14 P-303 reported checks, 20 existing P-301/P-302/boundary checks, and 25 focused legacy regressions. CI and final Svelte validation are pending.

Acceptance uses actual route handlers, guarded Prisma and an isolated PGlite fixture. Provider functions are mocked. Tests cover full-text save/retrieval, encrypted stored-only admission, exact/conflicting retries, rollback/draft recovery, owner isolation, bounded pagination, corrected and disabled sources, denied stored reads under draft authority, summary failures and revocation, job isolation, retry polling, finalized uploads, empty/failed transcription and suspended/changed-epoch jobs. Existing foundation PostgreSQL concurrency checks remain in CI; browser rendering alone is not device acceptance.

No Prisma migration is required. No enrollment, cohort activation, live database write, merge or deployment is performed by this branch. P-304 profile/auth continuity is next after integration. P-305 privacy operations and P-306 DEV/device/rollout acceptance remain mandatory before recommending production.

After an authorized DEV deployment, check existing login, People and public-sharing behavior plus legacy text/voice notes. For a separately authorized synthetic foundation cohort, create a person, type or record a note, edit its draft, optionally summarise, save, refresh, reopen history, retry interrupted requests and test denied microphone/provider/storage paths on desktop and mobile. Record the deployed SHA and results. Do not activate existing accounts just to perform this smoke check without the documented writer handoff.

After foundation writes, rollback must preserve records and domain selection. Suspend affected operations and roll forward with a compatible reader. Never fall back to stale legacy notes or drop foundation tables as recovery.
