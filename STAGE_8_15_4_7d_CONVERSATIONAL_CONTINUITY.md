# Stage 8.15.4.7d - Telephone conversational continuity (pilot increment)

## Purpose
Make first-call and returning-call greetings more accurate without assuming that caller ID authenticates a person. This is a limited, pilot-ready increment, not the full conversational-memory and account-claim design.

## Implementation
- `src/lib/server/integrations/elevenlabs/phoneOnboarding.ts` now counts previously imported `PERSON_CONVERSATION_SOURCE` interactions scoped to the provisional caller's own User, Contact and ContextSpace. Merely starting a session no longer makes a caller "returning".
- Keeps distinct first-time versus returning first-message overrides and provides guarded, natural conversational instructions.
- Keeps `user_name`, `last_call_summary` and `memory_and_identity_context` empty for provisional telephone callers. Caller ID must not disclose past conversation subjects, Living Understanding or an unverified name.
- No changes to schema, ContextSpace custody, session-token format, post-call ingestion or the deployed ElevenLabs agent settings.
- Adds `npm run check:stage8.15.4.7d` with four source-contract regression tests.

## Installation (Windows PowerShell)
1. Stop the development server. Back up or commit your current source.
2. Extract the ZIP's `relationship-os-master` folder contents into `C:\Users\teren\Coding\RelationshipOS`, replacing matching files. Keep `.env` and newer local-only changes.
3. Database migration: **NO**. No `prisma migrate dev` required.
4. Local production build: **NOT required**.

## Run checks
```powershell
# Verify the new first-call and returning-call source contract.
npm run check:stage8.15.4.7d

# Verify SvelteKit and TypeScript on your installed dependencies.
npm run check

# Optional previous-stage regression checks.
npm run check:stage8.15.4.7c.3
npm run check:stage8.15.4.7c.2
npm run check:stage8.15.4.7c
```

## Live manual acceptance
1. Restart local dev (`npm run dev -- --port 8080`) with the intended DEVELOPMENT webhook routing.
2. From the existing test number, call Dorian after at least one successfully imported interaction. Expected: warm returning greeting, no volunteered private history. Do not assume caller identity.
3. From a second number later tonight, call Dorian for the first time. Expected: introductory greeting and invitation to provide a preferred name. The second number must create a separate provisional caller and ContextSpace.
4. Hang up after a meaningful conversation. Check for signed webhook import and `INITIAL_REVIEW_READY` in the correct participant workspace.
5. Call the second number again after post-call import. Expected: returning greeting.
6. If a call ends before transcript import, the next greeting should remain first-time unless another participant evidence interaction was imported.
7. Run `check:stage8.15.4.7c.3:db` with explicit DEVELOPMENT-only test guards from the previous stage to verify two-caller isolation.

## Tested here
- Stage 8.15.4.7d source-contract tests: 4 passed, 0 failed.
- Earlier 8.15.4.7c, 7c.2, 7c.3 structural suites: 17 passed, 0 failed.
- `npm run check`: NOT RUN here, because dependencies are not installed in the packaging environment.
- Live signed webhooks, cross-caller end-to-end isolation and real Neon tests: NOT RUN here.

## Limitations and upcoming work
- This release improves greetings, **not** sensitive long-term memory recall for phone-only callers. The full authorisation and account-claim policy remains for Stage 8.15.4.7e / post-pilot identity review.
- Prior imported conversation evidence is used as a continuity count, not a quality assessment. One imported conversation source counts as one previous conversation.
- The live two-number isolation test, session replay and signed-webhook idempotency remain acceptance gates before inviting pilot participants.
- `CALLED_NUMBER_NOT_BOUND` still needs an explicit telephone deployment binding if future routing requires it.
- No automated source check proves the ElevenLabs `first_message` override is honoured by its deployed configuration. Verify by calling.
