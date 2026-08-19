<!-- src/routes/projects/[id]/workstreams/[workstreamId]/+page.svelte -->
<script lang="ts">
  import VoiceTextField from '$lib/recording/VoiceTextField.svelte';

  export let data: any;
  export let form: any;

  let showEdit = false;
  let showNewLead = false;
  let showAttachLead = false;
  let showNewTask = false;
  let showNewNote = false;
  let showLinkDeal = false;
  let leadSourceChoice = 'builtin:MANUAL';
  let attachLeadSearch = '';
  let taskNotes = '';
  let taskSummary = '';
  let noteBody = '';
  let noteSummary = '';

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

  function money(cents: number | null | undefined, currency = 'AUD') {
    if (cents === null || cents === undefined) return '';
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 0 }).format(cents / 100);
  }

  function submitContainingForm(event: Event) {
    (event.currentTarget as HTMLSelectElement).form?.requestSubmit();
  }

  $: filteredAttachableLeads = (data.options.attachableLeads || []).filter((lead: any) => {
    const term = attachLeadSearch.trim().toLowerCase();
    if (!term) return true;
    return [lead.title, lead.typeLabel, lead.statusLabel, lead.projectTitle, lead.workstreamName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(term);
  });

  function leadSourceValue(values: any) {
    if (values?.leadSourceId) return `custom:${values.leadSourceId}`;
    if (values?.sourceChoice && values.sourceChoice !== 'CUSTOM') return values.sourceChoice;
    return `builtin:${values?.source || 'MANUAL'}`;
  }

</script>

<div class="container">
  <div class="card header-card">
    <div>
      <div class="eyebrow">Workstream</div>
      <h1>{data.workstream.name}</h1>
      <div class="meta-row">
        <a href={`/projects/${data.project.id}`}>{data.project.title}</a>
        <span class="status-chip">{data.workstream.status}</span>
        <span>Updated {fmt(data.workstream.updatedAt)}</span>
      </div>
      {#if data.workstream.description}<p class="preline">{data.workstream.description}</p>{/if}
    </div>
    <div class="actions">
      <button class="btn" type="button" on:click={() => (showEdit = !showEdit)}>{showEdit ? 'Close edit' : 'Edit'}</button>
      <button class="btn primary" type="button" on:click={() => (showNewTask = !showNewTask)}>{showNewTask ? 'Cancel task' : '＋ Task'}</button>
      <button class="btn primary" type="button" on:click={() => (showNewLead = !showNewLead)}>{showNewLead ? 'Cancel lead' : '＋ Lead'}</button>
      <button class="btn" type="button" on:click={() => (showNewNote = !showNewNote)}>{showNewNote ? 'Cancel note' : '＋ Note'}</button>
      <button class="btn" type="button" on:click={() => (showLinkDeal = !showLinkDeal)}>{showLinkDeal ? 'Cancel deal' : 'Link deal'}</button>
      <a class="btn" href={`/projects/${data.project.id}`}>Back to project</a>
    </div>
  </div>

  {#if form?.error && !form?.duplicateLeadWarning}<div class="card error-card">{form.error}</div>{/if}

  {#if form?.duplicateLeadWarning}
    <section class="card warning-card">
      <h2>Possible existing lead</h2>
      <p>{form.error}</p>
      <div class="lead-list">
        {#each form.duplicateLeads as lead}
          <div class="lead-row">
            <div>
              <strong>{lead.title}</strong>
              <div class="muted small">{lead.typeLabel} - {lead.statusLabel}{#if lead.project} - Project: {lead.project.title}{/if}{#if lead.workstream} - Workstream: {lead.workstream.name}{/if}</div>
              {#if lead.name || lead.companyName}<div class="small">{lead.name}{lead.name && lead.companyName ? ' - ' : ''}{lead.companyName}</div>{/if}
              {#if lead.email || lead.phone}<div class="muted small">{lead.email}{lead.email && lead.phone ? ' - ' : ''}{lead.phone}</div>{/if}
            </div>
            <a class="btn" href={`/leads/${lead.id}`} target="_blank" rel="noreferrer">Open lead</a>
          </div>
        {/each}
      </div>
      <form method="post" action="?/createLead" class="duplicate-confirm-form">
        <input type="hidden" name="forceCreate" value="1" />
        <input type="hidden" name="title" value={form.leadValues.title} />
        <input type="hidden" name="type" value={form.leadValues.type} />
        <input type="hidden" name="status" value={form.leadValues.status} />
        <input type="hidden" name="sourceChoice" value={leadSourceValue(form.leadValues)} />
        <input type="hidden" name="leadSourceId" value={form.leadValues.leadSourceId} />
        <input type="hidden" name="newLeadSource" value={form.leadValues.newLeadSource} />
        <input type="hidden" name="name" value={form.leadValues.name} />
        <input type="hidden" name="companyName" value={form.leadValues.companyName} />
        <input type="hidden" name="email" value={form.leadValues.email} />
        <input type="hidden" name="phone" value={form.leadValues.phone} />
        <input type="hidden" name="website" value={form.leadValues.website} />
        <input type="hidden" name="linkedin" value={form.leadValues.linkedin} />
        <input type="hidden" name="roleTitle" value={form.leadValues.roleTitle} />
        <input type="hidden" name="geography" value={form.leadValues.geography} />
        <input type="hidden" name="address" value={form.leadValues.address} />
        <input type="hidden" name="description" value={form.leadValues.description} />
        <input type="hidden" name="notes" value={form.leadValues.notes} />
        <input type="hidden" name="sourceUrl" value={form.leadValues.sourceUrl} />
        <input type="hidden" name="usualCommunicationMethod" value={form.leadValues.usualCommunicationMethod} />
        <input type="hidden" name="contactAttemptStatus" value={form.leadValues.contactAttemptStatus} />
        <input type="hidden" name="lastContactedAt" value={form.leadValues.lastContactedAt} />
        <input type="hidden" name="buyerStatus" value={form.leadValues.buyerStatus} />
        <input type="hidden" name="sellerStatus" value={form.leadValues.sellerStatus} />
        <input type="hidden" name="confidence" value={form.leadValues.confidence} />
        <input type="hidden" name="priority" value={form.leadValues.priority} />
        <input type="hidden" name="valueMin" value={form.leadValues.valueMin} />
        <input type="hidden" name="valueMax" value={form.leadValues.valueMax} />
        <input type="hidden" name="currency" value={form.leadValues.currency} />
        <input type="hidden" name="nextAction" value={form.leadValues.nextAction} />
        <input type="hidden" name="nextActionAt" value={form.leadValues.nextActionAt} />
        <button class="btn primary" type="submit">Create anyway</button>
      </form>
    </section>
  {/if}

  <div class="summary-grid">
    <div class="card stat"><span>Leads</span><strong>{data.summary.leads}</strong></div>
    <div class="card stat"><span>Ready leads</span><strong>{data.summary.readyLeads}</strong></div>
    <div class="card stat"><span>Open tasks</span><strong>{data.summary.openTasks}</strong></div>
    <div class="card stat"><span>Overdue</span><strong>{data.summary.overdueTasks}</strong></div>
    <div class="card stat"><span>Deals</span><strong>{data.summary.deals}</strong></div>
    <div class="card stat"><span>Notes</span><strong>{data.summary.notes}</strong></div>
  </div>

  {#if showEdit}
    <section class="card panel">
      <h2>Edit workstream</h2>
      <form method="post" action="?/updateWorkstream" class="grid two">
        <div class="field"><label for="wsName">Name</label><input id="wsName" name="name" required value={data.workstream.name} /></div>
        <div class="field span2"><label for="wsDescription">Description</label><textarea id="wsDescription" name="description" rows="3">{data.workstream.description}</textarea></div>
        <div class="span2"><button class="btn primary" type="submit">Save workstream</button></div>
      </form>
    </section>
  {/if}

  {#if showNewLead}
    <section class="card panel">
      <h2>New lead in {data.workstream.name}</h2>
      <form method="post" action="?/createLead">
        <div class="grid two">
          <div class="field"><label for="leadTitle">Lead title</label><input id="leadTitle" name="title" placeholder="e.g. Provider owner to research" /></div>
          <div class="field"><label for="leadType">Lead type</label><select id="leadType" name="type">{#each data.marketLeadTypes as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid three">
          <div class="field"><label for="leadStatus">Status</label><select id="leadStatus" name="status">{#each data.marketLeadStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="leadSourceChoice">Source</label><select id="leadSourceChoice" name="sourceChoice" bind:value={leadSourceChoice}>{#each data.options.leadSources as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="leadPriority">Priority</label><input id="leadPriority" name="priority" type="number" min="1" max="5" value="3" /></div>
        </div>
        {#if leadSourceChoice === 'CUSTOM'}<div class="field"><label for="newLeadSource">Custom source</label><input id="newLeadSource" name="newLeadSource" placeholder="e.g. Sam spreadsheet" /></div>{/if}
        <div class="grid two">
          <div class="field"><label for="leadName">Person name</label><input id="leadName" name="name" /></div>
          <div class="field"><label for="leadCompanyName">Company name</label><input id="leadCompanyName" name="companyName" /></div>
          <div class="field"><label for="leadPhone">Phone</label><input id="leadPhone" name="phone" /></div>
          <div class="field"><label for="leadEmail">Email</label><input id="leadEmail" name="email" /></div>
          <div class="field"><label for="leadLinkedin">LinkedIn</label><input id="leadLinkedin" name="linkedin" /></div>
          <div class="field"><label for="leadWebsite">Website</label><input id="leadWebsite" name="website" /></div>
        </div>
        <div class="grid two">
          <div class="field"><label for="leadBuyerStatus">Buyer status</label><select id="leadBuyerStatus" name="buyerStatus"><option value="NOT_ASKED">Not asked</option><option value="NO_TO_BUYING">No to buying</option><option value="POSSIBLY_BUYING">Possibly buying</option><option value="ACTIVELY_LOOKING">Actively looking</option><option value="VERY_KEEN_TO_BUY">Very keen to buy</option><option value="ENGAGED_ME_TO_SEARCH">Engaged me to search</option></select></div>
          <div class="field"><label for="leadSellerStatus">Seller status</label><select id="leadSellerStatus" name="sellerStatus"><option value="NOT_ASKED">Not asked</option><option value="NO_TO_SELLING">No to selling</option><option value="OPEN_TO_OFFERS">Open to offers</option><option value="POTENTIALLY_SELLING">Potentially selling</option><option value="YES_TO_SELL">Yes to sell</option><option value="KEEN_TO_SELL">Keen to sell</option><option value="ENGAGED_ME_TO_SELL">Engaged me to sell</option></select></div>
        </div>
        <div class="field"><label for="leadNextAction">Next action</label><input id="leadNextAction" name="nextAction" placeholder="e.g. Find direct phone number" /></div>
        <div class="field"><label for="leadNotes">Notes</label><textarea id="leadNotes" name="notes" rows="3"></textarea></div>
        <button class="btn primary" type="submit">Create lead</button>
      </form>
    </section>
  {/if}

  {#if showAttachLead}
    <section class="card panel">
      <h2>Attach existing lead</h2>
      <div class="field">
        <label for="attachLeadSearch">Search leads</label>
        <input id="attachLeadSearch" bind:value={attachLeadSearch} placeholder="Type a name, company, type, or status" />
        <p class="hint">Search filters the dropdown below. Opening a match in a new tab lets you check it before attaching.</p>
      </div>
      <form method="post" action="?/attachLead" class="grid two">
        <div class="field">
          <label for="attachLeadId">Lead</label>
          <select id="attachLeadId" name="leadId" required>
            <option value="">Choose lead</option>
            {#each filteredAttachableLeads as lead}
              <option value={lead.id}>{lead.title} - {lead.typeLabel} - {lead.statusLabel}</option>
            {/each}
          </select>
        </div>
        <div class="field align-end"><button class="btn primary" type="submit">Attach lead</button></div>
      </form>
      {#if attachLeadSearch && filteredAttachableLeads.length === 0}<p class="muted">No attachable leads matched that search.</p>{/if}
      {#if filteredAttachableLeads.length > 0}
        <div class="search-results">
          {#each filteredAttachableLeads.slice(0, 8) as lead}
            <div class="result-row">
              <div><strong>{lead.title}</strong><div class="muted small">{lead.typeLabel} - {lead.statusLabel}</div></div>
              <a class="btn" href={`/leads/${lead.id}`} target="_blank" rel="noreferrer">Open</a>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}

  {#if showNewTask}
    <section class="card panel">
      <h2>New task in {data.workstream.name}</h2>
      <form method="post" action="?/createTask">
        <div class="grid two">
          <div class="field"><label for="taskTitle">Title</label><input id="taskTitle" name="title" required placeholder="e.g. Call consultant list" /></div>
          <div class="field"><label for="taskType">Type</label><select id="taskType" name="taskType">{#each data.taskTypes as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid four">
          <div class="field"><label for="taskFocus">Focus</label><select id="taskFocus" name="focus">{#each data.taskFocusOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="taskStatus">Status</label><select id="taskStatus" name="status">{#each data.taskStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="taskUrgency">Urgency</label><select id="taskUrgency" name="urgency">{#each data.taskUrgencies as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="taskImportance">Importance</label><select id="taskImportance" name="importance">{#each data.taskImportances as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid two">
          <div class="field"><label for="taskDueAt">Due</label><input id="taskDueAt" name="dueAt" type="datetime-local" /></div>
          <div class="field"><label for="taskLeadId">Lead</label><select id="taskLeadId" name="marketLeadId"><option value="">No lead</option>{#each data.options.workstreamLeads as lead}<option value={lead.id}>{lead.title}</option>{/each}</select></div>
          <div class="field"><label for="taskDealId">Deal</label><select id="taskDealId" name="dealId"><option value="">No deal</option>{#each data.options.deals as deal}<option value={deal.id}>{deal.title}</option>{/each}</select></div>
          <div class="field"><label for="taskCompanyId">Company</label><select id="taskCompanyId" name="companyId"><option value="">No company</option>{#each data.options.companies as company}<option value={company.id}>{company.name}</option>{/each}</select></div>
          <div class="field"><label for="taskContactId">Person</label><select id="taskContactId" name="contactId"><option value="">No person</option>{#each data.options.contacts as contact}<option value={contact.id}>{contact.name}</option>{/each}</select></div>
          <div class="field"><label for="waitingOnContactId">Waiting on</label><select id="waitingOnContactId" name="waitingOnContactId"><option value="">No one</option>{#each data.options.contacts as contact}<option value={contact.id}>{contact.name}</option>{/each}</select></div>
        </div>
        <div class="field"><label for="taskNotes">Notes</label><VoiceTextField id="taskNotes" name="notes" bind:value={taskNotes} rows={3} placeholder="Task context" /></div>
        <div class="field"><label for="taskSummary">Summary</label><textarea id="taskSummary" name="summary" bind:value={taskSummary} rows="2"></textarea></div>
        <button class="btn primary" type="submit">Create task</button>
      </form>
    </section>
  {/if}

  {#if showNewNote}
    <section class="card panel">
      <h2>New workstream note</h2>
      <form method="post" action="?/createNote">
        <div class="grid two">
          <div class="field"><label for="noteChannel">Channel</label><select id="noteChannel" name="channel"><option value="note">Note</option><option value="call">Call</option><option value="email">Email</option><option value="sms">SMS</option><option value="linkedin">LinkedIn</option><option value="meeting">Meeting</option><option value="whatsapp">WhatsApp</option><option value="other">Other</option></select></div>
          <div class="field"><label for="noteOccurredAt">Occurred at</label><input id="noteOccurredAt" name="occurredAt" type="datetime-local" /></div>
        </div>
        <div class="field"><label for="noteBody">Note</label><VoiceTextField id="noteBody" name="body" bind:value={noteBody} rows={4} placeholder="What happened in this workstream?" /></div>
        <div class="field"><label for="noteSummary">Summary</label><textarea id="noteSummary" name="summary" bind:value={noteSummary} rows="2"></textarea></div>
        <button class="btn primary" type="submit">Save note</button>
      </form>
    </section>
  {/if}

  {#if showLinkDeal}
    <section class="card panel">
      <h2>Link existing deal</h2>
      <form method="post" action="?/linkDeal" class="grid two">
        <div class="field"><label for="linkDealId">Deal</label><select id="linkDealId" name="dealId" required><option value="">Choose deal</option>{#each data.options.unlinkedDeals as deal}<option value={deal.id}>{deal.title}</option>{/each}</select></div>
        <div class="field"><label for="dealLabel">Label</label><input id="dealLabel" name="label" placeholder="e.g. active seller-side deal" /></div>
        <div class="field span2"><label for="dealNotes">Notes</label><textarea id="dealNotes" name="notes" rows="2"></textarea></div>
        <div class="span2"><button class="btn primary" type="submit">Link deal</button></div>
      </form>
    </section>
  {/if}

  <section class="card panel">
    <div class="section-head"><h2>Tasks</h2><div class="actions"><button class="btn" type="button" on:click={() => (showNewTask = !showNewTask)}>＋ Add task</button><a class="btn" href={`/tasks?projectId=${data.project.id}&workstreamId=${data.workstream.id}`}>Open in task inbox</a></div></div>
    {#if data.tasks.length === 0}<p class="muted">No tasks in this workstream yet.</p>{:else}
      <div class="task-list">
        {#each data.tasks as task}
          <article class="task-row {dueClass(task.dueAt, task.status)}">
            <div class="task-main">
              <div class="task-title-row"><a href={`/tasks/${task.id}/edit?returnTo=/projects/${data.project.id}/workstreams/${data.workstream.id}`}><strong>{task.title}</strong></a><span class="status-chip">{task.focusLabel}</span><span class="status-chip">{task.urgencyLabel}</span></div>
              <div class="muted small">{task.statusLabel} - {task.taskTypeLabel} - due {fmt(task.dueAt)}</div>
              {#if task.notes}<p class="preline small">{task.notes}</p>{/if}
              <div class="context-row">
                {#if task.marketLead}<a class="chip" href={`/leads/${task.marketLead.id}`}>Lead: {task.marketLead.title}</a>{/if}
                {#if task.deal}<a class="chip" href={`/deals/${task.deal.id}`}>Deal: {task.deal.title}</a>{/if}
                {#if task.company}<a class="chip" href={`/companies/${task.company.id}`}>Company: {task.company.name}</a>{/if}
                {#if task.contact}<a class="chip" href={`/contacts/${task.contact.id}`}>Person: {task.contact.name}</a>{/if}
                {#if task.waitingOnContact}<a class="chip" href={`/contacts/${task.waitingOnContact.id}`}>Waiting on: {task.waitingOnContact.name}</a>{/if}
              </div>
            </div>
            <div class="task-actions">
              <form method="post" action="?/updateTaskStatus"><input type="hidden" name="taskId" value={task.id} /><select name="status" on:change={submitContainingForm}>{#each data.taskStatuses as opt}<option value={opt.value} selected={task.status === opt.value}>{opt.label}</option>{/each}</select></form>
              <a class="btn" href={`/tasks/${task.id}/edit?returnTo=/projects/${data.project.id}/workstreams/${data.workstream.id}`}>Edit</a>
              <form method="post" action="?/deleteTask" on:submit={(event) => { if (!confirm('Delete this task?')) event.preventDefault(); }}><input type="hidden" name="taskId" value={task.id} /><button class="btn" type="submit">Delete</button></form>
            </div>
          </article>
        {/each}
      </div>
    {/if}
  </section>

  <section class="card panel">
    <div class="section-head"><h2>Leads</h2><div class="actions"><button class="btn" type="button" on:click={() => (showNewLead = !showNewLead)}>＋ New lead</button><button class="btn" type="button" on:click={() => (showAttachLead = !showAttachLead)}>Attach existing</button><a class="btn" href={`/leads?projectId=${data.project.id}&workstreamId=${data.workstream.id}`}>Open in leads</a></div></div>
    {#if data.leads.length === 0}<p class="muted">No leads in this workstream yet.</p>{:else}
      <div class="lead-list">
        {#each data.leads as lead}
          <a class="lead-row" href={`/leads/${lead.id}`}>
            <div><strong>{lead.title}</strong><div class="muted small">{lead.typeLabel} - {lead.statusLabel} - priority {lead.priority} - confidence {lead.confidence}/100</div>{#if lead.nextAction}<div class="small">Next: {lead.nextAction}</div>{/if}</div>
            <div class="lead-badges"><span class="status-chip">Buyer: {lead.buyerStatusLabel}</span><span class="status-chip">Seller: {lead.sellerStatusLabel}</span><span class="status-chip">{lead.contactAttemptStatusLabel}</span></div>
          </a>
        {/each}
      </div>
    {/if}
  </section>

  <section class="card panel">
    <div class="section-head"><h2>Linked deals</h2><button class="btn" type="button" on:click={() => (showLinkDeal = !showLinkDeal)}>Link deal</button></div>
    {#if data.deals.length === 0}<p class="muted">No deals linked to this workstream yet.</p>{:else}
      <div class="lead-list">
        {#each data.deals as link}
          <div class="lead-row">
            <div><strong><a href={`/deals/${link.dealId}`}>{link.title}</a></strong><div class="muted small">{link.status}{link.probability === null || link.probability === undefined ? '' : ` - ${link.probability}% chance`}{#if link.valueCents} - {money(link.valueCents, link.currency)}{/if}</div>{#if link.label}<div class="small">{link.label}</div>{/if}{#if link.notes}<p class="preline small">{link.notes}</p>{/if}</div>
            <form method="post" action="?/removeProjectDeal" on:submit={(event) => { if (!confirm('Remove this deal from this workstream? The deal itself will not be deleted.')) event.preventDefault(); }}><input type="hidden" name="linkId" value={link.id} /><button class="btn" type="submit">Remove</button></form>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <section class="card panel">
    <div class="section-head"><h2>Notes</h2><button class="btn" type="button" on:click={() => (showNewNote = !showNewNote)}>＋ Add note</button></div>
    {#if data.notes.length === 0}<p class="muted">No notes in this workstream yet.</p>{:else}
      <div class="note-list">
        {#each data.notes as note}
          <article class="note-row">
            <div><div class="muted small">{note.channel} - {fmt(note.occurredAt)}</div>{#if note.summary}<strong>{note.summary}</strong>{/if}<p class="preline">{note.body}</p></div>
            <form method="post" action="?/deleteNote" on:submit={(event) => { if (!confirm('Delete this note?')) event.preventDefault(); }}><input type="hidden" name="noteId" value={note.id} /><button class="btn" type="submit">Delete</button></form>
          </article>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .header-card { padding: 18px; display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 12px; }
  .actions, .meta-row, .section-head, .context-row, .task-title-row, .chip-list, .lead-badges { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .section-head { justify-content: space-between; }
  h1 { margin: 0; }
  h2 { margin: 0 0 10px; font-size: 1.1rem; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; margin-bottom: 12px; }
  .stat { padding: 12px; display: grid; gap: 4px; }
  .stat strong { font-size: 1.5rem; }
  .panel, .error-card, .warning-card { padding: 14px; margin-bottom: 12px; }
  .error-card { color: var(--danger); }
  .warning-card { border-color: #b7791f; }
  .duplicate-confirm-form { margin-top: 12px; }
  .search-results { display: grid; gap: 6px; margin-top: 8px; }
  .result-row { display: flex; justify-content: space-between; gap: 10px; align-items: center; border-top: 1px solid var(--border); padding: 8px 0; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grid.three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .grid.four { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .span2 { grid-column: 1 / span 2; }
  .align-end { align-self: end; }
  .preline { white-space: pre-wrap; }
  .task-list, .lead-list, .note-list { display: grid; gap: 8px; }
  .task-row, .lead-row, .note-row { border-top: 1px solid var(--border); padding: 12px 0; display: flex; justify-content: space-between; gap: 12px; color: var(--text); text-decoration: none; }
  .task-row.overdue { border-color: var(--danger); }
  .task-main { min-width: 0; }
  .task-actions { display: flex; gap: 8px; align-items: flex-start; flex-wrap: wrap; }
  .field { display: grid; gap: 6px; margin-bottom: 10px; }
  input, textarea, select { width: 100%; }
  .btn.danger { background:#b00020; color:#fff; border-color:#b00020; }
  @media (max-width: 780px) { .header-card, .task-row, .lead-row, .note-row { flex-direction: column; } .grid.two, .grid.three, .grid.four { grid-template-columns: 1fr; } .span2 { grid-column: auto; } }
</style>
