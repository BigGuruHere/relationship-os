<!-- src/routes/agents/runs/[id]/+page.svelte -->
<script lang="ts">
  export let data: any;

  function fmt(value: string | Date | null | undefined) {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  }

  function pretty(value: unknown) {
    if (value === null || value === undefined) return '';
    try { return JSON.stringify(value, null, 2); } catch { return String(value); }
  }

  function entityHref(type: string | null | undefined, id: string | null | undefined) {
    if (!type || !id) return '';
    if (type === 'contact') return `/contacts/${id}`;
    if (type === 'company') return `/companies/${id}`;
    if (type === 'deal') return `/deals/${id}`;
    if (type === 'project') return `/projects/${id}`;
    return '';
  }
</script>

<div class="container">
  <div class="card header">
    <div>
      <div class="eyebrow">Agent run</div>
      <h1>{data.run.agentDefinition.name}</h1>
      <div class="meta">
        <span class="status">{data.run.status}</span>
        <span>{fmt(data.run.createdAt)}</span>
        <span>{data.run.agentDefinition.defaultModelProvider} / {data.run.agentDefinition.defaultModelName}</span>
        {#if data.run.promptVersion}<span>Prompt v{data.run.promptVersion.version}</span>{/if}
      </div>
      {#if data.run.errorMessage}<p class="error">{data.run.errorMessage}</p>{/if}
    </div>
    <div class="actions">
      {#if entityHref(data.run.triggerEntityType, data.run.triggerEntityId)}
        <a class="btn" href={entityHref(data.run.triggerEntityType, data.run.triggerEntityId)}>Open source record</a>
      {/if}
      <a class="btn" href="/agents/runs">All runs</a>
    </div>
  </div>

  {#if data.artifacts?.length}
    <section class="card panel">
      <h2>Artifacts</h2>
      {#each data.artifacts as artifact}
        <article class="artifact">
          <div class="meta"><span>{artifact.artifactType}</span><span>{fmt(artifact.createdAt)}</span></div>
          <h3>{artifact.title}</h3>
          {#if artifact.summary}<p class="summary">{artifact.summary}</p>{/if}
          {#if artifact.content}<pre class="content">{artifact.content}</pre>{/if}
        </article>
      {/each}
    </section>
  {/if}

  <section class="card panel">
    <h2>Steps</h2>
    <div class="list">
      {#each data.run.steps as step}
        <details class="detail" open>
          <summary><strong>{step.stepName}</strong> <span>{step.status}</span></summary>
          {#if step.errorMessage}<p class="error">{step.errorMessage}</p>{/if}
          <div class="grid two">
            <div><h4>Input</h4><pre>{pretty(step.inputJson)}</pre></div>
            <div><h4>Output</h4><pre>{pretty(step.outputJson)}</pre></div>
          </div>
        </details>
      {/each}
    </div>
  </section>

  <section class="grid two cols">
    <div class="card panel">
      <h2>Tool calls</h2>
      {#if !data.run.toolCalls?.length}<p class="muted">No tool calls.</p>{/if}
      {#each data.run.toolCalls as call}
        <details class="detail">
          <summary><strong>{call.toolKey}</strong> <span>{call.status}</span></summary>
          {#if call.errorMessage}<p class="error">{call.errorMessage}</p>{/if}
          <pre>{pretty(call.outputJson || call.inputJson)}</pre>
        </details>
      {/each}
    </div>

    <div class="card panel">
      <h2>Model calls</h2>
      {#if !data.run.modelInvocations?.length}<p class="muted">No model calls.</p>{/if}
      {#each data.run.modelInvocations as call}
        <details class="detail">
          <summary><strong>{call.provider} / {call.model}</strong> <span>{call.status}</span></summary>
          <div class="meta"><span>{call.purpose}</span><span>{call.inputTokens || 0} in</span><span>{call.outputTokens || 0} out</span></div>
          {#if call.errorMessage}<p class="error">{call.errorMessage}</p>{/if}
          <pre>{pretty(call.structuredOutputJson || call.responseJsonRedacted)}</pre>
        </details>
      {/each}
    </div>
  </section>

  <section class="grid two cols">
    <div class="card panel">
      <h2>Linked records</h2>
      {#if !data.run.entities?.length}<p class="muted">No linked records.</p>{/if}
      {#each data.run.entities as entity}
        <div class="mini-row">
          <span>{entity.role}: {entity.entityType}</span>
          {#if entityHref(entity.entityType, entity.entityId)}<a href={entityHref(entity.entityType, entity.entityId)}>Open</a>{/if}
        </div>
      {/each}
    </div>

    <div class="card panel">
      <h2>Approvals</h2>
      {#if !data.run.approvals?.length}<p class="muted">No approval requests.</p>{/if}
      {#each data.run.approvals as approval}
        <div class="mini-row"><span>{approval.actionType}</span><span>{approval.status}</span></div>
      {/each}
    </div>
  </section>
</div>

<style>
  .header { padding: 18px; display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
  h1, h2, h3, h4 { margin: 0; }
  h4 { margin-bottom: 4px; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .meta, .actions, .mini-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .meta { color: var(--muted); font-size: 0.9rem; margin-top: 4px; }
  .status { font-weight: 700; color: var(--accent); }
  .panel { padding: 14px; margin-bottom: 12px; }
  .artifact { border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin-top: 10px; }
  .summary { font-weight: 600; }
  .content, pre { white-space: pre-wrap; word-break: break-word; background: var(--surface-2); border: 1px solid var(--border); border-radius: 10px; padding: 10px; overflow: auto; }
  .detail { border: 1px solid var(--border); border-radius: 12px; padding: 10px; margin-top: 8px; }
  .detail summary { cursor: pointer; display: flex; justify-content: space-between; gap: 10px; }
  .grid.two, .cols { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .mini-row { justify-content: space-between; border-bottom: 1px solid var(--border); padding: 8px 0; }
  .muted { color: var(--muted); }
  .error { color: var(--danger); }
  @media (max-width: 760px) { .header, .grid.two, .cols { display: grid; grid-template-columns: 1fr; } }
</style>
