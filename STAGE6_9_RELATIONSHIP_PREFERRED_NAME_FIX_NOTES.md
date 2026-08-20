# Stage 6.9 relationship preferred-name fix

Fixes a runtime error on the company-contact relationship page caused by selecting `preferredNameEnc` on `Contact`. The current schema does not contain that field.

No Prisma migration is required.

Apply over the current Stage 6.9 codebase and run:

```bash
npm run check
npm run build
npm run dev
```
