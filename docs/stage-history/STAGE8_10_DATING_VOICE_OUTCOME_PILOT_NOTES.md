# Stage 8.10 - Dating Voice Outcome Pilot

## Outcome

Stage 8.10 adds the first real Dating workflow on the isolated Dating ContextSpace. One selected participant can provide a private voice or typed reflection about an Introduction. Relish transcribes it, creates a provisional structured proposal, and requires human review before creating a whole-Introduction Outcome.

## Architecture decision

No new table is introduced in this stage.

- `Interaction` stores the encrypted source transcript.
- `AgentRun`, `AgentStep`, `ModelInvocation`, and `AgentToolCall` store metadata-only sensitive audit history.
- `AgentArtifact` stores each encrypted provisional or reviewed proposal.
- `ApprovalRequest` is the mandatory review gate.
- `Outcome` is created only after explicit approval.

This deliberately tests the existing Core before deciding whether Stage 8.11 requires a durable `IntroductionFeedback` model.

## Delivered

- Added a Dating dashboard, minimal Dating people directory, and dyadic Introduction creation.
- Added Dating-specific Introduction and reflection routes under `/dating`.
- Reused the voice recording and transcription component with Dating-scoped API endpoints.
- Bound temporary transcription jobs to the exact user and ContextSpace.
- Added one-time removal of completed transcript jobs from process memory.
- Added the Dating Outcome Extractor agent, deployed only to the `dating` domain.
- Limited the extractor to Interactions, Introductions, and Outcomes. Wants, Offers, Knowledge Claims, identity, contact methods, Business records, and matching remain denied.
- Separated personal experience, self-learning, subjective experience of the other person, relationship dynamic, desire to continue, whole-Introduction Outcome, and permission choices.
- Stored model proposals and human-reviewed revisions as encrypted versioned AgentArtifacts.
- Added mandatory approve or reject actions.
- Created an Outcome only from the reviewed whole-Introduction section after approval.
- Disabled Interaction embedding generation for Dating pilot transcripts.

## Privacy boundaries

- The raw transcript is encrypted with the existing Interaction encryption contract.
- Proposal content and evidence excerpts are encrypted in AgentArtifact content.
- Sensitive agent audit fields contain structural metadata rather than transcript or proposal text.
- Disclosure to the other participant defaults to off.
- No automatic matching, knowledge promotion, Want update, Offer update, participant notification, or cross-person disclosure occurs.
- The reflection form requires confirmation of informed processing consent before extraction.

## Migration

Stage 8.10 reuses existing Core and agent tables, but includes one database-function migration. The migration permits `introduction_participant` as an `AgentRunEntity` target while retaining the existing fail-closed ContextSpace validation. No Prisma table or model changes are required.

## Deferred to Stage 8.11

- Separate feedback records for both participants
- Durable five-perspective observation lifecycle
- Mutual-interest handling
- Participant-facing collection links
- Consent and DisclosureGrant models
- Any promotion into Knowledge Claims, Wants, or Offers
