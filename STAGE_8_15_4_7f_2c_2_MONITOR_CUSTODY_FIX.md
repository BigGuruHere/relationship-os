# Stage 8.15.4.7f.2c.2 - Dorian Conversation Monitor Same-Owner Custody Fix

## Cause
The monitor called `runWithCrossOwnerWorkspaceCustody()` for every NetworkDorianSession. This function deliberately rejects calls where source and target share the same owner. Some sessions belong to the operator, so the route threw HTTP 500.

## Change
The monitor uses `runWithWorkspaceCustody()` for records with the operator's own User ID. For genuinely different User IDs it continues to use `runWithCrossOwnerWorkspaceCustody()` with the existing `PILOT_PHONE_REVIEW` reason. The Contact query continues to use `id` plus the explicit participant User, ContextSpace and linked User constraints.

## Install
Back up your project and extract this overlay into `C:\Users\teren\Coding\RelationshipOS`, replacing the one matching TypeScript file.

## Validate
1. Run `npm run check`.
2. Open `http://localhost:8080/general/admin/dorian-conversations`.
3. Verify own-account sessions and permitted provisional-participant sessions show without HTTP 500.
4. Verify the detail view opens, and check the participant/custody associations. Do not assume operator authorisation is fully verified solely because the page loads.

## Migration
No database migration. No local build required.

## Limitations
This is a targeted code correction, not a live-tested deployment. The read-only pilot operator permissions and overall monitor query coverage still require end-to-end checks.
