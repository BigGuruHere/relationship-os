# Dependency security review

Recorded: 2026-09-24T04:07:57.169Z

## Lockfile versions

- @sveltejs/kit: 2.39.1
- @sveltejs/adapter-node: 5.3.2
- vite: 7.1.5
- prisma: 6.16.1
- @prisma/client: 6.16.1
- @prisma/config: 6.16.1

## full

Reported vulnerabilities: {"info":0,"low":3,"moderate":4,"high":16,"critical":0,"total":23}. Exit code: 1.

## runtime-only

Reported vulnerabilities: {"info":0,"low":0,"moderate":0,"high":5,"critical":0,"total":5}. Exit code: 1.

## Review notes

- `--omit=dev` is a useful comparison, not proof that developer dependencies never ship to production.
- Inspect the affected version, advisory conditions, deployment build, and code paths before deciding urgency.
- No package updates or migrations are performed by this script.
- Do not commit security-reports without reviewing it first; audit output can contain environment details.
