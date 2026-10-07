# Stage 8.10.5 - Controlled Dependency Security Update

**Baseline:** Stage 8.10.4 full source, including voice test, Dating database test and existing migrations. No Prisma schema change. Do not reset the database.

## Honest release state

This package prepares and automates a **controlled compatible update**. Its included lockfile is the original Stage 8.10.4 lockfile, **not a security-patched lockfile**, because this packaging environment cannot resolve registry.npmjs.org. Do not deploy it unchanged and call the audit resolved. The Mac script below regenerates the genuine lockfile using npm and records a report. Repackage/commit both package.json and package-lock.json after checks pass. The posted starting audit is 23 total (16 high) and 5 high under `npm audit --omit=dev`.

## Apply on your Mac with internet access

1. Extract this ZIP to a new folder, copy your existing `.env` from the trusted Mac installation, and confirm the correct development database. Do not overwrite uncommitted modifications.
2. In the project root, run:

```bash
npm ci
npm run check:stage8.10.5
ALLOW_RELISH_DEPENDENCY_UPDATE=YES npm run security:stage8.10.5:update
npm run security:stage8.10.5:verify
```

The update performs `npm update` on the current compatible SvelteKit/Svelte/Vite family, then `npm audit fix` **without** `--force`, regenerates Prisma, and captures full/runtime-only reports. It backs up the previous lockfile under gitignored `security-reports`. If unresolved advisories remain, verification prints them and exits nonzero for any high/critical issue outside the known Prisma chain, and reports Prisma-chain findings for manual review. *A green verifier does not mean zero vulnerabilities if Prisma findings remain.*

3. Run the full acceptance tests:

```bash
npm ci
npx prisma validate
npx prisma generate
npx prisma migrate status
npm run check
npm run build
npm run check:stage8.10.2
npm run check:stage8.10.4:voice
npm run check:stage8.10.5
```

4. Run the real development database test only after confirming `DATABASE_URL` is your development Neon DB. Export your usual test fixture IDs and authorization; do not store them in source control:

```bash
export DATING_TEST_USER_ID='69335c81-f1b0-4383-96aa-99007d622516'
export DATING_TEST_CONTEXT_SPACE_ID='32e74f61-4249-4768-b524-8c9a24bc3fd9'
export ALLOW_DATING_DEV_DB_TEST=YES
npm run check:stage8.10.3:db
```

5. Manually test fresh registration, wrong/correct password, logout, and one Dating voice recording through the live development app. Ensure the login limiter has no regression.
6. Review `git diff -- package.json package-lock.json` and `security-reports/stage8-10-5-*.json` locally. Do not commit `security-reports` or `.env`. If checks pass, commit updated package.json and package-lock.json together. Deploy later using the existing `prisma migrate deploy` procedure (no new migration in this stage).

## Risk register

- SvelteKit, Svelte, Vite and related dev/build tools: apply compatible available updates and retest the server build and app. Being in devDependencies does not prove that a SvelteKit issue cannot affect the deployed SSR app.
- Prisma CLI / `@prisma/config` / `deepmerge-ts` / `effect`: `npm audit fix --force` may propose **downgrading** Prisma 6.16 to 6.12. Do not do so automatically. Investigate newer compatible Prisma maintenance releases, advisory conditions, and a **separately tested** override only if necessary.
- The `--omit=dev` audit may still report Prisma CLI through npm dependency classification. Inspect the actual Railway/Neon build/deploy image to determine which tooling is installed and reachable at runtime.
- Actual framework advisories can change; the post-update local npm audit, not the original count, is the acceptance evidence.

## Existing limitation

The integration test demonstrates Dating persistence, retries and custody against PostgreSQL when run, while the voice unit tests simulate the provider. Browser microphone, OpenAI API and real session behaviour still require a manual smoke test. No forced dependency upgrade or schema migration is bundled.
