# P-306 foundation test login on Railway DEV

The operator already confirmed the existing account smoke test on DEV. This slice makes the new foundation accessible to one fresh internal test login through the existing Account permissions page. It does not activate an existing account or change any existing storage path. It needs no Prisma migration.

## DEV setup

After merging and verifying the Railway DEV deployment:

1. In Neon, select the original **development** database used by Railway DEV. In its connection details, copy just the database host and database name, joined with a slash. Use the DEV database, rather than the snapshot restore branch. For example, the setting value might look like `ep-example.neon.tech/neondb`. The direct host is accepted when Railway uses the corresponding Neon pooled host. Keep the username, password and complete connection string out of the setting.
2. Add `RELISH_DEV_FOUNDATION_PILOT_TARGET` with that value to the **Railway DEV service variables**. Apply the DEV variable change. The server requires the canonical DEV origin and an exact match to the configured database target. It fails closed if either check fails.
3. Sign in as your existing system owner on DEV and open **Manage users** at `/settings/users`. In **Foundation test account**, enter a temporary password of at least 16 characters and choose **Create test account**. The page displays the generated `@example.invalid` sign-in email. There is one test login per database and email delivery is not used.
4. Keep the owner browser open. In a private window, sign in normally with the generated email and the password you chose. The test profile starts unpublished. Your existing owner account continues to use its existing People storage.

The control requires the existing owner role, a same-origin submission and a fresh owner check in the write transaction. A database lock serializes concurrent creation attempts. The new member account, Argon2id password hash, encrypted email, unpublished profile, private vault, self subject and ACTIVE enrollment commit together. There is no intermediate login or account link to legacy People data. No role, account ID or email is accepted from the creation form. Existing sign-in and owner-only account permissions remain in force.

If the control is missing, check the deployed DEV commit, the DEV hostname, the owner role and the expected host/database value. If the password is lost, use an approved operator recovery procedure rather than trying to convert an existing user. Removing the setting hides the creation control. The test account remains in its existing lifecycle state.

## Automated evidence

Sixteen focused checks passed locally, including the real password login, unpublished profile, public exchange, private note retrieval and archive, owner and target denials, duplicate submissions and rollback. Svelte reported zero errors and warnings. The older navigation source assertion in `stage8-15-4-2b-user-admin.test.mjs` also fails on the unchanged base and was left untouched. The Foundation database workflow runs the new suite on Node 22.

## Phone acceptance

Use synthetic information only.

1. From the test login, open My Profiles and publish the test card. Show its QR code on one device. On your phone, scan from a browser without the test login, save the contact and send synthetic details.
2. In the test account, open My People. Confirm the received person appears once. Record and review a short voice note, save it, refresh the page and reopen the note. Archive the person and confirm the person and history disappear from My People.
3. In the original owner session, confirm the test contact and note are absent. Keep the real device/browser and provider outcomes in the release record.
4. After the smoke test, unpublish the test card. For a foundation access stop, use the separate P-305 approved suspension procedure. Do not change the test account back to legacy People storage.

The browser test is one part of P-306. Live Google/device/provider checks, full closure and retention handling, the hosted erase/replay rehearsal and a cohort decision remain gates before inviting real users. Production remains deferred.
