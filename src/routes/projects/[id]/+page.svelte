<!-- src/routes/projects/[id]/+page.svelte -->
<script lang="ts">
  // PURPOSE: Project command-centre page for tasks, people, deals, waiting items, and next actions.
  // SECURITY: All data has been tenant-filtered and decrypted server side.

  import VoiceTextField from '$lib/recording/VoiceTextField.svelte';
  import OffersPanel from '$lib/OffersPanel.svelte';
  import WantsPanel from '$lib/WantsPanel.svelte';
  import AgentBriefingsPanel from '$lib/AgentBriefingsPanel.svelte';
  import NotesPanel from '$lib/NotesPanel.svelte';
  import TasksPanel from '$lib/TasksPanel.svelte';
  import { closeDatePickerOnChange } from '$lib/closeDatePicker';

  export let data: any;
  export let form: any;

  $: projectNotesForPanel = (data.projectNotes || []).map((note: any) => ({
    ...note,
    withLabel: note.workstream ? note.workstream.name : null
  }));

  let showEdit = false;
  let showNewLead = false;
  let showNewWorkstream = false;
  let projectNoteText = '';
  let projectNoteSummary = '';
  let projectLeadSourceChoice = 'builtin:MANUAL';
  $: leadTaskOptions = (data.options.marketLeads || []).filter((lead: any) => !lead.projectId || lead.projectId === data.project.id);

  function fmt(value: string | Date | null | undefined) {
    if (!value) return 'No date';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return 'No date';
    return d.toLocaleString();
  }

  function closeContainingDetails(event: Event) {
    const details = (event.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null;
    if (details) details.open = false;
  }

  function sectionFor(workstreamId: string) {
    return (data.workstreamSections || []).find((section: any) => section.id === workstreamId) || { leads: [], tasks: [], deals: [], notes: [] };
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
      <button class="btn" type="button" on:click={() => (showNewWorkstream = !showNewWorkstream)}>{showNewWorkstream ? 'Cancel workstream' : '＋ Workstream'}</button>
      <button class="btn primary" type="button" on:click={() => (showNewLead = !showNewLead)}>{showNewLead ? 'Cancel lead' : '＋ New lead'}</button>
      <a class="btn" href="/projects">All projects</a>
      <form method="post" action="?/archiveProject" on:submit={(event) => { if (!confirm('Archive this project? It will be hidden from active lists but records remain linked.')) event.preventDefault(); }}><button class="btn" type="submit">Archive</button></form>
      <form method="post" action="?/deleteProject" on:submit={(event) => { if (!confirm('Delete this project and its project notes/project-deal links? Contacts, companies, deals, leads and tasks will remain but lose the project link.')) event.preventDefault(); }}><button class="btn danger" type="submit">Delete</button></form>
    </div>
  </div>

  {#if form?.error}<div class="card error-card">{form.error}</div>{/if}

  <div id="project-wants"><WantsPanel items={data.wants ?? []} entityLabel={data.project.title} /></div>

    <div id="project-offers"><OffersPanel items={data.exchangeItems ?? []} createAction="?/createExchangeItem" deleteAction="?/deleteExchangeItem" deleteFieldName="exchangeItemId" entityLabel={data.project.title} /></div>

  <AgentBriefingsPanel entityType="project" entityId={data.project.id} entityLabel={data.project.title} artifacts={data.agentArtifacts ?? []} />

  <div class="summary-grid">
    <a class="card stat" href={`/tasks?projectId=${data.project.id}`}><span>Active</span><strong>{data.summary.active}</strong></a>
    <a class="card stat" href={`/tasks?projectId=${data.project.id}&due=overdue&sort=due_asc`}><span>Overdue</span><strong>{data.summary.overdue}</strong></a>
    <a class="card stat" href={`/tasks?projectId=${data.project.id}&status=WAITING`}><span>Waiting</span><strong>{data.summary.waiting}</strong></a>
    <a class="card stat" href={`/tasks?projectId=${data.project.id}&status=DONE`}><span>Completed</span><strong>{data.summary.completed}</strong></a>
    <a class="card stat" href="#project-leads"><span>Leads</span><strong>{data.summary.leads}</strong></a>
    <a class="card stat" href="#project-deals"><span>Deals</span><strong>{data.summary.deals}</strong></a>
    <a class="card stat" href="#project-workstreams"><span>Workstreams</span><strong>{data.summary.workstreams}</strong></a>
    <a class="card stat" href="#project-leads"><span>Qualified leads</span><strong>{data.summary.readyLeads}</strong></a>
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

  {#if showNewWorkstream}
    <section class="card panel">
      <h2>New workstream</h2>
      <form method="post" action="?/createWorkstream" class="grid two">
        <div class="field"><label for="workstreamName">Name</label><input id="workstreamName" name="name" placeholder="e.g. Buyer mandates, Seller outreach, Referrers" required /></div>
        <div class="field span2"><label for="workstreamDescription">Description</label><textarea id="workstreamDescription" name="description" rows="2"></textarea></div>
        <div class="span2"><button class="btn primary" type="submit">Create workstream</button></div>
      </form>
    </section>
  {/if}

  <section id="project-workstreams" class="card panel">
    <div class="section-head"><h2>Workstreams</h2><button class="btn" type="button" on:click={() => (showNewWorkstream = !showNewWorkstream)}>{showNewWorkstream ? 'Cancel workstream' : '＋ Add workstream'}</button></div>
    <p class="muted small">Use workstreams as lanes inside this project, such as Buyer mandates, Seller outreach, Referrer outreach, Research, or Active deals.</p>
    {#if data.workstreams?.length}
      <div class="workstream-grid">
        {#each data.workstreams as ws}
          <div class="workstream-card">
            <a class="workstream-card-main" href={`/projects/${data.project.id}/workstreams/${ws.id}`}>
              <strong>{ws.name}</strong>
              <div class="muted small">{ws.status}</div>
              {#if ws.description}<p class="preline small">{ws.description}</p>{/if}
              <div class="mini-stats">
                <span>{sectionFor(ws.id).leads.length} leads</span>
                <span>{sectionFor(ws.id).tasks.length} tasks</span>
                <span>{sectionFor(ws.id).deals.length} deals</span>
                <span>{sectionFor(ws.id).notes.length} notes</span>
              </div>
            </a>
            <div class="actions">
              <a class="btn primary" href={`/projects/${data.project.id}/workstreams/${ws.id}`}>Open</a>
              <form method="post" action="?/archiveWorkstream" on:submit={(event) => { if (!confirm('Archive this workstream? Linked items will keep their project but lose the active workstream lane.')) event.preventDefault(); }}>
                <input type="hidden" name="workstreamId" value={ws.id} />
                <button class="btn" type="submit">Archive</button>
              </form>
              <form method="post" action="?/deleteWorkstream" on:submit={(event) => { if (!confirm('Delete this workstream? Linked leads, tasks, notes and deals will remain but lose the workstream link.')) event.preventDefault(); }}>
                <input type="hidden" name="workstreamId" value={ws.id} />
                <button class="btn danger" type="submit">Delete</button>
              </form>
            </div>
          </div>
        {/each}
      </div>
    {:else}
      <p class="muted">No workstreams yet.</p>
    {/if}
  </section>


  {#if showNewLead}
    <section class="card panel">
      <h2>New project lead</h2>
      <form method="post" action="?/createProjectLead">
        <div class="grid two">
          <div class="field"><label for="leadTitle">Lead title</label><input id="leadTitle" name="title" placeholder="e.g. Bayside broker principal to research" /></div>
          <div class="field"><label for="leadType">Lead type</label><select id="leadType" name="type">{#each data.marketLeadTypes as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid three">
          <div class="field"><label for="leadStatus">Status</label><select id="leadStatus" name="status">{#each data.marketLeadStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="projectLeadSourceChoice">Source</label><select id="projectLeadSourceChoice" name="sourceChoice" bind:value={projectLeadSourceChoice}>{#each data.marketLeadSourceOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="leadPriority">Priority 1-5</label><input id="leadPriority" name="priority" type="number" min="1" max="5" value="3" /></div>
        </div>
        {#if projectLeadSourceChoice === 'CUSTOM'}
          <div class="field"><label for="projectNewLeadSource">Custom source</label><input id="projectNewLeadSource" name="newLeadSource" placeholder="e.g. Sam spreadsheet, aged-care consultant list" /></div>
        {/if}
        <div class="field"><label for="leadWorkstreamId">Workstream</label><select id="leadWorkstreamId" name="workstreamId"><option value="">No workstream</option>{#each data.workstreams as ws}<option value={ws.id}>{ws.name}</option>{/each}</select></div>
        <div class="grid two">
          <div class="field"><label for="leadName">Person name</label><input id="leadName" name="name" /></div>
          <div class="field"><label for="leadCompanyName">Company name</label><input id="leadCompanyName" name="companyName" /></div>
        </div>
        <div class="grid two">
          <div class="field"><label for="leadPhone">Phone</label><input id="leadPhone" name="phone" /></div>
          <div class="field"><label for="leadEmail">Email</label><input id="leadEmail" name="email" type="email" /></div>
        </div>
        <div class="field"><label for="projectLeadAddress">Address</label><input id="projectLeadAddress" name="address" /></div>
        <div class="field"><label for="leadDescription">Description</label><textarea id="leadDescription" name="description" rows="3" placeholder="Capture the rough signal, source, or hypothesis."></textarea></div>
        <div class="field"><label for="leadNextAction">Next action</label><input id="leadNextAction" name="nextAction" placeholder="e.g. Find principal and direct phone" /></div>
        <button class="btn primary" type="submit">Save lead</button>
      </form>
    </section>
  {/if}

  <section class="card panel">
    <details open>
      <summary><strong>Project notes</strong></summary>
      <form method="post" action="?/createProjectNote" class="nested-form">
        <div class="field"><label for="projectNoteWorkstreamId">Workstream</label><select id="projectNoteWorkstreamId" name="workstreamId"><option value="">No workstream</option>{#each data.workstreams as ws}<option value={ws.id}>{ws.name}</option>{/each}</select></div>
        <VoiceTextField
          id="projectNote"
          textName="body"
          summaryName="summary"
          label="Add project note"
          placeholder="Record or type project context, decisions, conversations, or next steps."
          rows={4}
          bind:value={projectNoteText}
          bind:summary={projectNoteSummary}
          contextLabel="project note"
        />
        <button class="btn primary" type="submit">Save note</button>
      </form>
      <NotesPanel notes={projectNotesForPanel} emptyMessage="No project notes yet.">
        <svelte:fragment slot="actions" let:note>
          <details class="edit-box">
            <summary>Edit note</summary>
            <form method="post" action="?/updateProjectNote" class="nested-form">
              <input type="hidden" name="noteId" value={note.id} />
              <div class="field"><label for={`project-note-occurred-${note.id}`}>Note date</label><input id={`project-note-occurred-${note.id}`} name="occurredAt" type="datetime-local" value={note.occurredAtInput} on:change={closeDatePickerOnChange} /></div>
              <div class="field"><label for={`project-note-body-${note.id}`}>Note</label><textarea id={`project-note-body-${note.id}`} name="body" rows="4" required>{note.body}</textarea></div>
              <div class="field"><label for={`project-note-summary-${note.id}`}>Summary</label><input id={`project-note-summary-${note.id}`} name="summary" value={note.summary} /></div>
              <div class="row-actions"><button class="btn primary" type="submit">Save note</button><button class="btn" type="button" on:click={closeContainingDetails}>Cancel</button></div>
            </form>
          </details>
          <form method="post" action="?/deleteProjectNote" on:submit={(event) => { if (!confirm('Delete this project note?')) event.preventDefault(); }}>
            <input type="hidden" name="noteId" value={note.id} />
            <button class="btn" type="submit">Delete</button>
          </form>
        </svelte:fragment>
      </NotesPanel>
    </details>
  </section>


  <section id="project-leads" class="card panel">
    <div class="section-head"><h2>Project leads</h2><button class="btn" type="button" on:click={() => (showNewLead = !showNewLead)}>{showNewLead ? 'Cancel lead' : '＋ Add lead'}</button></div>
    {#if data.projectLeads?.length}
      <div class="lead-list">
        {#each data.projectLeads as lead}
          <a class="lead-row" href={`/leads/${lead.id}`}>
            <div>
              <strong>{lead.title}</strong>
              <div class="muted small">{lead.typeLabel} - {lead.statusLabel} - priority {lead.priority} - confidence {lead.confidence}/100</div>
              <div class="muted small">Contact: {lead.contactAttemptStatusLabel} - Buyer: {lead.buyerStatusLabel} - Seller: {lead.sellerStatusLabel}</div>
              {#if lead.name || lead.companyName}<div class="muted small">{lead.name}{lead.name && lead.companyName ? ' - ' : ''}{lead.companyName}</div>{/if}
              {#if lead.workstream}<div class="muted small">Workstream: {lead.workstream.name}</div>{/if}
              {#if lead.nextAction}<div class="small">Next: {lead.nextAction}</div>{/if}
            </div>
            <span class="status-chip">Open</span>
          </a>
        {/each}
      </div>
    {:else}
      <p class="muted">No project leads yet. Add raw names, companies, mandates, or market signals here before they become contacts, companies, wants, offers, or deals.</p>
    {/if}
  </section>

  <section id="project-deals" class="card panel">
    <div class="section-head">
      <h2>Linked deals</h2>
      <a class="btn" href={`/deals/new?projectId=${data.project.id}`}>＋ New deal</a>
    </div>
    <p class="muted small">These deals belong directly to this project. Tasks can still be attached separately as next actions.</p>

    <form method="post" action="?/linkDeal" class="nested-form grid two">
      <div class="field">
        <label for="projectDealId">Add existing deal</label>
        <select id="projectDealId" name="dealId" required>
          <option value="">Choose deal</option>
          {#each data.dealOptionsForLinking as deal}<option value={deal.id}>{deal.title}</option>{/each}
        </select>
      </div>
      <div class="field"><label for="projectDealWorkstreamId">Workstream</label><select id="projectDealWorkstreamId" name="workstreamId"><option value="">No workstream</option>{#each data.workstreams as ws}<option value={ws.id}>{ws.name}</option>{/each}</select></div>
      <div class="field"><label for="projectDealLabel">Label</label><input id="projectDealLabel" name="label" placeholder="e.g. core deal, seller-side, buyer mandate" /></div>
      <div class="field span2"><label for="projectDealNotes">Notes</label><textarea id="projectDealNotes" name="notes" rows="2" placeholder="Why this deal belongs in the project"></textarea></div>
      <div class="span2"><button class="btn primary" type="submit">Link deal</button></div>
    </form>

    {#if data.linkedDeals?.length}
      <div class="lead-list">
        {#each data.linkedDeals as link}
          <div class="lead-row">
            <div>
              <strong><a href={`/deals/${link.dealId}`}>{link.title}</a></strong>
              <div class="muted small">{link.status}{link.probability === null || link.probability === undefined ? '' : ` - ${link.probability}% chance`}{#if link.workstream} - {link.workstream.name}{/if}</div>
              {#if link.label}<div class="small">{link.label}</div>{/if}
              {#if link.notes}<p class="preline small">{link.notes}</p>{/if}
            </div>
            <form method="post" action="?/removeProjectDeal" on:submit={(event) => { if (!confirm('Remove this deal from the project? The deal itself will not be deleted.')) event.preventDefault(); }}>
              <input type="hidden" name="linkId" value={link.id} />
              <button class="btn" type="submit">Remove link</button>
            </form>
          </div>
        {/each}
      </div>
    {:else}
      <p class="muted">No deals are directly linked yet. Link an existing deal or create a new one from this project.</p>
    {/if}
  </section>

  <div class="grid main-grid">
    <section class="card panel">
      <h2>Task-linked deals</h2>
      {#if data.relatedDeals.length === 0}
        <p class="muted">No extra deals are appearing through project tasks yet.</p>
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
    <h2>Workstream board</h2>
    <p class="muted small">A project-level view of the leads, tasks, deals and notes in each lane.</p>
    <div class="workstream-board">
      {#each data.workstreamSections as section}
        <details class="workstream-section" open={section.id !== ''}>
          <summary><strong>{section.name}</strong> <span class="muted small">{section.leads.length} leads - {section.tasks.length} tasks - {section.deals.length} deals - {section.notes.length} notes</span>{#if section.id}<a class="btn tiny" href={`/projects/${data.project.id}/workstreams/${section.id}`}>Open</a>{/if}</summary>
          {#if section.leads.length}<div class="chip-list">{#each section.leads as lead}<a class="chip" href={`/leads/${lead.id}`}>{lead.title}</a>{/each}</div>{/if}
          {#if section.deals.length}<div class="chip-list">{#each section.deals as deal}<a class="chip" href={`/deals/${deal.dealId}`}>Deal: {deal.title}</a>{/each}</div>{/if}
          {#if section.tasks.length}<div class="chip-list">{#each section.tasks as task}<a class="chip" href={`/tasks/${task.id}`}>Task: {task.title}</a>{/each}</div>{/if}
          {#if !section.leads.length && !section.tasks.length && !section.deals.length && !section.notes.length}<p class="muted small">No items yet.</p>{/if}
        </details>
      {/each}
    </div>
  </section>

  <div id="project-tasks"><TasksPanel
    tasks={data.tasks}
    heading="Project tasks"
    emptyMessage="No tasks yet. Add a task to turn this project into an operating list."
    taskTypeOptions={data.taskTypes}
    taskStatusOptions={data.taskStatuses}
    taskUrgencyOptions={data.taskUrgencies}
    taskImportanceOptions={data.taskImportances}
    taskFocusOptions={data.taskFocusOptions}
    editReturnTo={`/projects/${data.project.id}`}
    showDelete
    inboxHref="/tasks"
    inboxLabel="Task inbox"
    lockedProjectId={data.project.id}
    contactOptions={data.options.contacts}
    dealOptions={data.options.deals}
    companyOptions={data.options.companies}
    workstreamOptions={data.taskWorkstreamOptions}
    marketLeadOptions={leadTaskOptions}
    dealContactOptions={data.options.dealContacts}
    dealCompanyOptions={data.options.dealCompanies}
  /></div>
</div>

<style>
  .project-header { padding: 18px; display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 12px; }
  .actions, .meta-row, .section-head, .chip-list { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  h1 { margin: 0; }
  h2 { margin: 0 0 10px; font-size: 1.1rem; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  details summary { cursor: pointer; margin-bottom: 10px; }
  .nested-form { border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin: 10px 0; background: var(--panel); }
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 12px; }
  .summary-grid .stat { color: var(--text); text-decoration: none; }
  .summary-grid .stat:hover { border-color: var(--accent); text-decoration: none; }
  .stat { padding: 12px; display: grid; gap: 4px; }
  .stat strong { font-size: 1.5rem; }
  .panel, .error-card { padding: 14px; margin-bottom: 12px; }
  .error-card { color: var(--danger); }
  .btn.danger { background:#b00020; color:#fff; border-color:#b00020; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grid.three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .main-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .span2 { grid-column: 1 / span 2; }
  .preline { white-space: pre-wrap; }
  .mini-list, .lead-list, .workstream-board { display: grid; gap: 8px; }
  .workstream-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; }
  .workstream-card, .workstream-section { border: 1px solid var(--border); border-radius: 12px; padding: 12px; background: var(--panel); }
  .workstream-card-main { display: grid; gap: 4px; color: var(--text); text-decoration: none; margin-bottom: 10px; }
  .mini-stats { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; }
  .mini-stats span { border: 1px solid var(--border); border-radius: 999px; padding: 2px 8px; color: var(--muted); font-size: 0.85rem; }
  .btn.tiny { padding: 3px 8px; font-size: 0.8rem; margin-left: 8px; }
  .lead-row { display: flex; justify-content: space-between; gap: 12px; border-top: 1px solid var(--border); padding: 12px 0; color: var(--text); text-decoration: none; }
  .mini-row { border-top: 1px solid var(--border); padding: 12px 0; display: flex; justify-content: space-between; gap: 12px; }
  .status-chip, .chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 3px 9px; font-size: 0.85rem; color: var(--muted); }
  .chip { color: var(--text); text-decoration: none; }
  .edit-box { margin-top: 8px; }
  .row-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  textarea { resize: vertical; }
  @media (max-width: 860px) {
    .project-header, .section-head, .mini-row { flex-direction: column; }
    .summary-grid, .grid.two, .grid.three, .main-grid { grid-template-columns: 1fr; }
    .span2 { grid-column: auto; }
  }
</style>
