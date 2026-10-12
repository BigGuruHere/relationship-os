<script lang="ts">
  import { onMount } from 'svelte';
  export let data: any;
  export let form: any;

  onMount(() => {
    const id = 'elevenlabs-convai-widget-script';
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    script.async = true;
    script.type = 'text/javascript';
    document.body.appendChild(script);
  });
</script>

<svelte:head><title>ElevenLabs bridge test - Relish</title></svelte:head>

<div class="container">
  <div class="card header">
    <div>
      <div class="eyebrow">Stage 8.14.2.2</div>
      <h1>ElevenLabs bridge test</h1>
      <p class="muted">Exercise the real Relish initiation endpoint through the public tunnel, then start an ElevenLabs widget with exactly the dynamic variables Relish returned.</p>
    </div>
    <a class="btn" href="/settings/agents">Agent deployments</a>
  </div>

  <section class="card panel">
    <h2>1. Mock the call-initiation request</h2>
    <p class="muted">This request leaves Relish, reaches <code>{data.testPublicOrigin}</code>, comes back through ngrok, authenticates with the server-side initiation secret, resolves the selected agent deployment and test person, and returns the bounded agent context.</p>

    {#if !data.bindings.length}
      <p class="error">No active ElevenLabs binding with an agent ID exists yet. Create one under Agent deployments first.</p>
    {:else}
      <form method="POST" action="?/mockInitiation" class="grid two">
        <label>Agent deployment
          <select name="bindingId" required>
            {#each data.bindings as binding}
              <option value={binding.id} selected={form?.bindingId ? form.bindingId === binding.id : binding.agentKey === 'DORIAN'}>
                {binding.agentName} - {binding.environment} - {binding.domainKey}
              </option>
            {/each}
          </select>
        </label>
        <label>Relish test Contact or Person UUID
          <input name="personId" required value={form?.personId || data.defaultTestPersonId} autocomplete="off" />
        </label>
        <div class="wide endpoint"><strong>Public endpoint:</strong> <code>{data.testPublicOrigin}/api/webhooks/elevenlabs/initiation</code></div>
        <div><button class="btn primary" type="submit">Run mock initiation</button></div>
      </form>
    {/if}
  </section>

  {#if form?.error}
    <section class="card panel error" role="alert">
      <h2>Initiation test failed</h2>
      <p>{form.error}</p>
      {#if form.endpoint}<p><code>{form.endpoint}</code></p>{/if}
      {#if form.participantResolution}<details><summary>Participant ID resolution</summary><pre>{JSON.stringify(form.participantResolution, null, 2)}</pre></details>{/if}
      {#if form.requestPayload}<details><summary>Request payload</summary><pre>{JSON.stringify(form.requestPayload, null, 2)}</pre></details>{/if}
      {#if form.responsePayload}<details><summary>Response payload</summary><pre>{JSON.stringify(form.responsePayload, null, 2)}</pre></details>{/if}
    </section>
  {/if}

  {#if form?.success}
    <section class="card panel success">
      <h2>2. Initiation result</h2>
      <p>{form.success}</p>
      <div class="facts">
        <span><strong>Agent:</strong> {form.agentName} ({form.agentKey})</span>
        <span><strong>Environment:</strong> {form.environment}</span>
        <span><strong>Context:</strong> {form.domainKey}</span>
        <span><strong>Input matched as:</strong> {form.participantResolution?.matchedAs || 'NO_MATCH'}</span>
        <span><strong>Contact:</strong> <code>{form.participantResolution?.contactId || ''}</code></span>
        <span><strong>Person:</strong> <code>{form.participantResolution?.personId || ''}</code></span>
        <span><strong>Conversation:</strong> <code>{form.conversationId}</code></span>
      </div>
      <details>
        <summary>Show request sent through ngrok</summary>
        <pre>{JSON.stringify(form.requestPayload, null, 2)}</pre>
      </details>
      <details>
        <summary>Show Relish initiation response</summary>
        <pre>{JSON.stringify(form.responsePayload, null, 2)}</pre>
      </details>
    </section>

    <section class="card panel widget-panel">
      <h2>3. Start the ElevenLabs widget</h2>
      <p class="muted">This browser conversation does not itself invoke the initiation webhook. Instead, it receives the exact <code>dynamic_variables</code> produced by the successful initiation test above. This lets us test the two halves together before Telnyx is available.</p>
      <div class="widget-host">
        <elevenlabs-convai agent-id={form.agentId} dynamic-variables={form.dynamicVariablesJson}></elevenlabs-convai>
      </div>
      <p class="note">For the widget to connect, the ElevenLabs agent must permit widget access for this test. If an ElevenLabs domain allowlist is enabled, allow the hostname you are using to open this page.</p>
    </section>
  {/if}

  <section class="card panel">
    <h2>What to watch in the Relish terminal</h2>
    <pre>[ElevenLabs][el-init_...][REQUEST]
[ElevenLabs][el-init_...][AUTH]
[ElevenLabs][el-init_...][AGENT]
[ElevenLabs][el-init_...][IDENTITY]
[ElevenLabs][el-init_...][SENT]</pre>
    <p class="muted">With <code>ELEVENLABS_DEBUG_LOG_PAYLOADS=YES</code>, Relish also prints the full initiation request and returned context. Disable payload logging after development because it can contain participant information.</p>
  </section>
</div>

<style>
  .header { padding:18px; display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:12px; }
  .eyebrow { color:var(--accent); font-weight:700; font-size:.85rem; text-transform:uppercase; letter-spacing:.04em; }
  h1,h2 { margin-top:0; }
  .muted { color:var(--muted); }
  .panel { padding:18px; margin-bottom:14px; }
  .grid { display:grid; gap:12px; }
  .grid.two { grid-template-columns:repeat(2,minmax(0,1fr)); }
  label { display:grid; gap:6px; font-weight:600; }
  input,select { width:100%; box-sizing:border-box; }
  .wide { grid-column:1/-1; }
  .endpoint { overflow-wrap:anywhere; }
  .error { color:var(--danger); }
  .facts { display:flex; gap:12px; flex-wrap:wrap; margin:12px 0; }
  details { margin-top:12px; }
  summary { cursor:pointer; font-weight:700; }
  pre { overflow:auto; white-space:pre-wrap; word-break:break-word; padding:12px; border:1px solid var(--border); border-radius:10px; }
  .widget-host { min-height:100px; margin:18px 0; }
  .note { font-size:.92rem; }
  @media (max-width:760px) { .header,.grid.two { display:grid; grid-template-columns:1fr; } .wide { grid-column:auto; } }
</style>
