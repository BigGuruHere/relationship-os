# My People — Stage 1

## Delivered behavior

`/people` provides a private, mobile-first directory with search and recent additions. `/people/new` accepts a name and optional phone/email. Saving redirects to `/people/[id]`, where the owner can record or type a note. The recorder uploads audio, retrieves a transcript, allows editing and saves only on explicit submission. The saved text is retrievable in the person's history.

No account, Person identity bridge, connection, matching permission or disclosure permission is created by these actions. Same-name people are allowed. No QR capture, automatic identity resolution, cross-context aggregation or reclassification is implemented.

## Data and custody

The existing Contact and Interaction models are unchanged. A Contact belongs to `userId`; its storage home is `contextSpaceId`. The ContextSpace belongs independently to `ownerUserId`. The existing database owner and reference guards remain intact. Neither owner identity nor custody is inferred from the three production ContextSpace IDs supplied during planning.

New personal Contacts live in an owned `WORKSPACE` with domain `private`. It is created only on the first valid save, has a stable owner-specific UUID for race-safe provisioning, and does not change `User.defaultContextSpaceId` or existing spaces. Private storage is not a relationship classification. Multiple pre-existing private homes fail closed for review.

`/people` and its audio routes resolve to the private route domain. Every detail, note save, upload and poll revalidates the authenticated owner's private home. Existing business/general/dating route mappings are unchanged. Stage 1 deliberately excludes existing Brokerage Contacts from My People while leaving them in their current routes.

Notes retain owner, custody, Contact, timestamp, WORKSPACE source and OWNER_NOTE/OWNER_VOICE_NOTE channel. They are owner observations, not participant-confirmed claims. Admission is always STORED_ONLY and embedding creation is disabled on this flow, regardless of submitted fields. Saving does not change lastContactedAt. A Contact's optional identity links remain null on capture. The full context-scoped Contact/Interaction services remain reusable by a future owner-authorized unified directory.

No Prisma migration is required. No existing rows are migrated, relabeled, merged or deleted.

## Reuse and files

- `core/contacts.ts`: shared validation/basic creation, encrypted display projection and persistence used by the existing CRM creation adapter and participant directory.
- `core/myPeople.ts`: private-home provisioning and authorization.
- `core/contextDomain.ts`: People route custody mapping; no other mappings changed.
- `routes/people/`: directory, creation, detail/history, note-save and audio adapters.
- `recording/ContactNoteForm.svelte`: recorder/form extracted from the existing CRM note screen. Existing Contact and new People routes both use it. Uploads are serialized before finalization; the actual selected WebM/MP4 format is sent. Failures are visible without clearing existing text.
- Existing upload/poll implementations are reused unchanged apart from generic RequestHandler typing for adapters.
- `embeddings_api.ts`: optional client initializes at feature invocation, so build/import no longer requires an unused OpenAI key.
- Root shell links to My People and hides specialised context navigation on that surface.

## Validation

Use only the isolated local development database. The integration runner rejects other database hosts, ports and names, creates two fixture users, and removes only its own fixtures. It fingerprints pre-existing local Contacts and Interactions and also verifies a legacy Contact/history fixture remains unchanged.

With the provided development variables available:

```sh
export PATH=/workspace/.cloud-tools/node_modules/node/bin:$PATH
export DATABASE_URL=postgresql://agent@127.0.0.1:5432/relish_local
npm run check
npm test
npm run build
```

Start a separate local test instance of the latest build:

```sh
HOST=127.0.0.1 PORT=5175 ORIGIN=http://127.0.0.1:5175 RELISH_CONTROL_PLANE_ENABLED=NO RELISH_PHONE_AUTO_LU=NO node build/index.js
```

Then run `node scripts/check-my-people.mjs` from the repository in another terminal with the same local database environment. It exercises authentication, forged custody input, cross-owner denial, legacy Contact/Brokerage creation, same-name people, concurrency, private note persistence and real shared transcription handlers with an offline provider mock. Its Python Playwright check uses Chromium, a fake microphone and intercepted local transcription responses to test the mobile recording/edit/save/retrieve flow. This environment provides Python Playwright and `/usr/bin/chromium`; these are test prerequisites, not application dependencies.

The two existing source assertions that inspect the extracted note form now inspect the shared component. Existing 50 unrelated assertion failures remain tracked; no security assertions were relaxed.

## Results in the isolated Codex database

- Type check: 0 errors, 0 warnings.
- Production build: passed without an OpenAI key.
- Full suite: 865 tests, 815 passed and the same 50 pre-existing failures. Failure names were compared with the saved baseline; no new failing tests.
- Local integration: 14 checks passed, including database-enforced ownership/reference rejection and Chromium mobile capture/edit/save/retrieval. Transcription was mocked; no external provider was contacted.
- No schema, migration, dependency manifest or lockfile changes.

## Changed file inventory

```text
src/lib/embeddings_api.ts
src/lib/server/core/contextDomain.ts
src/lib/server/core/contacts.ts
src/lib/server/core/myPeople.ts
src/lib/server/core/participantDirectory.ts
src/lib/recording/ContactNoteForm.svelte
src/routes/+layout.svelte
src/routes/api/upload-chunk/+server.ts
src/routes/api/transcribe-result/+server.ts
src/routes/contacts/new/+page.server.ts
src/routes/contacts/[id]/interactions/new/+page.svelte
src/routes/people/+page.server.ts
src/routes/people/+page.svelte
src/routes/people/new/+page.server.ts
src/routes/people/new/+page.svelte
src/routes/people/[id]/+page.server.ts
src/routes/people/[id]/+page.svelte
src/routes/people/[id]/notes/new/+page.server.ts
src/routes/people/[id]/notes/new/+page.svelte
src/routes/people/api/upload-chunk/+server.ts
src/routes/people/api/transcribe-result/+server.ts
tests/core/my-people.test.ts
tests/core/stage8-14-0-2-build-health.test.mjs
tests/core/stage8-15-3-3-source-admission.test.mjs
scripts/check-my-people.mjs
scripts/check-my-people-browser.py
docs/MY_PEOPLE_STAGE_1.md
```

## Limits

- Real transcription requires a securely configured transcription provider key and permission to send the audio to that provider. No external provider was called during these checks.
- Existing transcription jobs are process-local and one-shot; an instance restart or a lost completed response can require rerecording. Use a single instance for the pilot. Durable job storage is separate work.
- Audio is temporarily assembled on disk by the existing implementation and cleaned up after processing; abandoned assemblies use existing best-effort cleanup.
- The owner may edit the transcript before saving. Post-save corrections are not exposed in this initial People screen; original CRM correction functionality remains intact.
- Directory search decrypts the current owner's private-home records on the server. Indexed search/pagination can be added when the private directory grows.
- No production access, deployment, external configuration update or database reset was performed.
