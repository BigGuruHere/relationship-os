# Stage 8.0 - Retirement Register

This register is a forcing function. Every temporary bridge or replaced domain model must have a named retirement condition.

| Existing structure | Future authority | First change | Stop old writes | Removal target | Acceptance criteria |
|---|---|---|---|---|---|
| `Contact.linkedUserId` as identity bridge | `Person` linked from `User` and `Contact` | 8.1 | After Person-backed connection flows are proven | Named post-8.1 identity cleanup release | Existing reciprocal user connections resolve through Person; no feature depends on linkedUserId as canonical identity; tenant isolation tests pass |
| `ExchangeItem` | Canonical Want/Offer representation decided in 8.3 | 8.3 | 8.3 | 8.3 or immediate follow-up only if migration verification requires split release | All Want/Offer/Lead/Contact/Company/Deal/Project links migrated; no active write path; no UI/service imports; row reconciliation is complete |
| `src/lib/server/exchange.ts` compatibility service | Core intention service | 8.3 | 8.3 | Same retirement window as ExchangeItem | No route/component imports; no compatibility action required |
| duplicated Want/Offer service implementation | shared Core intention infrastructure plus explicit Want/Offer semantics | 8.3 | 8.3 | 8.3 | Shared parsing, validation, provenance, embeddings and linking logic extracted without introducing a third authority |
| direct agent relationship-data Prisma reads | scoped Core repository/data context | 8.1 onward | Per tool/service as migrated | By completion of 8.5 for relationship-data reads | Agent relationship reads cannot express unscoped cross-tenant queries through normal agent API; audit-only DB operations may remain direct |
| undifferentiated confidence-as-authority | explicit provenance/authority + confidence | 8.2 | New Core writes use separate axes from 8.2 | Legacy mapping cleanup after backfill/verification | New important claims/intents distinguish source authority from confidence; old values are preserved/mapped |
| raw private data used for future network embedding | permission-controlled match projection embedding | 8.9 | Network matching never writes raw-private network vectors | Before 9.0 | Network matcher only receives approved projection/vector; private source record cannot be read through network path |
| old Dorian backend as candidate production service | Dorian v2 against Relish Core | None - reference only | Already frozen | No migration required | Old app is not deployed as production system; reusable transport/persona code may be selectively copied later |

## Register rule

Every Stage 8 pull/release that introduces a transitional compatibility path must add or update a row here.

A structure is not considered retired until both code dependencies and data dependencies have been verified.
