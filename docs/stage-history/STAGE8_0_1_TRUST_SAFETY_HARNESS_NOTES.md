# Stage 8.0.1 - Relish Trust Safety Harness

## Purpose

Stage 8.0.1 adds a deliberately small safety harness before Stage 8.1 changes identity and Core access boundaries. It does not change the Prisma schema and does not migrate data.

## Runtime safety fixes

1. Research candidates must be `APPROVED` before `Import to CRM` can promote them into Contact/Company records.
2. Contact/company enrichment rows must be `APPROVED` before `Apply to CRM` can modify canonical CRM data.
3. Field-level enrichment contact creation only reads other `APPROVED` rows from the same enrichment group, user, and agent run. Rejected or still-proposed sibling fields are not silently promoted with an approved field.
4. The UI only shows promotion buttons when the staged record is approved. Server-side checks remain authoritative.

## Safety seams introduced

- `src/lib/server/agents/stagingPolicy.ts` contains pure, testable tenant/approval predicates.
- `src/lib/server/agents/stagingRepository.ts` centralises tenant + agent-run scoped staging lookups.
- `src/lib/server/agents/approvalPolicy.ts` centralises the fail-closed tool approval decision used by `toolRegistry.ts`.

These are intentionally small. They are not the full Stage 8.1 Core repository abstraction.

## Tests

The project now has a zero-new-dependency core test command using the existing `tsx` dev dependency and Node's built-in test runner:

```bash
npm test
```

Coverage added:

- AES-GCM encryption/decryption round trip.
- Fresh-IV behaviour for repeated plaintext.
- Deterministic index normalisation.
- HMAC scope separation.
- Tamper detection and AAD mismatch failure.
- Tenant/run ownership predicate for staging records.
- Only `APPROVED` staging records may cross into canonical CRM data.
- Grouped enrichment assembly only includes approved sibling rows.
- Tool approval policy fails closed if any policy layer requires approval.

## Database

No Prisma schema change and no migration.

Do not run `prisma migrate dev` specifically for Stage 8.0.1.

## Suggested manual smoke test

1. Start Relish normally.
2. Open an agent run containing a proposed Research Candidate.
3. Confirm `Import to CRM` is not available until the candidate is approved.
4. Approve it, then import it and confirm the Contact/Company is created.
5. Open a proposed Contact Enrichment row.
6. Confirm `Apply to CRM` is not available until approved.
7. Approve and apply it, then verify the intended field changes.
8. Run `npm test` and confirm all core safety tests pass.
