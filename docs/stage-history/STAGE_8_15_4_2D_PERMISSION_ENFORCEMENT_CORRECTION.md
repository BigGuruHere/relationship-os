# Stage 8.15.4.2d - Permission Enforcement Correction

## Database migration
**No.** No Prisma schema or migration SQL files changed.

## Changes
- `/settings/context-spaces` now checks `ADMIN` within the server page loader **and** its `createGeneral`, `createDating`, and `select` actions, in addition to existing request-wide policy. Unauthorised signed-in users receive HTTP 403.
- `/general` now checks `OPERATOR` inside its own server loader. Unauthorised signed-in users receive HTTP 403. The member-compatible empty people fallback was removed from this privileged operator page.
- The desktop privileged sidebar now links to Network in Business, Dating, and General workspaces, instead of General only.
- The privileged sidebar only renders Manage spaces for accounts with `ADMIN`.

## Local commands (PowerShell)
```powershell
npm run check:stage8.15.4.2d
npm run check:stage8.15.4.2c
npm run check
```
No `prisma migrate dev` and no local build are needed for this stage.

## UI acceptance test
1. As owner: open `/settings/context-spaces`, `/general`, `/general/people`, `/settings/users` and confirm expected authorised access. In Business, Dating, and General verify desktop Network navigation.
2. As plain member: open `/network`; directly visit `/settings/context-spaces`, `/general`, `/general/people`, `/settings/users`. Each privileged URL should be denied. Attempt to POST all ContextSpace actions and confirm denial.
3. As guest: repeat the plain-member tests, including direct URLs.
4. As member with `ADMIN` only: ContextSpace management allowed, `/general` denied, `/settings/users` denied.
5. As member with `OPERATOR` only: `/general` allowed for their authorised context; ContextSpace management denied.
6. Revoke a grant and refresh: access should cease on subsequent server requests.

## Verification and limitations
- 8.15.4.2d focused source regression checks: four passed.
- 8.15.4.2c prior source checks: three passed.
- These checks inspect source, not live HTTP/database conditions. Live role matrix and Svelte/TypeScript checks were **not run** in this environment.
- Earlier observed guest/member page access has not been reproduced in a live browser here. This change provides route-local defence alongside the already-existing central gate. If the browser still shows protected pages, inspect the active server, user session and actual GET/POST response codes before considering the issue fixed.
- Wider CRM/Business/Dating API tenant-isolation audit remains unfinished. Do not invite external pilot users solely on the strength of these source-level checks.
