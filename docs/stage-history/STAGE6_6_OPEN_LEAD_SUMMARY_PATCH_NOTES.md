# Stage 6.6 Open Lead Summary Patch

Small UI/counting patch for the Leads page.

## Changes

- Renames the first lead summary card from `Total` to `Open`.
- Calculates `Open` as active working leads only.
- Excludes `CONVERTED` and `ARCHIVED` leads from the Open count.
- Keeps the `Converted` card visible for now so conversion volume can still be tracked.
- No Prisma migration required.

## Test

1. Open `/leads`.
2. Confirm the first summary card says `Open`.
3. Convert a lead to a contact.
4. Return to `/leads`.
5. Confirm the Open count does not include the converted lead.
6. Confirm the Converted count increases.
