<script lang="ts">
  import { deserialize } from '$app/forms';
  import { onMount } from 'svelte';

  export let action = '';
  export let onFinished: (reference?: string) => void = () => {};
  export let onStarted: () => void = () => {};
  export let disabled = false;

  let session: { endSession: () => Promise<void> } | null = null;
  let activeReference: string | undefined;
  let attempt = 0;
  let state: 'idle' | 'connecting' | 'connected' = 'idle';
  let message = '';

  async function start() {
    if (disabled || state !== 'idle') return;
    const current = ++attempt;
    state = 'connecting';
    message = '';
    let reference: string | undefined;
    let stage = 'token';
    // Log only the stage and Relish's diagnostic reference, never SDK payloads or errors.
    const report = (reason: string) => console.warn('[Relish Dorian voice test]', { stage, reason, reference });
    try {
      const response = await fetch(action || window.location.href, {
        method: 'POST',
        body: new FormData(),
        headers: { 'x-sveltekit-action': 'true', accept: 'application/json' }
      });
      const result = deserialize(await response.text());
      if (current !== attempt) return;
      if ((result.type === 'success' || result.type === 'failure') &&
          typeof result.data?.reference === 'string') reference = result.data.reference;
      if (result.type !== 'success' || typeof result.data?.token !== 'string') {
        message = result.type === 'failure' && typeof result.data?.error === 'string'
          ? result.data.error : 'Could not start the conversation.';
        if (reference) message += ' Reference ' + reference;
        report('token_unavailable');
        state = 'idle';
        return;
      }

      // Let the SDK request the microphone only after the user starts a conversation.
      stage = 'sdk_load';
      const { Conversation } = await import('@elevenlabs/client');
      if (current !== attempt) return;
      stage = 'webrtc';
      const initiation = result.data.initiation as {
        firstMessage: string;
        dynamicVariables: Record<string, string>;
      } | undefined;
      const conversation = await Conversation.startSession({
        conversationToken: result.data.token,
        // The SDK serializes firstMessage as conversation_config_override.agent.first_message.
        ...(initiation ? {
          dynamicVariables: initiation.dynamicVariables,
          overrides: { agent: { firstMessage: initiation.firstMessage } }
        } : {}),
        onError: () => {
          if (current === attempt) report('sdk_error');
        },
        onDisconnect: () => {
          if (current !== attempt) return;
          const connected = state === 'connected';
          if (state === 'connecting') {
            report('disconnected_during_start');
            message = 'Dorian disconnected during setup.' + (reference ? ' Reference ' + reference : '');
          }
          ++attempt;
          session = null;
          state = 'idle';
          if (connected) onFinished(reference);
        }
      });
      if (current !== attempt) {
        await conversation.endSession();
        return;
      }
      session = conversation;
      activeReference = reference;
      state = 'connected';
      onStarted();
    } catch (cause) {
      if (current !== attempt) return;
      const microphoneDenied = cause instanceof DOMException && cause.name === 'NotAllowedError';
      report(microphoneDenied ? 'microphone_permission_denied' : 'start_failed');
      message = microphoneDenied ? 'Allow microphone access and try again.' : 'Could not connect to Dorian.';
      if (reference) message += ' Reference ' + reference;
      state = 'idle';
    }
  }

  async function end(notify = true) {
    // Ignore late callbacks from a connection the user has already ended.
    ++attempt;
    const active = session;
    const reference = activeReference;
    activeReference = undefined;
    session = null;
    try {
      await active?.endSession();
    } catch {
      message = 'The connection ended unexpectedly.';
    } finally {
      state = 'idle';
      if (notify && active) onFinished(reference);
    }
  }

  onMount(() => () => { void end(false); });
</script>

  <p role="status">{state === 'connected' ? 'Connected to Dorian' : state === 'connecting' ? 'Connecting…' : message}</p>
  {#if state === 'idle'}
    <button class="btn primary" type="button" on:click={start} {disabled}>Talk to Dorian</button>
  {:else}
    <button class="btn" type="button" on:click={() => end()}>End conversation</button>
  {/if}
