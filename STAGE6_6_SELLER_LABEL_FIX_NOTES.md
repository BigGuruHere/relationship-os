# Stage 6.6 Seller Label Fix

Fixes a runtime error on `/leads` and project lead panels:

```text
ReferenceError: sellerQualificationStatusLabel is not defined
```

Cause: `src/lib/server/marketLeads.ts` used `sellerQualificationStatusLabel(...)` but did not import it from `$lib/marketLeads`.

No Prisma migration is required.
