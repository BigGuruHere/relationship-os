<script lang="ts">
  import { onMount } from 'svelte';
  export let data: any;
  export let form: any;
  // The widget is loaded only after the user deliberately asks to start a session.
  onMount(() => {
    if (!form?.launch || document.getElementById('elevenlabs-convai-widget-script')) return;
    const script = document.createElement('script');
    script.id = 'elevenlabs-convai-widget-script';
    script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    script.type = 'text/javascript';
    script.async = true;
    document.body.appendChild(script);
  });
</script>
<svelte:head><title>Speak to Dorian - {data.contextLabel}</title></svelte:head>
<div class="container" style="max-width:720px;padding:22px 12px">
  <a href="/profiles" style="display:none">Profiles</a>
  <h1>A conversation with Dorian</h1>
  <p>This invitation came from <strong>{data.profileName}'s {data.contextLabel.toLowerCase()} profile</strong>.</p>
  <p>Dorian is an AI conversational partner. Your conversation may be transcribed and used to develop your private Living Understanding. It is <strong>not shared with the profile owner</strong> and does not automatically create a connection.</p>
  {#if !data.sharedEnabled}
    <p role="alert">The shared Dorian agent has not yet been configured. No conversation can start.</p>
  {:else if form?.launch}
    <section class="card" style="padding:20px;margin-top:16px">
      <p>Allow microphone access when you're ready. You can end the conversation whenever you like.</p>
      <elevenlabs-convai agent-id={form.launch.agentId} dynamic-variables={form.launch.dynamicVariables}></elevenlabs-convai>
    </section>
  {:else}
    {#if form?.error}<p role="alert">{form.error}</p>{/if}
    <form method="post" action="?/start"><button class="btn primary" type="submit">Start my private conversation</button></form>
  {/if}
  <section class="card" style="padding:16px;margin-top:24px">
    <h2>Would you like to stay in touch?</h2>
    {#if data.hasConnectionRequest || form?.connectionRequested}
      <p role="status">Your contact request has been offered to the profile owner. No private Dorian information was shared.</p>
    {:else}
      <p>This is optional. Only the name and email you enter below will be shown to the profile owner, so they can follow up. No conversation or private understanding is shared.</p>
      <form method="post" action="?/requestConnection" style="display:grid;gap:10px;max-width:400px">
        <label>Your name <input name="name" required maxlength="90" autocomplete="name" /></label>
        <label>Your email <input name="email" type="email" required maxlength="254" autocomplete="email" /></label>
        <label><input name="consent" value="yes" type="checkbox" required /> I agree to share these contact details with {data.profileName}.</label>
        <button type="submit">Request a connection</button>
      </form>
    {/if}
  </section>
  <section class="card" style="padding:16px;margin-top:24px">
    <h2>Was this helpful?</h2>
    <p>Your answer helps us improve this early pilot. It is not an assessment of your relationship with the owner.</p>
    {#if form?.feedbackSaved}<p role="status">Thank you for your feedback.</p>{:else}
      <form method="post" action="?/helpful" style="display:flex;gap:10px">
        <button type="submit" name="value" value="yes">Yes</button>
        <button type="submit" name="value" value="no">Not yet</button>
      </form>
    {/if}
  </section>
</div>
