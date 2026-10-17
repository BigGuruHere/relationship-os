# Stage 8.15.4.6b - Dorian legacy integration reconciliation

## Intent
Reuse the proven `ai_app-master` `prepareCallData` orchestration pattern without migrating its storage or its trusted `user_id` webhook authority. One shared ElevenLabs Dorian instance must converse with several authenticated members while Relish remains authoritative for custody and Understanding.

## Migration
**No.** This patch adds a bounded preparation helper and adds launch variables to the existing shared session. There is no database schema or migration modification.

## Source reference and correspondence

| Legacy implementation | Relish implementation | Choice |
|---|---|---|
| `src/utils/initiateUserData.js` prepares dynamic variables, call instruction, previous call count, summary, memory | `src/lib/server/integrations/elevenlabs/networkPreparation.ts` prepares a bounded projection from the authenticated participant's General self-contact, authoritative LU, previous conversations | Adapted |
| `user_id`, `agent_id`, `user_name`, `previous_calls`, `last_call_summary`, `memory_and_identity_context` | Same keys sent in `startSharedNetworkSession`, plus `relish_network_session` | Compatibility; neither `user_id` nor `agent_id` is authorisation |
| Legacy post-call webhook looks up user from returned `user_id` | Existing signed Relish webhook binds post-call transcript to hashed `relish_network_session` and the deployment binding | Legacy custody deliberately **not** copied |
| Legacy user data tools modify profile and preferences mid-call | Existing tool definitions can remain in ElevenLabs but **must be disabled** for this pilot | Deferred until session-authorised server actions exist |
| Legacy memory profile and wants/offers extraction | Current governed Living Understanding and evidence workflow | Keep new system authoritative |
| Legacy first-message choices and telephony routing | Planned separately after custody verification | Not copied into this release |

## Security and limitations
- Launch data derives from the authenticated user, their verified General ContextSpace, and their self-contact only.
- The context includes bounded current authoritative understanding (not drafts), last call summary and count. It must not load the inviter's data.
- The ElevenLabs agent prompt may still contain legacy assumptions or explicit tools; inspect it before a multi-user pilot.
- `user_id` is supplied only for legacy dynamic-variable compatibility. Old write tools must remain disabled. Never use a tool-submitted `user_id` to authorise changes.
- Signed post-call webhook processing is unchanged; a token returned in `conversation_initiation_client_data.dynamic_variables.relish_network_session` is required for shared deployment transcripts.
- The separate ElevenLabs **conversation-initiation webhook** currently returns generic context for the shared deployment, because it has no verified participant session mapping. It must not replace/override the participant-specific launch dynamic variables. Confirm this in live ElevenLabs tests.
- No end-to-end provider, browser, DB, webhook or custody tests were run here. The test scripts are source checks only.

## Local commands
```powershell
npm run check:stage8.15.4.6b
npm run check:stage8.15.4.6a
npm run check:stage8.15.4.6
npm run check
```

## Live acceptance gate (two distinct non-admin accounts)
1. Confirm a registered shared Dorian binding and generic ElevenLabs prompt. Disable legacy write tools.
2. Start an authenticated Network Dorian session as User A. Verify `user_name`, call count, summary and context appear in Dorian appropriately; inspect or log only non-secret variable names (never token values).
3. Repeat as User B. Confirm B never hears or sees A's private context.
4. Complete both conversations and confirm each signed post-call payload includes `relish_network_session` and matches its single `NetworkDorianSession` mapping.
5. Confirm transcripts and their participant evidence attach to the right General ContextSpace. Test a malformed/missing token and ensure no transcript is assigned to the deployment owner.
6. Confirm LU proposals are not automatically authoritative/shareable.
7. Test return visit and no duplicate self-contact.

## Pilot architecture checkpoint
After 3-5 participants: review the Contact compatibility bridge and propose a measured transition to direct User/Person and governed understanding scope, without rewriting the existing LU pipeline prematurely.
