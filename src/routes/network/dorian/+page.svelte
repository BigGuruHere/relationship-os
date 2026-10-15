<script lang="ts">
  import { onMount } from 'svelte';
  export let form: { sharedLaunch?: { agentId: string; dynamicVariables: string }; sharedError?: string } | null;
  export let data: {
    status: 'READY' | 'NO_GENERAL_CONTEXT' | 'NO_PRIVATE_DEPLOYMENT' | 'NO_SELF_IDENTITY' | 'SHARED_AVAILABLE';
    launch: { agentId: string; dynamicVariables: string } | null;
    sharedEnabled?: boolean;
  };
  // Load the vendor widget only for a verified, participant-owned deployment.
  onMount(() => {
    if (!data.launch && !form?.sharedLaunch) return;
    const id = 'elevenlabs-convai-widget-script';
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    script.type = 'text/javascript';
    script.async = true;
    document.body.appendChild(script);
  });
</script>
<svelte:head><title>Talk with Dorian - Relish Network</title></svelte:head>
<div class="container" style="max-width:760px;padding:20px 12px">
  <a href="/network">← Back to Network</a>
  <h1>Talk with Dorian</h1>
  <p>Dorian helps you explore what matters to you. Your conversation is private to your own Relish account and General ContextSpace.</p>
  {#if data.status === 'SHARED_AVAILABLE'}
    <section class="card" style="padding:20px;margin:18px 0">
      <h2>Shared Dorian</h2>
      <p>Starting a conversation creates a temporary session tied to your own account. The transcript remains in your General ContextSpace and is not automatically shared or match-eligible.</p>
      {#if form?.sharedError}<p role="alert">{form.sharedError}</p>{/if}
      {#if form?.sharedLaunch}
        <elevenlabs-convai agent-id={form.sharedLaunch.agentId} dynamic-variables={form.sharedLaunch.dynamicVariables}></elevenlabs-convai>
      {:else}
        <form method="POST" action="?/start"><button type="submit">Start Dorian session</button></form>
      {/if}
    </section>
  {:else if data.status === 'READY' && data.launch}
    <section class="card" style="padding:20px;margin:18px 0">
      <h2>Start a voice conversation</h2>
      <p>Choose to start the voice widget when you're comfortable. A conversation may be transcribed for your private records. Nothing is made shareable or match-eligible just by speaking.</p>
      <elevenlabs-convai agent-id={data.launch.agentId} dynamic-variables={data.launch.dynamicVariables}></elevenlabs-convai>
      <p class="muted">Voice availability also depends on your configured ElevenLabs deployment and widget-domain settings.</p>
    </section>
  {:else}
    <section class="card" style="padding:20px;margin:18px 0">
      <h2>Voice conversations aren't ready for this account yet</h2>
      {#if data.status === 'NO_GENERAL_CONTEXT'}
        <p>Your General ContextSpace is not configured.</p>
      {:else if data.status === 'NO_PRIVATE_DEPLOYMENT'}
        <p>There isn't exactly one active Dorian ElevenLabs deployment assigned to your own General ContextSpace. A deployment belonging to another user cannot safely be reused for your private conversation.</p>
      {:else}
        <p>Your account doesn't yet have a uniquely linked self-contact in your General ContextSpace. Relish cannot safely attach a conversation to your personal understanding without one.</p>
      {/if}
      <p>No voice session has been started and no private conversation has been assigned to another account.</p>
    </section>
  {/if}
</div>
