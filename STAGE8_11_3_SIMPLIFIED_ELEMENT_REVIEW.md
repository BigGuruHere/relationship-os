# Stage 8.11.3 - Simplified Element Confirmation

Changes six-section Dating review selection to **Confirm**, **Reject**, **Not sure yet**. The server compares each confirmed section to the original proposed section. Unedited confirmation is stored as `CONFIRMED`; edited confirmation is stored as `CORRECTED` automatically. The original AI proposal remains preserved separately; corrected values and decisions remain in the encrypted reviewed artifact.

Changing structured desire/Outcome fields counts as a correction even if summary text is unchanged. Reject/defer still strip unapproved content from the reviewed artifact. The whole-Outcome confirmation remains an independent gate for Outcome creation; none of these decisions grants disclosure permission or mutual confirmation. Previously stored `CORRECTED` decisions remain readable, and the server accepts the previous form value with validation for compatibility.

There are **no Prisma changes, new migrations or dependency updates**. The Stage 8.11.2 lockfile is retained for macOS Catalina. The database test is unchanged.

## Install on Mac
Preserve `.env` and local edits before replacing the project source, then run:

```bash
cd ~/Coding/RelationshipOS/relationship-os
npm ci
npx prisma generate
npx prisma migrate status
npm run check:stage8.11.3
npm run check:stage8.11.2
npm run check:stage8.11.1
npm run check:stage8.10
npm run check:stage8.10.4:voice
npm run check
npm run build
```

If installing on Windows use PowerShell and the existing equivalent commands. If Prisma asks to reset, decline. For the database integration test, verify `.env` points at development then run:

```bash
export DATING_TEST_USER_ID='69335c81-f1b0-4383-96aa-99007d622516'
export DATING_TEST_CONTEXT_SPACE_ID='32e74f61-4249-4768-b524-8c9a24bc3fd9'
export ALLOW_DATING_DEV_DB_TEST=YES
npm run check:stage8.10.3:db
```

## Browser acceptance
Open a pending Dating reflection. Edit one summary and select **Confirm**; select **Confirm** on an unchanged summary. Reject an inference about the other person, defer another section, and independently Confirm the whole Outcome with a changed status or continuation flag. Save, reopen and verify the edited item is recorded as corrected, unchanged item confirmed, rejected/deferred sections excluded and one Outcome created. On another review leave the whole Outcome unconfirmed and verify no Outcome is created. Confirm no disclosure or mutual-agreement implication is shown.

Dependency security updates remain deferred until a supported build environment is available.
