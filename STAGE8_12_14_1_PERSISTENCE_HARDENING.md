# Stage 8.12.14.1 - Persisted Living Understanding hardening

This patch closes issues found by the first real Stage 8.12.14 save attempt.

- Audits the four new direct ContextSpace models and adds them to the central Prisma custody allowlist.
- Updates the Stage 8.6 guard counts from 53 to 57 only after that explicit audit.
- Adds a post-8.12.14 corrective migration that aligns seven PostgreSQL-truncated index names with Prisma's canonical names. The original applied migration is not edited.
- Re-authorises every private source inside the same transaction that writes the authoritative revision.
- Keeps production save failures generic, while development shows a bounded safe diagnostic and logs the same diagnostic without source text or encrypted payloads.
- Adds an opt-in development DB integration check covering authoritative save, provenance, decryption/readback, idempotent re-save, transaction rollback and cleanup.

No embedding storage or matching permission is added. Authoritative Living Understanding remains encrypted text and source provenance.
