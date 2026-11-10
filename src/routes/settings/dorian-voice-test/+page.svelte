<script lang="ts">
  import { deserialize } from '$app/forms';
  import { onMount } from 'svelte';

  let session: { endSession: () => Promise<void> } | null = null;
  let attempt = 0;
  let state: 'idle' | 'connecting' | 'connected' = 'idle';
  let message = '';

  async function start() {
    if (state !== 'idle') return;
    const current = ++attempt;
    state = 'connecting';
    message = '';
    try {
      const response = await fetch(window.location.href, {
        method: 'POST',
        body: new FormData(),
        headers: { 'x-sveltekit-action': 'true', accept: 'application/json' }
      });
      const result = deserialize(await response.text());
      if (current !== attempt) return;
      if (result.type !== 'success' || typeof result.data?.token !== 'string') {
        message = result.type === 'failure' && typeof result.data?.error === 'string'
          ? result.data.error : 'Could not start the conversation.';
        state = 'idle';
        return;
      }

      // Let the SDK request the microphone only after the user starts a conversation.
      const { Conversation } = await import('@elevenlabs/client');
      if (current !== attempt) return;
      const conversation = await Conversation.startSession({
        conversationToken: result.data.token,
        onDisconnect: () => {
          if (current !== attempt) return;
          ++attempt;
          session = null;
          state = 'idle';
        }
      });
      if (current !== attempt) {
        await conversation.endSession();
        return;
      }
      session = conversation;
      state = 'connected';
    } catch {
      if (current !== attempt) return;
      message = 'Could not connect. Check your microphone permission and try again.';
      state = 'idle';
    }
  }

  async function end() {
    // Ignore late callbacks from a connection the user has already ended.
    ++attempt;
    const active = session;
    session = null;
    try {
      await active?.endSession();
    } catch {
      message = 'The connection ended unexpectedly.';
    } finally {
      state = 'idle';
    }
  }

  onMount(() => () => { void end(); });
</script>

<svelte:head><title>Dorian Voice Test - Relish</title></svelte:head>

<section class="container" style="max-width: 34rem">
  <h1>Dorian Voice Test</h1>
  <p>This DEV test sends live microphone audio to ElevenLabs. Use made-up details. Relish does not save a note from this test.</p>
  <p role="status">{state === 'connected' ? 'Connected to Dorian' : state === 'connecting' ? 'Connecting…' : message}</p>
  {#if state === 'idle'}
    <button class="btn primary" type="button" on:click={start}>Talk to Dorian</button>
  {:else}
    <button class="btn" type="button" on:click={end}>End conversation</button>
  {/if}
</section>
