# Stage 8.10.1 - Participant Audit Link Fix

## Problem

Saving a Dating reflection reached the final `AgentRunEntity` audit-link step and failed with:

`Unsupported AgentRunEntity entity type: introduction_participant`

The TypeScript agent entity contract supported `introduction_participant`, but the Stage 8.6 PostgreSQL custody allowlist did not.

## Fix

- Added `introduction_participant` to the database allowlist.
- Resolves the participant's `contextSpaceId` directly from `IntroductionParticipant`.
- Retains the existing fail-closed same-ContextSpace comparison.
- Automatically rejects only pending Dating reviews attached to already-failed agent runs from the earlier path.
- Added application cleanup so later failures cannot leave an actionable pending review.
- Added regression coverage for the database guard and cleanup behavior.

## Development install

```bash
npx prisma migrate dev
npx prisma generate
```

Restart the development server and submit the reflection again.
