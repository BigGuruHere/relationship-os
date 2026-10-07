# Stage 8.10.4 - Dating Voice Smoke Test and Dependency Security Review

Baseline: Stage 8.10.3. No Prisma schema changes or new migrations. Preserve your `.env` and existing development database. This package includes all source.

## Changes

1. The Stage 8.10.3 database test already had a `finally` / `prisma.$disconnect()` block. It now disables the application's recurring DB keepalive before importing Prisma, and the keepalive timer itself is `unref()`ed so a finished CLI test can exit naturally.
2. The Dating voice endpoints now explicitly require an authenticated Dating ContextSpace before delegating to shared upload/poll handlers. Shared job retrieval independently checks the exact user and ContextSpace.
3. Browser recorder MIME metadata is forwarded with each upload chunk. Safari MP4 recordings are sent to Whisper as `.mp4` instead of being incorrectly labeled WebM. Unknown and changing MIME types are rejected.
4. Added isolated automated Whisper request/response tests with a fake network response, plus route-wiring assertions and a real-browser smoke-test checklist. No actual microphone or external OpenAI call occurs in automated tests.
5. Added a non-mutating security audit collector that captures full and `--omit=dev` npm advisory reports and exact locked versions under local, gitignored `security-reports/`. It never applies an automatic dependency upgrade.

## Install and automated checks on Mac

```bash
npm ci
npx prisma generate
npx prisma migrate status
npm run check:stage8.10.4:voice
npm run check:stage8.10.3:db
npm run check
npm run build
```

The database test expects `DATING_TEST_USER_ID`, `DATING_TEST_CONTEXT_SPACE_ID`, and `ALLOW_DATING_DEV_DB_TEST=YES` exported as before. Run only against your development database. It should now exit without Ctrl+C. The test fixtures are still scoped and cleaned up by their generated IDs.

## Real browser/microphone smoke test (requires your Mac and OpenAI credentials)

1. Run `npm run dev`. Sign in, select the Dating ContextSpace, and open an existing test Introduction.
2. Open **Private reflection** and select the respondent. Click record; allow microphone access; speak a short nonsensitive sentence for 5-10 seconds; stop. Do not use someone else's private recording for this test.
3. Confirm a transcript appears inside the textbox without an upload error. Check that words actually match your voice. Repeat once on Safari if you use Safari because it often chooses MP4.
4. Leave **share with other** unchecked, confirm consent, and submit. Confirm the reviewed proposal appears and approval produces only one Outcome. If testing another person's account, don't treat this single response as their agreement.
5. With an account in a non-Dating ContextSpace, send a request to `/dating/api/transcribe-result?jobId=unused`: it must return 403. When signed out, the same endpoint should redirect to sign-in.
6. Optional advanced ownership check: capture your own job ID during a recording, then try polling it from a different account or ContextSpace. It must not reveal transcript content. Do not share real transcript or session cookies in bug reports.
7. If recording fails, inspect the browser Network tab for `/dating/api/upload-chunk` and `/dating/api/transcribe-result` responses, checking for 403, 413, 415, 500 or 404. The async in-memory job map is per server instance, so multi-instance deployments need shared jobs before pilot scale.

These browser tests are NOT replaced by green automated tests; they exercise microphone permission, media encoding, app sessions, OpenAI API access and UI persistence.

## Dependency audit

Run **on your Mac** with access to the npm registry:

```bash
npm run audit:stage8.10.4
cat security-reports/README.md
npm audit
npm audit --omit=dev
```

A network-restricted packaging environment could not reach `registry.npmjs.org`, so no new whole-project vulnerability counts or safe auto-upgrade can be certified here. Do not equate `--omit=dev` results with production exposure, because this app builds a SvelteKit server.

**Confirmed lockfile triage:** `@sveltejs/kit` is pinned to `2.39.1`. The public 2026 advisory GHSA-29g2-3rmr-qm68 affects versions up to `2.70.1` and is fixed in `2.70.2` (malicious Accept header CPU exhaustion, subject to deployment header limits). The separate adapter-node BODY_SIZE_LIMIT bypass (CVE-2026-40073) affects SvelteKit versions below `2.57.1`. Both version-range checks flag this lockfile. Review the precise advisory and deployment conditions, then perform a *targeted* framework upgrade and re-run `npm ci`, SvelteKit checks, build, login, custody and Dating integration tests. Don't use `npm audit fix --force` indiscriminately. No dependency version has been silently changed in this release.

Advisory URLs:
- https://github.com/advisories/GHSA-29g2-3rmr-qm68
- https://advisories.gitlab.com/npm/%40sveltejs/kit/CVE-2026-40073/

This completes a **test harness and initial advisory triage**, not a live microphone verification or a full successful npm audit. Keep the pilot gate open until the browser checks and dependency review are completed.
