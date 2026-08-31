# Stage 8.0 - Retirement Register

This register is a forcing function. Every temporary bridge or replaced domain model must have a named retirement condition.

| Existing structure | Future authority | First change | Stop old writes | Removal target | Acceptance criteria |
|---|---|---|---|---|---|
| `Contact.linkedUserId` as identity bridge | `Person` linked from `User` and `Contact` | 8.1 | After Person-backed connection flows are proven | Named post-8.1 identity cleanup release | Existing reciprocal user connections resolve through Person; no feature depends on linkedUserId as canonical identity; tenant isolation tests pass |
| `ExchangeItem` | Canonical `Want` + `Offer` | 8.3 | **Completed 8.3** | **Completed 8.3** | Migration repairs/verifies every legacy row, MarketLead link, and explicit Task source before atomic table retirement |
| `src/lib/server/exchange.ts` compatibility service | `intentCommon.ts` + canonical Want/Offer services | 8.3 | **Completed 8.3** | **Completed 8.3** | Compatibility service and old ExchangeItemsPanel/browser helper removed; entity routes call Offer directly |
| duplicated Want/Offer service implementation | shared Core intent infrastructure plus explicit Want/Offer semantics | 8.3 | **Completed 8.3 for common plumbing** | Ongoing refinement only, no duplicate authority | Shared lifecycle/options, parsing, money validation, legacy decrypt fallback, embeddings and link/unlink plumbing live in common intent modules; Want/Offer remain canonical |
| direct agent relationship-data Prisma reads | scoped Core repository/data context | 8.1 onward | **Completed for built-in entity reads in 8.5.2** | Continue as new Core surfaces migrate | Canonical agent entity reads use tenant-scoped repository predicates and policy-built selects; audit/run bookkeeping may remain direct |
| `read_entity_context` broad-read + `filterEntityContextForAgentPolicy` post-query filtering | policy-built pre-query Core entity projection behind the compatibility tool key | 8.5.2 | **Completed 8.5.2** | **Post-query filter removed 8.5.2** | `filterEntityContextForAgentPolicy` deleted; built-in agents receive entity context only through pre-query policy selects; behavioural selection tests and real transactional tenant-isolation check pass |
| `userId` as the sole custody predicate for Core knowledge | explicit ownership + `ContextSpace` custody, scoped by `(userId, contextSpaceId)` | Planned 8.6 | Stop sole-user custody reads during 8.6 cutover | 8.6 foundation completion | Every existing User has one default ContextSpace; Core custody-scoped reads require both ids; no second context can silently widen a user-only query |
| undifferentiated confidence-as-authority | explicit provenance/authority + confidence | 8.2 | New Core writes use separate axes from 8.2 | Legacy mapping cleanup after backfill/verification | New important claims/intents distinguish source authority from confidence; old values are preserved/mapped |
| raw private data used for future network embedding | permission-controlled match projection embedding | 8.9 | Network matching never writes raw-private network vectors | Before 9.0 | Network matcher only receives approved projection/vector; private source record cannot be read through network path |
| old Dorian backend as candidate production service | Dorian v2 against Relish Core | None - reference only | Already frozen | No migration required | Old app is not deployed as production system; reusable transport/persona code may be selectively copied later |

## Register rule

Every Stage 8 pull/release that introduces a transitional compatibility path must add or update a row here.

A structure is not considered retired until both code dependencies and data dependencies have been verified.
