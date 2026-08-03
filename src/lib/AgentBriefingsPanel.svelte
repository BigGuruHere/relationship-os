<!-- src/lib/AgentBriefingsPanel.svelte -->
<script lang="ts">
  export let entityType: 'contact' | 'company' | 'deal' | 'project';
  export let entityId: string;
  export let entityLabel = 'this record';
  export let artifacts: any[] = [];

  function fmt(value: string | Date | null | undefined) {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  }
</script>

<section class="card agent-panel">
  <div class="section-head">
    <div>
      <h2>Agent briefings</h2>
      <p class="muted">Run a safe Stage 1 agent that reads this Relish record and stores a briefing artifact.</p>
    </div>
    <form method="post" action="/agents/broker-brief">
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="briefingPurpose" value={`Prepare a practical broker briefing for ${entityLabel}.`} />
      <button class="btn primary" type="submit">Prepare broker briefing</button>
    </form>
  </div>

  {#if artifacts?.length}
    <div class="briefing-list">
      {#each artifacts as artifact}
        <article class="briefing-row">
          <div>
            <div class="meta">{artifact.artifactType} - {fmt(artifact.createdAt)}</div>
            <strong>{artifact.title}</strong>
            {#if artifact.summary}<p>{artifact.summary}</p>{/if}
          </div>
          {#if artifact.runId}<a class="btn" href={`/agents/runs/${artifact.runId}`}>Open run</a>{/if}
        </article>
      {/each}
    </div>
  {:else}
    <p class="muted">No agent briefings yet.</p>
  {/if}
</section>

<style>
  .agent-panel { padding: 14px; margin-bottom: 12px; }
  h2 { margin: 0; font-size: 1.1rem; }
  .section-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
  .muted { color: var(--muted); }
  .section-head p { margin: 4px 0 0; }
  .briefing-list { display: grid; gap: 8px; margin-top: 10px; }
  .briefing-row { border: 1px solid var(--border); border-radius: 12px; padding: 10px; display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
  .briefing-row p { margin: 4px 0 0; }
  .meta { color: var(--muted); font-size: 0.85rem; margin-bottom: 3px; }
  @media (max-width: 760px) { .briefing-row { display: grid; } }
</style>
