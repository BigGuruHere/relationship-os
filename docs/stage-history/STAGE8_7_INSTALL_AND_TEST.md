# Stage 8.7 - Install and Test

Stage 8.7 is code-only. It does not add or modify a Prisma migration.

## 1. Replace source

Replace the previous Stage 8.6 v5 source with the Stage 8.7 package.

Do not delete or modify either applied Stage 8.6 migration.

## 2. Confirm migration state

```powershell
# Stage 8.7 has no migration. This should report the existing database as up to date.
npx prisma migrate status
```

If Prisma reports unexpected drift or asks for a new migration, stop and inspect the output. Do not create an ad-hoc migration for Stage 8.7.

## 3. Prisma validation/client

```powershell
# Schema is unchanged, but these are safe verification steps after replacing the package.
npx prisma validate
npx prisma generate
```

## 4. Source behavioural tests

```powershell
npm test
```

Expected Stage 8.7 package baseline:

```text
130 passed
0 failed
```

## 5. Re-run Stage 8.6 database custody verification

```powershell
npm run check:stage8.6
```

This proves 8.7 did not weaken the ContextSpace database boundary.

## 6. Run Stage 8.7 real database verification

```powershell
npm run check:stage8.7
```

Expected final lines include:

```text
PASS: Stage 8.7 direct cross-owner reads/writes and nested custody impersonation fail closed.
PASS: Named cross-owner and external ingress boundaries enter only the explicit target and restore custody afterward.
PASS: Legacy compatibility destinations fail closed as soon as an owner has more than one ContextSpace.
PASS: Stage 8.7 temporary verification rows were removed.
```

## 7. Re-run the Stage 8.6 mutation proof

Stage 8.7 changes the custody runtime directly, so re-run the existing transactional trigger mutation check as a cheap regression gate:

```powershell
# IT: opt in only for the transactional mutation verification.
$env:ALLOW_STAGE86_MUTATION_TEST="true"
npm run check:stage8.6:mutation
Remove-Item Env:\ALLOW_STAGE86_MUTATION_TEST
```

## 8. Svelte/TypeScript check

```powershell
npm run check
```

## 9. GUI regression test

```powershell
npm run dev
```

Test normal Workspace surfaces first:

- Contacts
- Companies
- Deals
- Projects/Tasks
- Wants/Offers
- interactions/notes
- one agent run
- search

Then test the Stage 8.7-specific public flows where practical:

### Public profile as a logged-in second account

If you have a second test account:

1. Log in as account B.
2. Open account A's public profile.
3. Confirm the page loads without a custody error.
4. Click Connect.
5. Confirm account B gets account A as a Contact.
6. Log in as account A and confirm account B appears as a Contact.
7. Reload the public profile as B and confirm it shows the already-connected state.

### Public lead capture

1. Open your public profile/lead page in an incognito window.
2. Submit a clearly identifiable test name/email/phone.
3. Confirm the thank-you redirect.
4. Log into the Workspace and confirm the Contact/Lead was captured.
5. Remove the test record if appropriate.

The real `check:stage8.7` script covers the cross-owner mechanics even if a second GUI account is not convenient.

Do not use an account with a durable second ContextSpace as the destination for these public-flow GUI checks. Stage 8.7 intentionally fails those compatibility flows closed once the destination has more than one ContextSpace. Use a separate single-space test account for multi-context experiments versus public-ingress regression tests.

## 10. Production deployment

Stage 8.7 adds no migration.

If production has not yet received Stage 8.6, the normal production deploy should still apply the two existing 8.6 migrations in order through:

```powershell
npx prisma migrate deploy
```

If production is already fully migrated through 8.6, `prisma migrate deploy` should have nothing new to apply for Stage 8.7.

Then deploy the Stage 8.7 application code normally.

## Stop conditions

Stop and inspect rather than forcing forward if any of these occur:

- Prisma reports drift,
- Prisma asks to create a migration,
- a reset is requested,
- `check:stage8.6` fails,
- `check:stage8.7` fails,
- public-profile load/connect reports a custody exception,
- public lead capture reports a custody exception.
