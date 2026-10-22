# Stage 8.15.4.7f.2c.1 - Conversation Monitor Contact Query Fix

## Problem
The Conversation Monitor reused a query scope containing `contactId` when querying the Prisma `Contact` model. `Contact` uses `id` instead, so the page raised `PrismaClientValidationError`.

## Correction
The Contact lookup now filters by `id`, `userId`, `contextSpaceId`, and `linkedUserId`. The Interaction and Living Understanding revision source queries continue to use `contactId`, which those models support. The cross-custody boundary has not been relaxed.

## Installation
1. Back up or commit your project.
2. Extract the overlay into your RelationshipOS project root, replacing the matching `src/lib/server/pilotMonitor/conversations.ts` file only.
3. Keep existing `.env` and newer local code.
4. Run `npm run check`.
5. Start the app with `npm run dev -- --port 8080` and open `http://localhost:8080/general/admin/dorian-conversations`.
6. Check that calls load and the detail page links to the correct revision. Do not assume full historical review is verified until checked in UI.

**Prisma migration required:** No. **Local build required:** No.

## Verification
Validated the corrected `Contact` filter against the Prisma model in the supplied baseline source and confirmed the two other queries retain their model-appropriate `contactId` predicates. Full `npm run check` and a live database test were not run in this environment.
