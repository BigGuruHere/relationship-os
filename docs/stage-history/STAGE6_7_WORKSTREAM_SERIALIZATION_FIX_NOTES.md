# Stage 6.7 Workstream Serialization Fix

Fixes the SvelteKit error when opening a workstream page:

> Cannot stringify a function (data.labels.contactAttemptStatusLabel)

The workstream page server load was returning label helper functions in `data.labels`. SvelteKit server load data must be serializable, so this patch removes the functions from the returned page data.

No Prisma migration is required.
