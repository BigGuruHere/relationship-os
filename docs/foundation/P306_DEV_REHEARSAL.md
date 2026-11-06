# P-306 hosted DEV rehearsal

P-305 merged into development at `de9a875`. On 2026-11-06 the operator reported matching aggregate counts from Neon development and a separate snapshot restore. This verifies the first comparison, not hosted data erasure or the full invited rollout.

| Aggregate | DEV | Restored |
|---|---:|---:|
| Foundation tables | 15 | 15 |
| Enrollments / vaults | 0 / 0 | 0 / 0 |
| Users | 9 | 9 |
| Contacts | 29 | 29 |
| Interactions | 128 | 128 |
| Applied / unfinished migrations | 107 / 0 | 107 / 0 |

## DEV smoke record

On 2026-11-07 the operator reported the existing Railway DEV experience worked after being asked to smoke-test login, My People, note save/reopen and profile QR. The exact running commit and individual device/provider results were not recorded. There was no enrolled account in the reported DEV baseline, so this is existing-account regression evidence. The synthetic hosted seed returned an unclassified error and hosted erasure/replay was deferred before suspension. Resume by confirming the synthetic case and its state on the isolated copy before any erase. This does not close the live foundation, privacy or rollout gates.

## Create the synthetic fixture

Run from the rehearsal branch in a separate local checkout on Node 22, with dependencies installed using `npm ci`. Select the already verified restored branch in Neon. Copy its **direct** connection string to a protected environment file outside the repository. Record the direct host and database path of the original Neon development branch separately. The commands verify both targets before touching the database. Keep both Railway services pointed at their existing databases.

For example, use `~/.relish-rehearsal/clone.env` inside a directory accessible only to you. Set file permissions to 0600. Use the following entries, replacing the example values locally.

```dotenv
# Connection string from the restored branch's Connect panel.
DATABASE_URL=postgresql://ROLE:PASSWORD@RESTORED_HOST/neondb?sslmode=require
# Exact host and database path from the restored branch.
P305_EXPECTED_TARGET=RESTORED_HOST/neondb
# Direct host and database path from the original development branch.
P306_SOURCE_TARGET=ORIGINAL_DEV_HOST/neondb
DB_KEEPALIVE_ENABLED=NO
```

Append a new throwaway encryption key for this fixture once. The same key must be available for both restored copies. It is independent of the DEV application's encryption key. The rehearsal reads only the synthetic vault created with this key.

```sh
# Create a separate encryption key in the protected file without printing it.
printf 'SECRET_MASTER_KEY=%s\n' "$(openssl rand -hex 32)" >> "$HOME/.relish-rehearsal/clone.env"

# Use this file rather than any previously exported database settings.
unset DATABASE_URL SECRET_MASTER_KEY P305_EXPECTED_TARGET P306_SOURCE_TARGET

# Choose a unique case and seed one synthetic account on the restored branch.
p306_env="$HOME/.relish-rehearsal/clone.env"
p306_case="$(uuidgen | tr '[:upper:]' '[:lower:]')"
p306_account="p306-$p306_case"
P306_CONFIRM="seed:$p306_case" node --env-file="$p306_env" --import tsx scripts/foundation-restore-rehearsal.ts seed "$p306_case"
```

The command creates a fresh account with no login credential, session or public profile. It prepares a private vault and writes two versions of one fixed synthetic note through the existing guarded repositories. It leaves the enrollment PREPARED. Expected output is `verified: prepared`, `enrollment: PREPARED`, `vault: ACTIVE`, two subjects, one source and two versions. Save the generated case UUID. A duplicate case fails before mutating that account. If a new fixture fails partway through, inspect the isolated copy, record the failure and use a new disposable copy and case. Do not try to repair a partial fixture in live DEV.

## Prove erasure and restore replay

1. Suspend the fixture using the existing P-305 operator command. Verify the locked state and both readable versions using the rehearsal command.

   ```sh
   # Suspend only the generated fixture on the restored branch.
   P305_CONFIRM="suspend:$p306_account:$p306_case" node --env-file="$p306_env" --import tsx scripts/foundation-privacy.ts suspend "$p306_case" "$p306_account"
   node --env-file="$p306_env" --import tsx scripts/foundation-restore-rehearsal.ts verify "$p306_case" suspended
   ```

2. Take a snapshot **of the rehearsal branch after suspension and before erasure**. Record its branch and timestamp. Erase the fixture on the rehearsal branch, then verify the empty locked routing record.

   ```sh
   # Erase the approved synthetic vault and check that all collections are empty.
   P305_CONFIRM="erase:$p306_account:$p306_case" node --env-file="$p306_env" --import tsx scripts/foundation-privacy.ts erase "$p306_case" "$p306_account"
   node --env-file="$p306_env" --import tsx scripts/foundation-restore-rehearsal.ts verify "$p306_case" erased
   ```

3. Multi-step restore the pre-erasure snapshot to a **second separate Neon branch**. Prepare a second protected environment file with the same throwaway key and original DEV source, then replace only the connection URL and expected target with those of the second branch. Run `verify "$p306_case" suspended` there to prove both exact versions were restored. Replay the approved erase on the second branch and run `verify "$p306_case" erased` again.
4. Record the branch names, snapshot timestamps and safe JSON outcomes. Compare aggregate counts with the reported baseline. The synthetic account increases Users by one on the copies where it exists. Contacts and Interactions should be unchanged in this rehearsal. Handle disposable branch, snapshot and key cleanup under the runbook and approved retention schedule. Keep connections and settings on their original branches.

The staged hosted rehearsal uses only synthetic writes on isolated copies. It does not stand in for phone or browser acceptance, exact Railway DEV commit verification, handling of legacy and provider records, or an invited cohort decision. Those checks and the [P-305 closure and retention requirements](P305_PRIVACY_OPERATIONS.md) remain gates. Production remains deferred. No Prisma migration is required.
