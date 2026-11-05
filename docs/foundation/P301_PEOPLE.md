# P-301 private People directory

Updated 2026-11-05. Implemented on `feature/p301-private-people` from development `7b92036` (PR #19). Merged via PR #20 at `9aeac97` on 2026-11-06. DEV deployment and device acceptance remain unconfirmed. No account is enrolled or activated by this change.

## Reuse and scope

The existing `/people`, `/people/new` and `/people/[id]` screens provide the directory, manual form and detail view. F-204 supplies owner authorization and encrypted subjects. P-301 connects these capabilities, extends person creation with optional email/phone in the existing `detailsEnc` column, and supplies bounded owner-only search. It reuses the existing contact validation rules. No new page, database table, identity matching or contact classification is introduced.

P-301 does not ship a notes reader or writer. Foundation detail pages show contact details and explain that notes are unavailable for the account. Existing legacy note history and actions remain available on the legacy path. P-303 must adapt the recording/save/retrieval boundary before activation. P-302 supplies public capture separately.

## Authority and storage

`peopleRouting.ts` resolves persisted enrollment using the authenticated account. LEGACY and PREPARED retain the legacy Contact path. ACTIVE requests may use only directory, create and person detail routes. SUSPENDED requests and ACTIVE note/upload/transcription paths fail closed. There is no request flag, cookie or public API that activates foundation storage.

The authentication hook skips legacy ContextSpace resolution for enabled foundation People routes. A cookie cannot supply custody. Each page resolves fresh foundation authority from authenticated locals and each repository operation checks the current account epoch, root and lifecycle under account/vault locks. Foreign, missing, archived, self and non-person subject IDs return an unavailable response. The UI does not expose relationship membership or self-directory entries.

`createPerson` keeps its existing return projection. Optional fields are encrypted in a versioned `PERSON_DETAILS` JSON payload bound to owner, vault, row and column. `readPerson` and `searchPeople` project only the directory name/contact fields. No User, canonical Person, legacy Contact, reciprocal connection or profile is created or linked. Identical names and contact details remain separate entries. Each successful manual submission creates one entry; retry deduplication is not claimed for the manual form.

The legacy manual-save transaction now holds the same account enrollment lock through private-home creation and Contact insertion. This prevents a delayed legacy create from committing after an activation handoff. Activation still requires the complete quiesced-writer procedure in F-206; this single route change does not authorize a live cohort transition.

## Search contract

Search inspects at most 50 owner-scoped active non-self people per request, ordered by opaque ID, with a 51st row used only to determine continuation. Only the first 50 records are decrypted. Search is case-insensitive across name, email and phone. It is not a recent-first or global identity search. No plaintext or deterministic personal-information index is added.

The response can contain zero matches and still have another page. The UI explicitly says when there are no matches on the current page and offers **Continue searching**, preserving the query in its next-page link. **More people** paginates the unfiltered directory. Concurrent inserts before the current cursor require restarting the search; pagination does not claim snapshot consistency. Search terms follow the existing GET form behavior and appear in browser URLs. Avoid logging query strings containing private search terms in deployment diagnostics.

## Validation

Node 22 local validation passed all nine P-301 reported tests and all 25 focused People/capture/onboarding/navigation regressions. F-204/F-205 local access cases passed with three standard-server concurrency cases deferred to CI; F-206 synthetic rehearsal passed. Svelte check passed with zero errors and warnings. [CI run 41990600972](https://github.com/BigGuruHere/relationship-os/actions/runs/41990600972) passed all 104 reported checks with zero failures/skips on implementation commit `4996c98`: nine P-301, seven F-206, 23 F-202 schema, 25 F-202 concurrency, 21 F-203 and 19 F-204/F-205 checks. The subsequent commit records this result only. `npm run check:foundation:people` uses only synthetic in-memory PostgreSQL with the actual legacy fixture, F-202 migration, shared Prisma client, authentication hook, layout and People loaders/actions. It covers create/search/open, cross-owner and forged custody inputs, missing/archived/wrong-type IDs, validation, pagination, suspended/locked roots, legacy/PREPARED routing and rendered Svelte output. Foundation CI also retains the standard PostgreSQL handoff/concurrency tests and F-206 Brokerage/QR rehearsal.

## Release and recovery

No new Prisma migration. F-202 must already be applied in a target environment. Deploying this feature does not prepare or activate accounts. Keep production deferred until the complete release diff, target migration status, backup/restore rehearsal, DEV/device acceptance and rollout/privacy gates have been reviewed. The invited foundation pilot remains gated by P-302 through P-306.

Before any live activation, follow F-206 and account for all legacy private writers and existing records. After foundation writes, never switch the account back to stale legacy storage. Suspend affected private operations and roll forward with compatible readers, retaining encrypted records. Brokerage remains on its existing model. Do not drop foundation tables as rollback.
