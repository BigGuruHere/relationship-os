<!-- src/routes/agents/memory/+page.svelte -->
<script lang="ts">
  export let data: any;
  let selectedAgentId = data.selectedAgentId;
  let selectedContactId = data.selectedContactId;
</script>

<div class="container">
  <div class="card header">
    <div>
      <div class="eyebrow">Stage 8.5</div>
      <h1>Agent memory preview</h1>
      <p class="muted">Inspect the derived relationship memory an agent is permitted to receive. This projection is rebuilt from Relish Core and is not stored as a second profile.</p>
    </div>
    <a class="btn" href="/agents">Back to agents</a>
  </div>

  <form class="card controls" method="get">
    <label>
      Agent
      <select name="agentId" bind:value={selectedAgentId}>
        {#each data.agents as agent}
          <option value={agent.id}>{agent.name} - {agent.purposeKey}</option>
        {/each}
      </select>
    </label>
    <label>
      Contact subject
      <select name="contactId" bind:value={selectedContactId}>
        {#each data.contacts as contact}
          <option value={contact.id}>{contact.name}</option>
        {/each}
      </select>
    </label>
    <button class="btn" type="submit">Preview memory</button>
  </form>

  {#if data.error}
    <div class="card error-box"><strong>Projection blocked:</strong> {data.error}</div>
  {:else if data.projection}
    <section class="card panel">
      <div class="section-head">
        <div>
          <h2>{data.projection.agent.name}</h2>
          <div class="meta">
            <span>Persona: {data.projection.agent.personaKey}</span>
            <span>Purpose: {data.projection.agent.purposeKey}</span>
            <span>Deployment: {data.projection.agent.deploymentScope}</span>
            <span>Authority: {data.projection.agent.authorityLevel}</span>
          </div>
        </div>
        <span class="pill">Derived, not stored</span>
      </div>

      <h3>Memory summary</h3>
      <pre class="summary">{data.projection.memorySummary}</pre>

      <details>
        <summary>Inspect permitted projection</summary>
        <pre class="json">{JSON.stringify(data.projection, null, 2)}</pre>
      </details>
    </section>
  {:else}
    <div class="card panel"><p class="muted">Create a Contact and ensure the built-in agents exist to preview memory.</p></div>
  {/if}
</div>

<style>
  .header { padding: 18px; display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: .85rem; text-transform: uppercase; letter-spacing: .04em; }
  h1, h2, h3 { margin: 0; }
  .muted, .meta { color: var(--muted); }
  .controls { padding: 14px; display: grid; grid-template-columns: minmax(220px,1fr) minmax(220px,1fr) auto; gap: 12px; align-items: end; margin-bottom: 12px; }
  label { display: grid; gap: 5px; font-weight: 600; }
  select { width: 100%; }
  .panel { padding: 16px; }
  .section-head { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 14px; }
  .meta { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 5px; font-size: .9rem; }
  .summary, .json { white-space: pre-wrap; overflow-wrap: anywhere; border: 1px solid var(--border); border-radius: 10px; padding: 12px; background: var(--surface-2, transparent); }
  .summary { font-family: inherit; }
  .json { max-height: 560px; overflow: auto; font-size: .82rem; }
  .error-box { padding: 14px; color: var(--danger); }
  @media (max-width: 760px) { .header, .controls, .section-head { display: grid; grid-template-columns: 1fr; } }
</style>
