<!-- src/routes/agents/runs/+page.svelte -->
<script lang="ts">
  export let data: any;

  function fmt(value: string | Date | null | undefined) {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  }
</script>

<div class="container">
  <div class="card header">
    <div>
      <div class="eyebrow">Agent Framework</div>
      <h1>Agent runs</h1>
      <p class="muted">Audit trail of agent work inside Relish.</p>
    </div>
    <a class="btn" href="/agents">Agents</a>
  </div>

  <div class="card filters">
    <a class="btn" href="/agents/runs">All</a>
    <a class="btn" href="/agents/runs?status=completed">Completed</a>
    <a class="btn" href="/agents/runs?status=failed">Failed</a>
    <a class="btn" href="/agents/runs?status=running">Running</a>
  </div>

  <section class="card panel">
    {#if !data.runs?.length}
      <p class="muted">No matching runs yet.</p>
    {:else}
      <div class="list">
        {#each data.runs as run}
          <a class="run-row" href={`/agents/runs/${run.id}`}>
            <div>
              <strong>{run.agentDefinition.name}</strong>
              <div class="meta">
                <span>{run.status}</span>
                <span>{run.triggerEntityType || run.triggerType}</span>
                <span>{fmt(run.createdAt)}</span>
              </div>
              {#if run.errorMessage}<p class="error">{run.errorMessage}</p>{/if}
            </div>
            <div class="counts">
              <span>{run._count.steps} steps</span>
              <span>{run._count.toolCalls} tools</span>
              <span>{run._count.modelInvocations} models</span>
              <span>{run._count.artifacts} artifacts</span>
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .header { padding: 18px; display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
  h1 { margin: 0; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .filters, .panel { padding: 12px; margin-bottom: 12px; }
  .filters { display: flex; gap: 8px; flex-wrap: wrap; }
  .list { display: grid; gap: 10px; }
  .run-row { color: inherit; text-decoration: none; border: 1px solid var(--border); border-radius: 12px; padding: 12px; display: flex; justify-content: space-between; gap: 12px; }
  .meta, .counts { display: flex; gap: 8px; flex-wrap: wrap; color: var(--muted); font-size: 0.9rem; }
  .counts { justify-content: flex-end; }
  .error { color: var(--danger); margin: 6px 0 0; }
  @media (max-width: 760px) { .header, .run-row { display: grid; } .counts { justify-content: flex-start; } }
</style>
