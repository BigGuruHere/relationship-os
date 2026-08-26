<!-- src/routes/workstreams/+page.svelte -->
<script lang="ts">
  // PURPOSE: Daily operational index across every active Workstream.
  export let data: any;
  export let form: any;

  function fmt(value: string | Date | null | undefined) {
    if (!value) return 'No recent activity';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return 'No recent activity';
    return date.toLocaleString();
  }

  function dueLabel(value: string | Date | null | undefined) {
    if (!value) return 'No due date';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return 'No due date';
    return date.toLocaleString();
  }

  function submitContainingForm(event: Event) {
    // IT: Status changes save immediately; archiving remains on the parent Project page because it also detaches linked records.
    (event.currentTarget as HTMLSelectElement).form?.requestSubmit();
  }
</script>

<div class="container">
  <div class="page-head">
    <div>
      <div class="eyebrow">Daily operations</div>
      <h1>Workstreams</h1>
      <p class="muted">Open the lane you are working on and use it as mission control for the next actions, demand, supply, leads and deals inside that market.</p>
    </div>
    <a class="btn" href="/projects">Projects</a>
  </div>

  {#if form?.error}<div class="card error-card">{form.error}</div>{/if}

  <div class="summary-grid">
    <div class="card stat"><span>Workstreams</span><strong>{data.summary.workstreams}</strong></div>
    <div class="card stat"><span>Open tasks</span><strong>{data.summary.openTasks}</strong></div>
    <div class:attention={data.summary.overdueTasks > 0} class="card stat"><span>Overdue</span><strong>{data.summary.overdueTasks}</strong></div>
    <div class="card stat"><span>Wants</span><strong>{data.summary.wants}</strong></div>
    <div class="card stat"><span>Offers</span><strong>{data.summary.offers}</strong></div>
    <div class="card stat"><span>Leads</span><strong>{data.summary.leads}</strong></div>
    <div class="card stat"><span>Deals</span><strong>{data.summary.deals}</strong></div>
  </div>

  <form method="get" class="card filters">
    <div class="field search"><label for="q">Search</label><input id="q" name="q" value={data.filters.q} placeholder="Workstream, project, objective or next action" /></div>
    <div class="field"><label for="status">Status</label><select id="status" name="status"><option value="ALL" selected={data.filters.status === 'ALL'}>All</option>{#each data.statusOptions as option}<option value={option.value} selected={data.filters.status === option.value}>{option.label}</option>{/each}</select></div>
    <div class="field"><label for="projectId">Project</label><select id="projectId" name="projectId"><option value="">All projects</option>{#each data.projects as project}<option value={project.id} selected={data.filters.projectId === project.id}>{project.title}</option>{/each}</select></div>
    <div class="field"><label for="sort">Sort</label><select id="sort" name="sort"><option value="attention" selected={data.filters.sort === 'attention'}>Needs attention</option><option value="activity" selected={data.filters.sort === 'activity'}>Recent activity</option><option value="project" selected={data.filters.sort === 'project'}>Project</option><option value="name" selected={data.filters.sort === 'name'}>Name</option></select></div>
    <div class="filter-actions"><button class="btn primary" type="submit">Apply</button><a class="btn" href="/workstreams">Reset</a></div>
  </form>

  {#if data.workstreams.length === 0}
    <section class="card empty"><h2>No workstreams matched</h2><p class="muted">Create workstreams inside a Project, or change the filters above.</p></section>
  {:else}
    <div class="workstream-list">
      {#each data.workstreams as workstream}
        <article class:needsAttention={workstream.overdueTasks > 0} class="card workstream-card">
          <div class="card-head">
            <div>
              <div class="project-line"><a href={`/projects/${workstream.project.id}`}>{workstream.project.title}</a></div>
              <h2><a href={`/projects/${workstream.project.id}/workstreams/${workstream.id}`}>{workstream.name}</a></h2>
              <div class="muted small">{workstream.statusLabel} · last activity {fmt(workstream.lastActivityAt)}</div>
            </div>
            <form method="post" action="?/updateStatus" class="status-form">
              <input type="hidden" name="workstreamId" value={workstream.id} />
              <select name="status" on:change={submitContainingForm} aria-label={`Status for ${workstream.name}`}>
                {#each data.statusOptions as option}<option value={option.value} selected={workstream.status === option.value}>{option.label}</option>{/each}
              </select>
            </form>
          </div>

          {#if workstream.description}<p class="description">{workstream.description}</p>{/if}

          <div class="metrics">
            <span class:danger={workstream.overdueTasks > 0}><strong>{workstream.overdueTasks}</strong> overdue</span>
            <span><strong>{workstream.openTasks}</strong> tasks</span>
            <span><strong>{workstream.wants}</strong> wants</span>
            <span><strong>{workstream.offers}</strong> offers</span>
            <span><strong>{workstream.leads}</strong> leads</span>
            <span><strong>{workstream.deals}</strong> deals</span>
          </div>

          <div class="next-action">
            <div class="muted small">Next action</div>
            {#if workstream.nextTask}
              <a href={`/tasks/${workstream.nextTask.id}/edit?returnTo=/workstreams`}><strong>{workstream.nextTask.title}</strong></a>
              <span class="muted small">{workstream.nextTask.statusLabel} · {dueLabel(workstream.nextTask.dueAt)}</span>
            {:else}
              <span class="muted">No open task. Consider defining the next action.</span>
            {/if}
          </div>

          <div class="actions"><a class="btn primary" href={`/projects/${workstream.project.id}/workstreams/${workstream.id}`}>Open mission control</a><a class="btn" href={`/tasks?projectId=${workstream.project.id}&workstreamId=${workstream.id}`}>Tasks</a></div>
        </article>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page-head, .card-head, .status-form, .actions, .metrics, .filter-actions { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
  h1 { margin: 0; }
  h2 { margin: 2px 0; font-size: 1.16rem; }
  h2 a { color: inherit; text-decoration: none; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .small { font-size: 0.87rem; }
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(105px, 1fr)); gap: 9px; margin: 12px 0; }
  .stat { padding: 12px; display: grid; gap: 3px; }
  .stat strong { font-size: 1.45rem; }
  .stat.attention, .workstream-card.needsAttention { border-width: 2px; }
  .filters { padding: 12px; display: grid; grid-template-columns: minmax(220px, 2fr) repeat(3, minmax(140px, 1fr)) auto; gap: 10px; align-items: end; margin-bottom: 12px; }
  .field { display: grid; gap: 5px; }
  .filter-actions { justify-content: flex-start; align-items: end; }
  .workstream-list { display: grid; gap: 10px; }
  .workstream-card { padding: 14px; display: grid; gap: 11px; }
  .project-line { font-size: 0.83rem; font-weight: 700; }
  .description { margin: 0; white-space: pre-wrap; }
  .metrics { justify-content: flex-start; flex-wrap: wrap; align-items: center; }
  .metrics span { border: 1px solid var(--border); border-radius: 999px; padding: 4px 9px; font-size: 0.82rem; }
  .metrics .danger { font-weight: 700; }
  .next-action { display: grid; gap: 3px; border-top: 1px solid var(--border); padding-top: 10px; }
  .actions { justify-content: flex-start; flex-wrap: wrap; }
  .error-card, .empty { padding: 14px; }
  @media (max-width: 980px) { .filters { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 700px) { .page-head, .card-head { flex-direction: column; } .filters { grid-template-columns: 1fr; } }
</style>
