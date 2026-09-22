# Stage 8.9 - Multi-App ContextSpace Boundary

## Outcome

Stage 8.9 turns the existing ContextSpace custody foundation into an explicit Business and Dating application boundary.

## Delivered

- Added extensible `ContextSpace.domainKey` with existing spaces backfilled as `business`.
- Added encrypted `ContextSpace.displayNameEnc` for user-visible application-space identity.
- Added server-owned pathname-to-domain resolution.
- Added an HTTP-only ContextSpace preference cookie whose value is revalidated by owner and domain on every request.
- Added controlled Dating ContextSpace creation and an application-space management page.
- Added a boundary-only `/dating` landing page without Dating profile or matching functionality.
- Kept all existing Business routes bound to the Business domain.
- Added `AgentDefinition.allowedDomainKeys` and `allowedContextSpaceIds`.
- Backfilled and maintained existing built-in agents as Business-only.
- Enforced agent deployment at run start, relationship-data projection, and tool execution.
- Added `AgentRun.auditDataClass` with a `sensitive` metadata-only audit contract.
- Redacted sensitive AgentRun, AgentStep, AgentToolCall, ModelInvocation, ApprovalRequest, and AgentArtifact JSON audit content.
- Corrected new Interaction summary encryption to use `interaction.summary` while retaining legacy `interaction.raw_text` read compatibility.
- Established `src/apps/business` and `src/apps/dating` module-direction documentation without a cosmetic file move.

## Migration

`20260922100000_stage8_9_multi_app_context_boundary`

The migration is additive. It does not move, duplicate, delete, or rewrite existing contextual records.

## Data and privacy

- Existing ContextSpaces become Business ContextSpaces in place.
- A Dating ContextSpace begins empty.
- Selecting a Dating route never falls back to Business custody.
- Existing private embeddings remain in their original Business ContextSpace.
- Sensitive agent JSON contains structural metadata only. Protected content must be stored in encrypted source, staging, or artifact fields.

## Out of scope

- Dating participant profiles
- Voice feedback collection
- IntroductionFeedback
- Consent and DisclosureGrant models
- Cross-person matching
- Network-safe embeddings

These remain sequenced in the canonical roadmap.
