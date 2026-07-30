<!-- src/routes/projects/+page.svelte -->
<script lang="ts">
  // PURPOSE: Show lightweight projects that can group tasks across the relationship system.
  export let data: any;
  export let form: any;
  let showNew = false;

  function fmt(value: string | Date | null | undefined) {
    if (!value) return 'No date';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return 'No date';
    return d.toLocaleDateString();
  }
</script>

<div class="container">
  <div class="page-head">
    <div>
      <div class="eyebrow">Work containers</div>
      <h1>Projects</h1>
      <p class="muted">Use projects for broader work that spans people, deals, and tasks.</p>
    </div>
    <button class="btn primary" type="button" on:click={() => (showNew = !showNew)}>{showNew ? 'Cancel' : '＋ New project'}</button>
  </div>

  {#if form?.error}<div class="card error-card">{form.error}</div>{/if}

  {#if showNew}
    <div class="card panel">
      <form method="post" action="?/create" class="grid two">
        <div class="field">
          <label for="title">Title</label>
          <input id="title" name="title" placeholder="e.g. Broker network build" required />
        </div>
        <div class="field">
          <label for="status">Status</label>
          <select id="status" name="status">{#each data.projectStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select>
        </div>
        <div class="field span2">
          <label for="description">Description</label>
          <textarea id="description" name="description" rows="4"></textarea>
        </div>
        <div class="span2"><button class="btn primary" type="submit">Create project</button></div>
      </form>
    </div>
  {/if}

  {#if data.projects.length === 0}
    <div class="card empty">
      <h2>No projects yet</h2>
      <p class="muted">Create a project, then attach tasks to it from the Tasks page.</p>
    </div>
  {:else}
    <div class="project-list">
      {#each data.projects as project}
        <article class="card project-card">
          <div class="project-head">
            <div>
              <h2>{project.title}</h2>
              <div class="muted small">{project.statusLabel} - updated {fmt(project.updatedAt)}</div>
            </div>
            <form method="post" action="?/updateStatus" class="status-form">
              <input type="hidden" name="projectId" value={project.id} />
              <select name="status">
                {#each data.projectStatuses as opt}<option value={opt.value} selected={project.status === opt.value}>{opt.label}</option>{/each}
              </select>
              <button class="btn" type="submit">Update</button>
            </form>
          </div>

          {#if project.description}<p class="preline">{project.description}</p>{/if}

          <div class="task-block">
            <div class="muted small">Open tasks</div>
            {#if project.tasks.length === 0}
              <p class="muted">No open tasks.</p>
            {:else}
              <ul class="plain-list">
                {#each project.tasks as task}
                  <li><span class="status-chip">{task.statusLabel}</span> {task.title} <span class="muted small">{fmt(task.dueAt)}</span></li>
                {/each}
              </ul>
            {/if}
          </div>
        </article>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page-head, .project-head, .status-form { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  h1 { margin: 0; }
  h2 { margin: 0; font-size: 1.1rem; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  .panel, .project-card, .error-card, .empty { padding: 14px; margin-bottom: 12px; }
  .error-card { color: var(--danger); }
  .project-list { display: grid; gap: 10px; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .span2 { grid-column: 1 / span 2; }
  .preline { white-space: pre-wrap; }
  .plain-list { list-style: none; margin: 6px 0 0; padding: 0; display: grid; gap: 6px; }
  .status-chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 2px 8px; font-size: 0.8rem; color: var(--muted); }
  textarea { resize: vertical; }
  @media (max-width: 760px) {
    .page-head, .project-head, .status-form { flex-direction: column; align-items: stretch; }
    .grid.two { grid-template-columns: 1fr; }
    .span2 { grid-column: auto; }
  }
</style>
