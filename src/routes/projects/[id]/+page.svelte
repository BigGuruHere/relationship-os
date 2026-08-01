<!-- src/routes/projects/[id]/+page.svelte -->
<script lang="ts">
  // PURPOSE: Project command-centre page for tasks, people, deals, waiting items, and next actions.
  // SECURITY: All data has been tenant-filtered and decrypted server side.

  import VoiceTextField from '$lib/recording/VoiceTextField.svelte';

  export let data: any;
  export let form: any;

  let showEdit = false;
  let showNewTask = false;
  let taskNotes = '';
  let taskSummary = '';

  function fmt(value: string | Date | null | undefined) {
    if (!value) return 'No date';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return 'No date';
    return d.toLocaleString();
  }

  function dueClass(value: string | Date | null | undefined, statusValue: string) {
    if (!value || statusValue === 'DONE' || statusValue === 'CANCELLED') return '';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '';
    return d.getTime() < Date.now() ? 'overdue' : '';
  }

  function submitContainingForm(event: Event) {
    // IT: Status dropdowns submit immediately so there is no separate Update button.
    (event.currentTarget as HTMLSelectElement).form?.requestSubmit();
  }
</script>

<div class="container">
  <div class="card project-header">
    <div>
      <div class="eyebrow">Project</div>
      <h1>{data.project.title}</h1>
      <div class="meta-row">
        <span class="status-chip">{data.project.statusLabel}</span>
        <span>Updated {fmt(data.project.updatedAt)}</span>
      </div>
      {#if data.project.description}<p class="preline">{data.project.description}</p>{/if}
    </div>
    <div class="actions">
      <button class="btn" type="button" on:click={() => (showEdit = !showEdit)}>{showEdit ? 'Close edit' : 'Edit project'}</button>
      <button class="btn primary" type="button" on:click={() => (showNewTask = !showNewTask)}>{showNewTask ? 'Cancel task' : '＋ New task'}</button>
      <a class="btn" href="/projects">All projects</a>
    </div>
  </div>

  {#if form?.error}<div class="card error-card">{form.error}</div>{/if}

  <div class="summary-grid">
    <div class="card stat"><span>Active</span><strong>{data.summary.active}</strong></div>
    <div class="card stat"><span>Overdue</span><strong>{data.summary.overdue}</strong></div>
    <div class="card stat"><span>Waiting</span><strong>{data.summary.waiting}</strong></div>
    <div class="card stat"><span>Completed</span><strong>{data.summary.completed}</strong></div>
  </div>

  {#if showEdit}
    <section class="card panel">
      <h2>Edit project</h2>
      <form method="post" action="?/updateProject" class="grid two">
        <div class="field"><label for="title">Title</label><input id="title" name="title" required value={data.project.title} /></div>
        <div class="field"><label for="status">Status</label><select id="status" name="status">{#each data.projectStatuses as opt}<option value={opt.value} selected={data.project.status === opt.value}>{opt.label}</option>{/each}</select></div>
        <div class="field span2"><label for="description">Description</label><textarea id="description" name="description" rows="4">{data.project.description}</textarea></div>
        <div class="span2"><button class="btn primary" type="submit">Save project</button></div>
      </form>
    </section>
  {/if}

  {#if showNewTask}
    <section class="card panel">
      <h2>New project task</h2>
      <form method="post" action="?/createTask">
        <div class="field"><label for="taskTitle">Task</label><input id="taskTitle" name="title" placeholder="e.g. Follow up Sam about buyer list" required /></div>

        <div class="grid four">
          <div class="field"><label for="taskType">Type</label><select id="taskType" name="taskType">{#each data.taskTypes as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="urgency">Urgency</label><select id="urgency" name="urgency">{#each data.taskUrgencies as opt}<option value={opt.value} selected={opt.value === 'NORMAL'}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="importance">Importance</label><select id="importance" name="importance">{#each data.taskImportances as opt}<option value={opt.value} selected={opt.value === 'NORMAL'}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="taskStatus">Status</label><select id="taskStatus" name="status">{#each data.taskStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        </div>

        <div class="grid two">
          <div class="field"><label for="dueAt">Due</label><input id="dueAt" name="dueAt" type="datetime-local" /></div>
          <div class="field"><label for="snoozedUntil">Snooze until</label><input id="snoozedUntil" name="snoozedUntil" type="datetime-local" /></div>
        </div>

        <div class="grid two">
          <div class="field"><label for="contactId">Attach person</label><select id="contactId" name="contactId"><option value="">No person</option>{#each data.options.contacts as c}<option value={c.id}>{c.name}</option>{/each}</select></div>
          <div class="field"><label for="dealId">Attach deal</label><select id="dealId" name="dealId"><option value="">No deal</option>{#each data.options.deals as d}<option value={d.id}>{d.title}</option>{/each}</select></div>
        </div>

        <div class="grid two">
          <div class="field"><label for="companyId">Attach company</label><select id="companyId" name="companyId"><option value="">No company</option>{#each data.options.companies as c}<option value={c.id}>{c.name}</option>{/each}</select></div>
          <div class="field"><label for="assignedToText">Assigned to text</label><input id="assignedToText" name="assignedToText" placeholder="e.g. me, Sam, accountant" /></div>
        </div>

        <div class="grid two">
          <div class="field"><label for="dealContactId">Attach deal-person thread</label><select id="dealContactId" name="dealContactId"><option value="">No specific person thread</option>{#each data.options.dealContacts as dc}<option value={dc.id}>{dc.title}</option>{/each}</select></div>
          <div class="field"><label for="dealCompanyId">Attach deal-company thread</label><select id="dealCompanyId" name="dealCompanyId"><option value="">No specific company thread</option>{#each data.options.dealCompanies as dc}<option value={dc.id}>{dc.title}</option>{/each}</select></div>
        </div>

        <div class="grid two">
          <div class="field"><label for="assignedToContactId">Assigned to contact</label><select id="assignedToContactId" name="assignedToContactId"><option value="">No assigned contact</option>{#each data.options.contacts as c}<option value={c.id}>{c.name}</option>{/each}</select></div>
          <div class="field"><label for="waitingOnContactId">Waiting on</label><select id="waitingOnContactId" name="waitingOnContactId"><option value="">Nobody external</option>{#each data.options.contacts as c}<option value={c.id}>{c.name}</option>{/each}</select></div>
        </div>

        <div class="field">
          <VoiceTextField
            id="taskNotes"
            textName="notes"
            summaryName="summary"
            label="Task notes"
            placeholder="Record or type the context, outcome, or next step."
            rows={4}
            bind:value={taskNotes}
            bind:summary={taskSummary}
            contextLabel="task note"
          />
        </div>

        <button class="btn primary" type="submit">Save task</button>
      </form>
    </section>
  {/if}

  <div class="grid main-grid">
    <section class="card panel">
      <h2>Related deals</h2>
      {#if data.relatedDeals.length === 0}
        <p class="muted">No deals are linked through project tasks yet.</p>
      {:else}
        <div class="chip-list">{#each data.relatedDeals as deal}<a class="chip" href={`/deals/${deal.id}`}>{deal.title}</a>{/each}</div>
      {/if}
    </section>

    <section class="card panel">
      <h2>Related people</h2>
      {#if data.relatedPeople.length === 0}
        <p class="muted">No people are linked through project tasks yet.</p>
      {:else}
        <div class="chip-list">{#each data.relatedPeople as person}<a class="chip" href={`/contacts/${person.id}`}>{person.name}</a>{/each}</div>
      {/if}
    </section>

    <section class="card panel">
      <h2>Related companies</h2>
      {#if data.relatedCompanies.length === 0}
        <p class="muted">No companies are linked through project tasks yet.</p>
      {:else}
        <div class="chip-list">{#each data.relatedCompanies as company}<a class="chip" href={`/companies/${company.id}`}>{company.name}</a>{/each}</div>
      {/if}
    </section>
  </div>

  <section class="card panel">
    <div class="section-head"><h2>Project tasks</h2><a class="btn" href="/tasks">Task inbox</a></div>
    {#if data.tasks.length === 0}
      <p class="muted">No tasks yet. Add a task to turn this project into an operating list.</p>
    {:else}
      <div class="task-list">
        {#each data.tasks as task}
          <article class="task-row {dueClass(task.dueAt, task.status)}">
            <div class="task-main">
              <div class="task-title-row"><strong>{task.title}</strong><span class="status-chip">{task.statusLabel}</span><span class="status-chip">{task.urgencyLabel}</span></div>
              <div class="muted small">{task.taskTypeLabel} - {task.importanceLabel} importance - due {fmt(task.dueAt)}</div>
              {#if task.notes}<p class="preline small">{task.notes}</p>{/if}
              {#if task.summary}<div class="summary-box"><div class="muted small">AI summary</div><p>{task.summary}</p></div>{/if}
              <div class="context-row">
                {#if task.contact}<a class="chip" href={`/contacts/${task.contact.id}`}>Person: {task.contact.name}</a>{/if}
                {#if task.deal}<a class="chip" href={`/deals/${task.deal.id}`}>Deal: {task.deal.title}</a>{/if}
                {#if task.company}<a class="chip" href={`/companies/${task.company.id}`}>Company: {task.company.name}</a>{/if}
                {#if task.dealContact}<a class="chip" href={`/deals/${task.dealContact.dealId}/relationships/${task.dealContact.id}`}>Person thread: {task.dealContact.contactName}</a>{/if}
                {#if task.dealCompany}<a class="chip" href={`/companies/${task.dealCompany.companyId}`}>Company thread: {task.dealCompany.companyName}</a>{/if}
                {#if task.waitingOnContact}<a class="chip" href={`/contacts/${task.waitingOnContact.id}`}>Waiting on: {task.waitingOnContact.name}</a>{/if}
                {#if task.assignedToContact}<a class="chip" href={`/contacts/${task.assignedToContact.id}`}>Assigned: {task.assignedToContact.name}</a>{/if}
              </div>
            </div>
            <div class="task-actions">
              <form method="post" action="?/updateTaskStatus">
                <input type="hidden" name="taskId" value={task.id} />
                <select name="status" on:change={submitContainingForm} aria-label="Update task status">{#each data.taskStatuses as opt}<option value={opt.value} selected={task.status === opt.value}>{opt.label}</option>{/each}</select>
              </form>
              <a class="btn" href={`/tasks/${task.id}/edit?returnTo=/projects/${data.project.id}`}>Edit</a>
              <form method="post" action="?/deleteTask" on:submit={(event) => { if (!confirm('Delete this task?')) event.preventDefault(); }}>
                <input type="hidden" name="taskId" value={task.id} />
                <button class="btn" type="submit">Delete</button>
              </form>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .project-header { padding: 18px; display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 12px; }
  .actions, .meta-row, .section-head, .context-row, .task-title-row, .chip-list { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  h1 { margin: 0; }
  h2 { margin: 0 0 10px; font-size: 1.1rem; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
  .stat { padding: 12px; display: grid; gap: 4px; }
  .stat strong { font-size: 1.5rem; }
  .panel, .error-card { padding: 14px; margin-bottom: 12px; }
  .error-card { color: var(--danger); }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grid.four { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .main-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .span2 { grid-column: 1 / span 2; }
  .preline { white-space: pre-wrap; }
  .task-list { display: grid; gap: 8px; }
  .task-row { border-top: 1px solid var(--border); padding: 12px 0; display: flex; justify-content: space-between; gap: 12px; }
  .task-row.overdue { border-color: var(--danger); }
  .task-main { min-width: 0; }
  .task-actions { display: grid; gap: 8px; align-content: start; min-width: 210px; }
  .status-chip, .chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 3px 9px; font-size: 0.85rem; color: var(--muted); }
  .chip { color: var(--text); text-decoration: none; }
  .summary-box { border: 1px solid var(--border); background: var(--panel); border-radius: 10px; padding: 10px; margin: 8px 0; }
  .summary-box p { margin: 4px 0 0; white-space: pre-wrap; }
  textarea { resize: vertical; }
  @media (max-width: 860px) {
    .project-header, .task-row, .section-head { flex-direction: column; }
    .summary-grid, .grid.two, .grid.four, .main-grid { grid-template-columns: 1fr; }
    .span2 { grid-column: auto; }
    .task-actions { min-width: 0; }
  }
</style>
