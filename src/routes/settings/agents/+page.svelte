<script lang="ts">
  export let data: any;
  export let form: any;
  let replacementId = '';
  function fmt(value: string | Date | null | undefined) {
    if (!value) return '';
    const d = typeof value === 'string' ? new Date(value) : value;
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleString();
  }
</script>

<svelte:head><title>Agent deployments - Relish</title></svelte:head>
<div class="container">
  <div class="card header">
    <div>
      <div class="eyebrow">Stage 8.14.2</div>
      <h1>Agent deployments</h1>
      <p class="muted">Relish owns the durable agent identity. ElevenLabs agent IDs and phone assignments are replaceable bindings, so moving a number to a new ElevenLabs agent does not change who the agent is inside Relish.</p>
    </div>
    <div class="header-actions">{#if data.controlPlaneConsoleUrl}<a class="btn primary" href={data.controlPlaneConsoleUrl} target="_blank" rel="noopener noreferrer">Manage Dorian conversation settings</a>{/if}<a class="btn" href="/settings/agents/test">Test ElevenLabs bridge</a><a class="btn" href="/agents">Agent framework</a></div>
  </div>

  {#if data.controlPlaneConsoleUrl}<p class="card panel"><strong>Central Agent Management:</strong> Edit greetings, persona and ContextSpace instructions using the single deployment linked above. This screen still manages local provider bindings and does not automatically update proxy routing.</p>{/if}

  {#if form?.error}<p class="card error" role="alert">{form.error}</p>{/if}
  {#if form?.success}<p class="card success">{form.success}</p>{/if}

  <section class="card panel">
    <h2>1. Logical Relish agents</h2>
    <p class="muted">Create Dorian once. Provider agents can then be replaced underneath that stable identity.</p>
    {#if data.agents.length}
      <div class="agent-list">
        {#each data.agents as agent}
          <div class="agent-row"><strong>{agent.name}</strong><span>{agent.key}</span><span>{agent.status}</span><span>{agent.allowedDomainKeys.join(', ')}</span></div>
        {/each}
      </div>
    {/if}
    <details>
      <summary>Create logical agent</summary>
      <form method="POST" action="?/createAgent" class="grid two form-block">
        <label>Name<input name="name" required maxlength="120" placeholder="Dorian" /></label>
        <label>Stable key<input name="key" maxlength="80" placeholder="DORIAN" /></label>
        <label class="wide">Description<input name="description" maxlength="400" placeholder="General Relish conversation agent" /></label>
        <label>Initial application space<select name="contextSpaceId" required><option value="" disabled selected>Choose space</option>{#each data.spaces as space}<option value={space.id}>{space.displayName} ({space.domainKey})</option>{/each}</select></label>
        <div class="submit"><button class="btn primary" type="submit">Create logical agent</button></div>
      </form>
    </details>
  </section>

  <section class="card panel">
    <h2>2. Bind an ElevenLabs deployment</h2>
    <p class="muted">Enter the current ElevenLabs agent ID, inbound number, or both. If both arrive on a call, Relish cross-checks them.</p>
    <form method="POST" action="?/createBinding" class="grid two">
      <label>Relish agent<select name="agentDefinitionId" required><option value="" disabled selected>Choose agent</option>{#each data.agents as agent}<option value={agent.id}>{agent.name} ({agent.key})</option>{/each}</select></label>
      <label>Application space<select name="contextSpaceId" required><option value="" disabled selected>Choose space</option>{#each data.spaces as space}<option value={space.id}>{space.displayName} ({space.domainKey})</option>{/each}</select></label>
      <label>Environment<select name="environment">{#each data.environments as environment}<option value={environment} selected={environment === 'PRODUCTION'}>{environment}</option>{/each}</select></label>
      <label>ElevenLabs agent ID<input name="providerAgentId" maxlength="240" autocomplete="off" placeholder="agent_..." /></label>
      <label>Inbound phone number<input name="inboundPhone" maxlength="40" autocomplete="tel" placeholder="+61..." /></label>
      <div class="submit"><button class="btn primary" type="submit">Create binding</button></div>
    </form>
  </section>

  <section class="card panel">
    <h2>3. Current and historical bindings</h2>
    {#if !data.bindings.length}<p class="muted">No provider bindings yet.</p>{/if}
    <div class="bindings">
      {#each data.bindings as binding}
        <article class:inactive={!binding.isActive} class="binding">
          <div class="binding-head">
            <div><strong>{binding.agent.name}</strong> <span class="pill">{binding.environment}</span> {#if binding.isActive}<span class="pill">Active</span>{:else}<span class="pill">Historical</span>{/if}</div>
            <span class="muted">{binding.contextSpace.displayName} / {binding.contextSpace.domainKey}</span>
          </div>
          <div class="meta"><span>ElevenLabs ID: <code>{binding.providerAgentId || 'not set'}</code></span><span>Number: <code>{binding.inboundPhone || 'not set'}</code></span><span>From: {fmt(binding.validFrom)}</span>{#if binding.validTo}<span>To: {fmt(binding.validTo)}</span>{/if}</div>
          {#if binding.isActive}
            <div class="actions">
              <button class="btn" type="button" on:click={() => replacementId = replacementId === binding.id ? '' : binding.id}>Replace binding</button>
              <form method="POST" action="?/deactivateBinding"><input type="hidden" name="bindingId" value={binding.id} /><button class="btn" type="submit">Deactivate</button></form>
            </div>
            {#if replacementId === binding.id}
              <form method="POST" action="?/replaceBinding" class="grid two replace-form">
                <input type="hidden" name="bindingId" value={binding.id} />
                <label>Environment<select name="environment">{#each data.environments as environment}<option value={environment} selected={environment === binding.environment}>{environment}</option>{/each}</select></label>
                <label>New ElevenLabs agent ID<input name="providerAgentId" maxlength="240" autocomplete="off" value={binding.providerAgentId} /></label>
                <label>Inbound phone number<input name="inboundPhone" maxlength="40" autocomplete="tel" value={binding.inboundPhone} /></label>
                <div class="submit"><button class="btn primary" type="submit">Activate replacement</button></div>
              </form>
            {/if}
          {/if}
        </article>
      {/each}
    </div>
  </section>
</div>

<style>
  .header { padding: 18px; display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:12px; }
  .header-actions { display:flex; gap:8px; flex-wrap:wrap; }
  .eyebrow { color:var(--accent); font-weight:700; font-size:.85rem; text-transform:uppercase; letter-spacing:.04em; }
  h1,h2 { margin-top:0; }
  .muted,.meta { color:var(--muted); }
  .panel { padding:18px; margin-bottom:14px; }
  .grid { display:grid; gap:12px; } .grid.two { grid-template-columns:repeat(2,minmax(0,1fr)); }
  label { display:grid; gap:6px; font-weight:600; } input,select { width:100%; box-sizing:border-box; }
  .wide { grid-column:1/-1; } .submit { display:flex; align-items:end; }
  .agent-list,.bindings { display:grid; gap:10px; margin:12px 0; }
  .agent-row,.binding { border:1px solid var(--border); border-radius:12px; padding:12px; }
  .agent-row { display:flex; gap:12px; flex-wrap:wrap; align-items:center; }
  .binding.inactive { opacity:.72; }
  .binding-head,.actions,.meta { display:flex; gap:10px; flex-wrap:wrap; align-items:center; justify-content:space-between; }
  .meta { justify-content:flex-start; margin-top:8px; font-size:.9rem; }
  .actions { justify-content:flex-start; margin-top:10px; }
  .replace-form,.form-block { margin-top:12px; padding-top:12px; border-top:1px solid var(--border); }
  .error { color:var(--danger); padding:12px; } .success { padding:12px; }
  summary { cursor:pointer; font-weight:700; margin-top:12px; }
  @media (max-width:760px) { .header,.grid.two { display:grid; grid-template-columns:1fr; } .wide { grid-column:auto; } }
</style>
