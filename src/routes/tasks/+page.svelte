<!-- src/routes/tasks/+page.svelte -->
<script lang="ts">
  // PURPOSE: Unified action inbox for tasks attached to contacts, deals, deal-contact threads, and projects.
  // SECURITY: All display values were prepared server side.

  import VoiceTextField from '$lib/recording/VoiceTextField.svelte';

  export let data: any;
  export let form: any;

  let showNewTask = false;
  let showNewProject = false;
  let q = data.q || '';
  let newTaskNotes = '';
  let newTaskSummary = '';
  let status = data.selectedStatus || '';
  let focus = data.selectedFocus || '';
  let projectId = data.selectedProjectId || '';
  let marketLeadId = data.selectedMarketLeadId || '';
  let contactId = data.selectedContactId || '';
  let companyId = data.selectedCompanyId || '';
  let dealId = data.selectedDealId || '';
  let sort = data.selectedSort || 'focus';

  function fmt(value: string | Date | null | undefined) {
    if (!value) return 'No date';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return 'No date';
    return d.toLocaleString();
  }

  function submitContainingForm(event: Event) {
    // IT: Status changes submit immediately so there is no confusing Update button.
    (event.currentTarget as HTMLSelectElement).form?.requestSubmit();
  }

  function dueClass(value: string | Date | null | undefined, statusValue: string) {
    if (!value || statusValue === 'DONE' || statusValue === 'CANCELLED') return '';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '';
    return d.getTime() < Date.now() ? 'overdue' : '';
  }
</script>

<div class="container">
  <div class="page-head">
    <div>
      <div class="eyebrow">Action system</div>
      <h1>Tasks</h1>
      <p class="muted">One inbox for follow-ups, reminders, deal steps, waiting items, and project work.</p>
    </div>
    <div class="head-actions">
      <button type="button" class="btn" on:click={() => (showNewProject = !showNewProject)}>{showNewProject ? 'Cancel project' : 'New project'}</button>
      <button type="button" class="btn primary" on:click={() => (showNewTask = !showNewTask)}>{showNewTask ? 'Cancel task' : '＋ New task'}</button>
    </div>
  </div>

  {#if form?.error}
    <div class="card error-card">{form.error}</div>
  {/if}

  <div class="summary-grid">
    <div class="card stat"><span>Open</span><strong>{data.summary.open}</strong></div>
    <div class="card stat"><span>New</span><strong>{data.summary.newTasks}</strong></div>
    <div class="card stat"><span>Doing now</span><strong>{data.summary.doingNow}</strong></div>
    <div class="card stat"><span>Overdue</span><strong>{data.summary.overdue}</strong></div>
    <div class="card stat"><span>Today</span><strong>{data.summary.today}</strong></div>
    <div class="card stat"><span>Waiting</span><strong>{data.summary.waiting}</strong></div>
  </div>

  {#if showNewProject}
    <div class="card panel">
      <h2>Create project</h2>
      <form method="post" action="?/createProject" class="grid two">
        <div class="field">
          <label for="projectTitle">Project title</label>
          <input id="projectTitle" name="projectTitle" placeholder="e.g. Broker network build" required />
        </div>
        <div class="field">
          <label for="projectStatus">Status</label>
          <select id="projectStatus" name="projectStatus">
            {#each data.projectStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}
          </select>
        </div>
        <div class="field span2">
          <label for="projectDescription">Description</label>
          <textarea id="projectDescription" name="projectDescription" rows="3" placeholder="What is this project for?"></textarea>
        </div>
        <div class="span2"><button class="btn primary" type="submit">Create project</button></div>
      </form>
    </div>
  {/if}

  {#if showNewTask}
    <div class="card panel">
      <h2>Create task</h2>
      <form method="post" action="?/create" class="task-form">
        <div class="field">
          <label for="title">Task</label>
          <input id="title" name="title" placeholder="e.g. Follow up Sam about Auspath investor list" required />
        </div>

        <div class="grid five">
          <div class="field">
            <label for="taskType">Type</label>
            <select id="taskType" name="taskType">{#each data.taskTypes as opt}<option value={opt.value}>{opt.label}</option>{/each}</select>
          </div>
          <div class="field">
            <label for="urgency">Urgency</label>
            <select id="urgency" name="urgency">{#each data.taskUrgencies as opt}<option value={opt.value} selected={opt.value === 'NORMAL'}>{opt.label}</option>{/each}</select>
          </div>
          <div class="field">
            <label for="importance">Importance</label>
            <select id="importance" name="importance">{#each data.taskImportances as opt}<option value={opt.value} selected={opt.value === 'NORMAL'}>{opt.label}</option>{/each}</select>
          </div>
          <div class="field">
            <label for="statusCreate">Status</label>
            <select id="statusCreate" name="status">{#each data.taskStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select>
          </div>
          <div class="field">
            <label for="focusCreate">Focus</label>
            <select id="focusCreate" name="focus">{#each data.taskFocusOptions as opt}<option value={opt.value} selected={opt.value === 'NEW'}>{opt.label}</option>{/each}</select>
          </div>
        </div>

        <div class="grid two">
          <div class="field">
            <label for="dueAt">Due</label>
            <input id="dueAt" name="dueAt" type="datetime-local" />
          </div>
          <div class="field">
            <label for="snoozedUntil">Snooze until</label>
            <input id="snoozedUntil" name="snoozedUntil" type="datetime-local" />
          </div>
        </div>

        <div class="grid two">
          <div class="field">
            <label for="contactId">Attach person</label>
            <select id="contactId" name="contactId">
              <option value="">No person</option>
              {#each data.options.contacts as c}<option value={c.id}>{c.name}</option>{/each}
            </select>
          </div>
          <div class="field">
            <label for="dealId">Attach deal</label>
            <select id="dealId" name="dealId">
              <option value="">No deal</option>
              {#each data.options.deals as d}<option value={d.id}>{d.title}</option>{/each}
            </select>
          </div>
        </div>

        <div class="grid two">
          <div class="field">
            <label for="companyId">Attach company</label>
            <select id="companyId" name="companyId">
              <option value="">No company</option>
              {#each data.options.companies as c}<option value={c.id}>{c.name}</option>{/each}
            </select>
          </div>
          <div class="field">
            <label for="projectId">Attach project</label>
            <select id="projectId" name="projectId">
              <option value="">No project</option>
              {#each data.options.projects as p}<option value={p.id}>{p.title}</option>{/each}
            </select>
          </div>
        </div>

        <div class="field">
          <label for="marketLeadId">Attach lead</label>
          <select id="marketLeadId" name="marketLeadId">
            <option value="">No lead</option>
            {#each data.options.marketLeads as lead}<option value={lead.id}>{lead.title} - {lead.statusLabel}</option>{/each}
          </select>
          <p class="hint">Selecting a lead can also inherit its project, contact, company, or deal links.</p>
        </div>

        <div class="grid two">
          <div class="field">
            <label for="dealContactId">Attach deal-person thread</label>
            <select id="dealContactId" name="dealContactId">
              <option value="">No specific deal relationship</option>
              {#each data.options.dealContacts as dc}<option value={dc.id}>{dc.title}</option>{/each}
            </select>
            <p class="hint">Selecting this also sets the related person and deal.</p>
          </div>
          <div class="field">
            <label for="dealCompanyId">Attach deal-company thread</label>
            <select id="dealCompanyId" name="dealCompanyId">
              <option value="">No specific deal-company relationship</option>
              {#each data.options.dealCompanies as dc}<option value={dc.id}>{dc.title}</option>{/each}
            </select>
            <p class="hint">Selecting this also sets the related company and deal.</p>
          </div>
        </div>

        <div class="grid two">
          <div class="field">
            <label for="assignedToContactId">Assigned to contact</label>
            <select id="assignedToContactId" name="assignedToContactId">
              <option value="">No assigned contact</option>
              {#each data.options.contacts as c}<option value={c.id}>{c.name}</option>{/each}
            </select>
          </div>
          <div class="field">
            <label for="waitingOnContactId">Waiting on</label>
            <select id="waitingOnContactId" name="waitingOnContactId">
              <option value="">Nobody external</option>
              {#each data.options.contacts as c}<option value={c.id}>{c.name}</option>{/each}
            </select>
          </div>
        </div>

        <div class="field">
          <label for="assignedToText">Assigned to text</label>
          <input id="assignedToText" name="assignedToText" placeholder="e.g. me, Sam, accountant, vendor" />
        </div>

        <div class="field">
          <VoiceTextField
            id="notes"
            textName="notes"
            summaryName="summary"
            label="Task notes"
            placeholder="Record or type the context, outcome, or next step."
            rows={4}
            bind:value={newTaskNotes}
            bind:summary={newTaskSummary}
            contextLabel="task note"
          />
        </div>

        <button class="btn primary" type="submit">Save task</button>
      </form>
    </div>
  {/if}

  <div class="card filters">
    <form method="GET" class="filter-grid">
      <div class="field span2">
        <label for="taskSearch">Search</label>
        <input id="taskSearch" name="q" bind:value={q} placeholder="Search tasks, people, deals, projects, leads" />
      </div>
      <div class="field">
        <label for="statusFilter">Status</label>
        <select id="statusFilter" name="status" bind:value={status}>
          <option value="">Active</option>
          <option value="ALL">All</option>
          {#each data.taskStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="focusFilter">Focus</label>
        <select id="focusFilter" name="focus" bind:value={focus}>
          <option value="">Any focus</option>
          {#each data.taskFocusOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="sortFilter">Sort</label>
        <select id="sortFilter" name="sort" bind:value={sort}>
          {#each data.taskSortOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="projectFilter">Project</label>
        <select id="projectFilter" name="projectId" bind:value={projectId}>
          <option value="">Any project</option>
          {#each data.options.projects as p}<option value={p.id}>{p.title}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="leadFilter">Lead</label>
        <select id="leadFilter" name="marketLeadId" bind:value={marketLeadId}>
          <option value="">Any lead</option>
          {#each data.options.marketLeads as lead}<option value={lead.id}>{lead.title}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="contactFilter">Person</label>
        <select id="contactFilter" name="contactId" bind:value={contactId}>
          <option value="">Any person</option>
          {#each data.options.contacts as c}<option value={c.id}>{c.name}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="companyFilter">Company</label>
        <select id="companyFilter" name="companyId" bind:value={companyId}>
          <option value="">Any company</option>
          {#each data.options.companies as c}<option value={c.id}>{c.name}</option>{/each}
        </select>
      </div>
      <div class="field">
        <label for="dealFilter">Deal</label>
        <select id="dealFilter" name="dealId" bind:value={dealId}>
          <option value="">Any deal</option>
          {#each data.options.deals as d}<option value={d.id}>{d.title}</option>{/each}
        </select>
      </div>
      <div class="filter-actions">
        <button class="btn primary" type="submit">Apply filters</button>
        <a class="btn" href="/tasks">Clear</a>
      </div>
    </form>
  </div>

  {#if data.tasks.length === 0}
    <div class="card empty">
      <h2>No tasks found</h2>
      <p class="muted">Create a task from here, or from a person, deal, or deal-person thread.</p>
    </div>
  {:else}
    <div class="task-list">
      {#each data.tasks as task}
        <article class="card task-card {dueClass(task.dueAt, task.status)}">
          <div class="task-main">
            <div class="task-title-row">
              <h2>{task.title}</h2>
              <span class="status-chip">{task.statusLabel}</span>
              <span class="status-chip">{task.urgencyLabel}</span>
              <span class="status-chip">{task.focusLabel}</span>
            </div>
            <div class="muted small">
              {task.taskTypeLabel} - {task.importanceLabel} importance - due {fmt(task.dueAt)}
            </div>

            {#if task.notes}<p class="preline">{task.notes}</p>{/if}
            {#if task.summary}<div class="summary-box"><div class="muted small">AI summary</div><p>{task.summary}</p></div>{/if}

            <div class="context-row">
              {#if task.contact}<a class="chip" href={`/contacts/${task.contact.id}`}>Person: {task.contact.name}</a>{/if}
              {#if task.deal}<a class="chip" href={`/deals/${task.deal.id}`}>Deal: {task.deal.title}</a>{/if}
              {#if task.company}<a class="chip" href={`/companies/${task.company.id}`}>Company: {task.company.name}</a>{/if}
              {#if task.dealContact}<a class="chip" href={`/deals/${task.dealContact.dealId}/relationships/${task.dealContact.id}`}>Person thread: {task.dealContact.contactName}</a>{/if}
              {#if task.dealCompany}<a class="chip" href={`/companies/${task.dealCompany.companyId}`}>Company thread: {task.dealCompany.companyName}</a>{/if}
              {#if task.project}<a class="chip" href={`/projects/${task.project.id}`}>Project: {task.project.title}</a>{/if}
              {#if task.marketLead}<a class="chip" href={`/leads/${task.marketLead.id}`}>Lead: {task.marketLead.title}</a>{/if}
              {#if task.waitingOnContact}<a class="chip" href={`/contacts/${task.waitingOnContact.id}`}>Waiting on: {task.waitingOnContact.name}</a>{/if}
              {#if task.assignedToContact}<a class="chip" href={`/contacts/${task.assignedToContact.id}`}>Assigned: {task.assignedToContact.name}</a>{/if}
              {#if task.assignedToText}<span class="chip">Assigned: {task.assignedToText}</span>{/if}
            </div>
          </div>

          <div class="task-actions">
            <form method="post" action="?/updateStatus">
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="returnTo" value={data.currentPath} />
              <select name="status" aria-label="Update status" on:change={submitContainingForm}>
                {#each data.taskStatuses as opt}<option value={opt.value} selected={task.status === opt.value}>{opt.label}</option>{/each}
              </select>
            </form>
            <form method="post" action="?/updateFocus">
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="returnTo" value={data.currentPath} />
              <select name="focus" aria-label="Update focus" on:change={submitContainingForm}>
                {#each data.taskFocusOptions as opt}<option value={opt.value} selected={task.focus === opt.value}>{opt.label}</option>{/each}
              </select>
            </form>
            <a class="btn" href={`/tasks/${task.id}/edit`}>Edit</a>
            <form method="post" action="?/delete" on:submit={(event) => { if (!confirm('Delete this task?')) event.preventDefault(); }}>
              <input type="hidden" name="taskId" value={task.id} />
              <input type="hidden" name="returnTo" value={data.currentPath} />
              <button class="btn" type="submit">Delete</button>
            </form>
          </div>
        </article>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 14px; }
  .head-actions, .filter-row, .context-row, .task-title-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .filter-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; align-items: end; }
  .filter-actions { display: flex; gap: 8px; align-items: center; }
  h1 { margin: 0; }
  h2 { margin: 0; font-size: 1.1rem; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .hint { color: var(--muted); font-size: 0.82rem; margin: 4px 0 0; }
  .small { font-size: 0.9rem; }
  .summary-grid { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; margin-bottom: 12px; }
  .stat { padding: 12px; display: grid; gap: 4px; }
  .stat span { color: var(--muted); font-size: 0.9rem; }
  .stat strong { font-size: 1.5rem; }
  .panel, .filters, .error-card { padding: 14px; margin-bottom: 12px; }
  .error-card { color: var(--danger); }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grid.four { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .grid.five { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
  .span2 { grid-column: 1 / span 2; }
  .task-list { display: grid; gap: 10px; }
  .task-card { padding: 14px; display: flex; justify-content: space-between; gap: 16px; }
  .task-card.overdue { border-color: var(--danger); }
  .task-main { min-width: 0; }
  .task-actions { min-width: 220px; display: grid; gap: 8px; align-content: start; }
  .task-actions form { display: flex; gap: 6px; align-items: center; }
  .task-actions select { min-width: 130px; }
  .summary-box { border: 1px solid var(--border); background: var(--panel); border-radius: 10px; padding: 10px; margin: 8px 0; }
  .summary-box p { margin: 4px 0 0; white-space: pre-wrap; }
  .status-chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 3px 8px; font-size: 0.82rem; color: var(--muted); }
  .chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 3px 9px; font-size: 0.85rem; color: var(--text); }
  .preline { white-space: pre-wrap; }
  .empty { padding: 24px; text-align: center; }
  textarea { resize: vertical; }
  @media (max-width: 860px) {
    .page-head, .task-card, .filter-row { flex-direction: column; align-items: stretch; }
    .summary-grid, .filter-grid, .grid.two, .grid.four, .grid.five { grid-template-columns: 1fr; }
    .span2 { grid-column: auto; }
    .task-actions { min-width: 0; }
  }
</style>
