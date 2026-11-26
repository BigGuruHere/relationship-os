# Dorian Foundation scenario wording

Agent Management owns the operator-edited greeting, context and instructions for Foundation calls. Dorian's base prompt, personality and voice stay in ElevenLabs. Relish decides whether a call is first, returning or awaiting consent and controls all policy, memory and private data.

Publish shared first and returning copy on the environment's configured browser agent in Agent Management. The telephone agent inherits that copy field by field and can override it in its own published revision. On each agent, the channel-specific fields take precedence over the shared scenario values. Blank fields fall through to the next applicable setting or built-in wording. An explicit server-selected call purpose takes priority over console copy.

The console stores copy in the existing per-agent revisions. Use distinct provider agent IDs for DEV and PROD. In the console, pick a revision in **Compare Foundation scenario wording** to see saved edits and the selected agent's field inheritance with a sample name. Copy an earlier revision into a draft and publish it to restore it. No reset or migration is needed in either repository.

## Enable on DEV

1. Deploy the companion Agent Management change through its usual workflow. Create or select the DEV browser and telephone agents by the IDs already configured in Relish, and publish the desired wording. Put shared settings on the browser agent.
2. On DEV Relish, set `RELISH_FOUNDATION_DORIAN_CONSOLE=YES` alongside the existing `RELISH_CONTROL_PLANE_ENABLED=YES` and its DEV URL, token and refresh settings. The existing background worker synchronises revisions for the configured Foundation agents. It does not issue a remote console request during call setup. If desired, use the existing `scripts/sync-stage8-22-4-dorian-config.ts` operator command to warm the snapshots outside a call.
3. Enable first-message overrides for the relevant ElevenLabs agents. Use `call_instruction` or `call_intention` for the same combined instructions, and `call_context` for the purpose. Keep the existing terms status and acceptance-tool instructions in the phone agent. A blank phone consent greeting uses the agent's own first message.
4. Test the published DEV copy on an app first call, a telephone call awaiting consent, and a returning telephone call. Verify the terms gate prevents memory before acceptance, the post-consent tool returns the normal call guidance, and the processing-only message remains server controlled. Change one phone override, publish it and repeat after the next sync. Compare and restore a prior revision to verify rollback.

If no usable copy is cached, Foundation uses its built-in copy and logs an unavailable snapshot. Unset `RELISH_FOUNDATION_DORIAN_CONSOLE` to return to built-in wording. Publishing a revision controls copy only. It does not move proxy routing or change the existing deployment binding.
