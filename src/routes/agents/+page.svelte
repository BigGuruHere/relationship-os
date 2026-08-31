<!-- src/routes/agents/+page.svelte -->
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
      <h1>Agents</h1>
      <p class="muted">Agent framework: definitions, runs, steps, tool calls, model logs, artifacts, approvals, and staged outreach candidates.</p>
    </div>
    <div class="actions">
      <form method="post" action="?/ensureDefaults">
        <button class="btn" type="submit">Ensure defaults</button>
      </form>
      <a class="btn" href="/agents/outreach/new">Start outreach</a>
      <a class="btn" href="/agents/scoring/new">Score opportunity</a>
      <a class="btn" href="/agents/enrichment/new">Enrich contacts</a>
      <a class="btn" href="/agents/memory">Preview memory</a>
      <a class="btn" href="/agents/runs">All runs</a>
    </div>
  </div>

  <section class="card panel">
    <h2>Available agents</h2>
    {#if !data.agents?.length}
      <p class="muted">No agents created yet.</p>
    {:else}
      <div class="list">
        {#each data.agents as agent}
          <article class="row">
            <div>
              <h3>{agent.name}</h3>
              <p>{agent.description}</p>
              <div class="meta">
                <span>{agent.category}</span>
                <span>{agent.status}</span>
                <span>purpose: {agent.purposeKey}</span>
                <span>authority: {agent.authorityLevel}</span>
                <span>{agent.defaultModelProvider} / {agent.defaultModelName}</span>
                <span>{agent._count?.runs ?? 0} runs</span>
              </div>
            </div>
            <div class="right">
              {#if agent.runs?.[0]}
                <a class="btn" href={`/agents/runs/${agent.runs[0].id}`}>Latest run</a>
              {/if}
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </section>

  <section class="card panel">
    <div class="section-head">
      <h2>Recent runs</h2>
      <a class="btn" href="/agents/runs">View all</a>
    </div>
    {#if !data.recentRuns?.length}
      <p class="muted">No agent runs yet. Open a contact/company/deal/project for a broker briefing, or start a safe outreach run.</p>
    {:else}
      <div class="list">
        {#each data.recentRuns as run}
          <a class="run-row" href={`/agents/runs/${run.id}`}>
            <div>
              <strong>{run.agentDefinition.name}</strong>
              <div class="meta">
                <span>{run.status}</span>
                <span>{run.triggerEntityType || 'manual'}</span>
                <span>{fmt(run.createdAt)}</span>
              </div>
              {#if run.errorMessage}<p class="error">{run.errorMessage}</p>{/if}
            </div>
            <span class="pill">{run._count?.steps ?? 0} steps</span>
          </a>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .header { padding: 18px; display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; margin-bottom: 12px; }
  h1, h2, h3 { margin: 0; }
  h3 { font-size: 1rem; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .panel { padding: 14px; margin-bottom: 12px; }
  .actions, .meta, .section-head { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .section-head { justify-content: space-between; margin-bottom: 10px; }
  .list { display: grid; gap: 10px; }
  .row, .run-row { border: 1px solid var(--border); border-radius: 12px; padding: 12px; display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .run-row { color: inherit; text-decoration: none; }
  .row p { margin: 4px 0 8px; }
  .meta { color: var(--muted); font-size: 0.9rem; }
  .error { color: var(--danger); margin: 6px 0 0; }
  @media (max-width: 760px) { .header, .row, .run-row { display: grid; } }
</style>
