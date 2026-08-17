<!-- src/routes/companies/[id]/+page.svelte -->
<script lang="ts">
  import ExchangeItemsPanel from '$lib/ExchangeItemsPanel.svelte';
  import AgentBriefingsPanel from '$lib/AgentBriefingsPanel.svelte';
  // PURPOSE: Company command centre for employees, deal links, company relationships, and tasks.
  import VoiceTextField from '$lib/recording/VoiceTextField.svelte';

  export let data: any;
  export let form: any;

  let showEdit = false;
  let showAddContact = false;
  let showAddDeal = false;
  let showAddRelationship = false;
  let showAddTask = false;
  let taskNotes = '';
  let taskSummary = '';

  const fmt = (value: any) => value ? new Date(value).toLocaleString() : '';
  const fmtDate = (value: any) => value ? new Date(value).toLocaleDateString() : '';

  function submitContainingForm(event: Event) {
    const formEl = (event.currentTarget as HTMLSelectElement).closest('form');
    if (formEl) formEl.requestSubmit();
  }
</script>

<div class="container">
  <header class="company-header card">
    <div>
      <div class="eyebrow">Company</div>
      <h1>{data.company.name}</h1>
      <div class="meta-row">
        <span class="status-chip">{data.company.kindLabel}</span>
        <span class="status-chip">{data.company.statusLabel}</span>
        {#if data.company.industry}<span>{data.company.industry}</span>{/if}
        {#if data.company.location}<span>{data.company.location}</span>{/if}
      </div>
      {#if data.company.website}<div class="muted small">{data.company.website}</div>{/if}
    </div>
    <div class="header-actions">
      <button class="btn" type="button" on:click={() => (showEdit = !showEdit)}>{showEdit ? 'Cancel' : 'Edit company'}</button>
      <button class="btn primary" type="button" on:click={() => (showAddTask = !showAddTask)}>{showAddTask ? 'Cancel task' : 'Add task'}</button>
      <form method="post" action="?/scoreCompany"><button class="btn" type="submit">Score opportunity</button></form>
      <form method="post" action="?/enrichCompany"><button class="btn" type="submit">Enrich company</button></form>
      <a class="btn" href={`/agents/enrichment/new?mode=company&entityType=company&entityId=${data.company.id}&enableWebResearch=true`}>Company options</a>
      <form method="post" action="?/findCompanyContacts"><button class="btn" type="submit">Find contacts</button></form>
      <a class="btn" href={`/agents/enrichment/new?mode=find_contacts&entityType=company&entityId=${data.company.id}&enableWebResearch=true`}>Contact find options</a>
      <a class="btn" href="/companies">Back</a>
    </div>
  </header>

  {#if form?.error}<div class="card error-card">{form.error}</div>{/if}

  {#if showEdit}
    <section class="card panel">
      <h2>Edit company</h2>
      <form method="post" action="?/updateCompany">
        <div class="grid two">
          <div class="field"><label for="name">Company name</label><input id="name" name="name" value={data.company.name} required /></div>
          <div class="field"><label for="website">Website</label><input id="website" name="website" value={data.company.website} /></div>
        </div>
        <div class="grid two">
          <div class="field"><label for="kind">Type</label><select id="kind" name="kind">{#each data.companyKinds as opt}<option value={opt.value} selected={data.company.kind === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="status">Status</label><select id="status" name="status">{#each data.companyStatuses as opt}<option value={opt.value} selected={data.company.status === opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid two">
          <div class="field"><label for="industry">Industry</label><input id="industry" name="industry" value={data.company.industry} /></div>
          <div class="field"><label for="location">Location</label><input id="location" name="location" value={data.company.location} /></div>
        </div>
        <div class="field"><label for="description">Description</label><textarea id="description" name="description" rows="3">{data.company.description}</textarea></div>
        <div class="field"><label for="criteria">Acquisition / buyer criteria</label><textarea id="criteria" name="criteria" rows="3">{data.company.criteria}</textarea></div>
        <div class="field"><label for="notes">Internal notes</label><textarea id="notes" name="notes" rows="3">{data.company.notes}</textarea></div>
        <button class="btn primary" type="submit">Save company</button>
      </form>
    </section>
  {/if}

  {#if showAddTask}
    <section class="card panel">
      <h2>Add task for this company</h2>
      <form method="post" action="?/createTask">
        <div class="field"><label for="taskTitle">Task</label><input id="taskTitle" name="title" required placeholder="e.g. Find M&A contact inside this acquirer" /></div>
        <div class="grid four">
          <div class="field"><label for="taskType">Type</label><select id="taskType" name="taskType">{#each data.taskTypes as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="taskUrgency">Urgency</label><select id="taskUrgency" name="urgency">{#each data.taskUrgencies as opt}<option value={opt.value} selected={opt.value === 'NORMAL'}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="taskImportance">Importance</label><select id="taskImportance" name="importance">{#each data.taskImportances as opt}<option value={opt.value} selected={opt.value === 'NORMAL'}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="taskStatus">Status</label><select id="taskStatus" name="status">{#each data.taskStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid three">
          <div class="field"><label for="taskDueAt">Due</label><input id="taskDueAt" name="dueAt" type="datetime-local" /></div>
          <div class="field"><label for="taskDealId">Related deal</label><select id="taskDealId" name="dealId"><option value="">No deal</option>{#each data.allDealOptions as d}<option value={d.id}>{d.title}</option>{/each}</select></div>
          <div class="field"><label for="taskContactId">Related person</label><select id="taskContactId" name="contactId"><option value="">No person</option>{#each data.allContactOptions as c}<option value={c.id}>{c.name}</option>{/each}</select></div>
        </div>
        <div class="field"><label for="waitingOnContactId">Waiting on</label><select id="waitingOnContactId" name="waitingOnContactId"><option value="">Nobody external</option>{#each data.allContactOptions as c}<option value={c.id}>{c.name}</option>{/each}</select></div>
        <VoiceTextField id="taskNotes" textName="notes" summaryName="summary" label="Task notes" rows={3} placeholder="Record or type task context." bind:value={taskNotes} bind:summary={taskSummary} contextLabel="company task" />
        <button class="btn primary" type="submit">Save task</button>
      </form>
    </section>
  {/if}

  <ExchangeItemsPanel items={data.exchangeItems ?? []} entityLabel={data.company.name} />

  <AgentBriefingsPanel entityType="company" entityId={data.company.id} entityLabel={data.company.name} artifacts={data.agentArtifacts ?? []} />

  <div class="grid main-grid">
    <section class="card panel">
      <h2>Company profile</h2>
      {#if data.company.description}<p class="preline">{data.company.description}</p>{:else}<p class="muted">No description yet.</p>{/if}
      {#if data.company.criteria}<div class="summary-box"><div class="muted small">Acquisition / buyer criteria</div><p>{data.company.criteria}</p></div>{/if}
      {#if data.company.notes}<div class="summary-box"><div class="muted small">Internal notes</div><p>{data.company.notes}</p></div>{/if}
    </section>

    <section class="card panel">
      <div class="section-head"><h2>Employees / contacts</h2><button class="btn" type="button" on:click={() => (showAddContact = !showAddContact)}>{showAddContact ? 'Cancel' : 'Add contact'}</button></div>
      {#if showAddContact}
        <form method="post" action="?/addContact" class="nested-form">
          <div class="field"><label for="contactId">Contact</label><select id="contactId" name="contactId" required><option value="">Select contact</option>{#each data.contactOptions as c}<option value={c.id}>{c.name}</option>{/each}</select></div>
          <div class="grid three">
            <div class="field"><label for="contactTitle">Title</label><input id="contactTitle" name="title" placeholder="e.g. CEO, CFO, M&A" /></div>
            <div class="field"><label for="department">Department</label><input id="department" name="department" /></div>
            <div class="field"><label for="employeeStatus">Status</label><select id="employeeStatus" name="status">{#each data.companyContactStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          </div>
          <div class="field"><label for="employeeNotes">Notes</label><textarea id="employeeNotes" name="notes" rows="2"></textarea></div>
          <label class="check-row"><input type="checkbox" name="isPrimary" /><span>Primary contact at this company</span></label>
          <button class="btn primary" type="submit">Attach contact</button>
        </form>
      {/if}

      {#if data.employees.length === 0}<p class="muted">No contacts attached to this company yet.</p>{:else}
        <div class="mini-list">
          {#each data.employees as employee}
            <div class="mini-row">
              <div>
                <div class="title-line"><a href={`/contacts/${employee.contactId}`}>{employee.name}</a>{#if employee.isPrimary}<span class="status-chip">Primary</span>{/if}<span class="status-chip">{employee.statusLabel}</span></div>
                <div class="muted small">{employee.title}{employee.title && employee.department ? ' - ' : ''}{employee.department}</div>
                {#if employee.notes}<p class="preline small">{employee.notes}</p>{/if}
              </div>
              <form method="post" action="?/removeContact" on:submit={(event) => { if (!confirm('Remove this contact from the company?')) event.preventDefault(); }}>
                <input type="hidden" name="linkId" value={employee.id} />
                <button class="btn" type="submit">Remove</button>
              </form>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  </div>

  <section class="card panel">
    <div class="section-head"><h2>Deals involving this company</h2><button class="btn" type="button" on:click={() => (showAddDeal = !showAddDeal)}>{showAddDeal ? 'Cancel' : 'Add to deal'}</button></div>
    {#if showAddDeal}
      <form method="post" action="?/addDeal" class="nested-form">
        <div class="field"><label for="dealId">Deal</label><select id="dealId" name="dealId" required><option value="">Select deal</option>{#each data.dealOptions as d}<option value={d.id}>{d.title} - {d.statusLabel}</option>{/each}</select></div>
        <div class="grid three">
          <div class="field"><label for="relationshipType">Role</label><select id="relationshipType" name="relationshipType">{#each data.relationshipOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="stage">Stage</label><select id="stage" name="stage">{#each data.dealContactStageOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="interestLevel">Interest</label><select id="interestLevel" name="interestLevel">{#each data.dealContactInterestOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid three">
          <div class="field"><label for="confidentialityStage">Confidentiality</label><select id="confidentialityStage" name="confidentialityStage">{#each data.dealConfidentialityOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="nextFollowUpAt">Next follow-up</label><input id="nextFollowUpAt" name="nextFollowUpAt" type="datetime-local" /></div>
          <div class="field"><label for="label">Custom label</label><input id="label" name="label" placeholder="e.g. acquirer, funder" /></div>
        </div>
        <div class="field"><label for="nextAction">Next action</label><input id="nextAction" name="nextAction" placeholder="e.g. find contact, send blind teaser" /></div>
        <div class="field"><label for="acquisitionRationale">Why this company fits</label><textarea id="acquisitionRationale" name="acquisitionRationale" rows="2"></textarea></div>
        <div class="field"><label for="dealCompanyNotes">Notes</label><textarea id="dealCompanyNotes" name="notes" rows="2"></textarea></div>
        <label class="check-row"><input type="checkbox" name="isPrimary" /><span>Primary company for this deal</span></label>
        <button class="btn primary" type="submit">Attach to deal</button>
      </form>
    {/if}

    {#if data.dealLinks.length === 0}<p class="muted">This company is not attached to any deals yet.</p>{:else}
      <div class="deal-list">
        {#each data.dealLinks as link}
          <div class="deal-row">
            <div>
              <div class="title-line"><a href={`/deals/${link.dealId}`}>{link.dealTitle}</a>{#if link.isPrimary}<span class="status-chip">Primary</span>{/if}<span class="status-chip">{link.stageLabel}</span><span class="status-chip">{link.interestLabel}</span></div>
              <div class="muted small">{link.relationshipLabel} - {link.dealStatusLabel} - confidentiality: {link.confidentialityLabel}</div>
              {#if link.nextAction}<p class="preline small"><strong>Next:</strong> {link.nextAction}{link.nextFollowUpAt ? ` - ${fmt(link.nextFollowUpAt)}` : ''}</p>{/if}
              {#if link.acquisitionRationale}<p class="preline small"><strong>Rationale:</strong> {link.acquisitionRationale}</p>{/if}
              {#if link.notes}<p class="preline small">{link.notes}</p>{/if}
              <div class="muted small">{link.taskCount} task{link.taskCount === 1 ? '' : 's'}</div>
            </div>
            <form method="post" action="?/removeDeal" on:submit={(event) => { if (!confirm('Remove this company from the deal?')) event.preventDefault(); }}>
              <input type="hidden" name="linkId" value={link.id} />
              <button class="btn" type="submit">Remove</button>
            </form>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <section class="card panel">
    <div class="section-head"><h2>Related companies</h2><button class="btn" type="button" on:click={() => (showAddRelationship = !showAddRelationship)}>{showAddRelationship ? 'Cancel' : 'Add company link'}</button></div>
    {#if showAddRelationship}
      <form method="post" action="?/addRelationship" class="nested-form">
        <div class="grid three">
          <div class="field"><label for="otherCompanyId">Company</label><select id="otherCompanyId" name="otherCompanyId" required><option value="">Select company</option>{#each data.companyOptions as c}<option value={c.id}>{c.name} - {c.kindLabel}</option>{/each}</select></div>
          <div class="field"><label for="companyRelationshipType">Relationship</label><select id="companyRelationshipType" name="relationshipType">{#each data.companyRelationshipTypes as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="companyRelLabel">Custom label</label><input id="companyRelLabel" name="label" placeholder="e.g. parent, subsidiary" /></div>
        </div>
        <div class="field"><label for="companyRelNotes">Notes</label><textarea id="companyRelNotes" name="notes" rows="2"></textarea></div>
        <button class="btn primary" type="submit">Add company link</button>
      </form>
    {/if}

    {#if data.relationships.length === 0}<p class="muted">No related companies yet.</p>{:else}
      <div class="mini-list">
        {#each data.relationships as rel}
          <div class="mini-row">
            <div>
              <div class="title-line"><a href={`/companies/${rel.otherCompanyId}`}>{rel.otherCompanyName}</a><span class="status-chip">{rel.relationshipLabel}</span></div>
              <div class="muted small">{rel.otherKindLabel} - {rel.otherStatusLabel}</div>
              {#if rel.notes}<p class="preline small">{rel.notes}</p>{/if}
            </div>
            <form method="post" action="?/removeRelationship" on:submit={(event) => { if (!confirm('Remove this company relationship?')) event.preventDefault(); }}>
              <input type="hidden" name="relationshipId" value={rel.id} />
              <button class="btn" type="submit">Remove</button>
            </form>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <section class="card panel">
    <div class="section-head"><h2>Open tasks</h2><a class="btn" href="/tasks">Task inbox</a></div>
    {#if data.tasks.length === 0}<p class="muted">No open tasks for this company.</p>{:else}
      <div class="mini-list">
        {#each data.tasks as task}
          <div class="mini-row">
            <div>
              <div class="title-line"><span>{task.title}</span><span class="status-chip">{task.statusLabel}</span><span class="status-chip">{task.urgencyLabel}</span></div>
              <div class="muted small">{task.taskTypeLabel} - due {fmt(task.dueAt) || 'not set'}{task.deal ? ` - ${task.deal.title}` : ''}</div>
              {#if task.notes}<p class="preline small">{task.notes}</p>{/if}
              {#if task.summary}<div class="summary-box"><div class="muted small">AI summary</div><p>{task.summary}</p></div>{/if}
            </div>
            <div class="row-actions">
              <form method="post" action="?/updateTaskStatus"><input type="hidden" name="taskId" value={task.id} /><select name="status" on:change={submitContainingForm}>{#each data.taskStatuses as opt}<option value={opt.value} selected={task.status === opt.value}>{opt.label}</option>{/each}</select></form>
              <a class="btn" href={`/tasks/${task.id}/edit?returnTo=/companies/${data.company.id}`}>Edit</a>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </section>
</div>

<style>
  .container { padding: 12px; }
  .company-header, .section-head, .mini-row, .deal-row, .title-line, .meta-row, .header-actions, .row-actions { display: flex; gap: 10px; align-items: flex-start; justify-content: space-between; }
  .title-line, .meta-row, .header-actions, .row-actions { align-items: center; justify-content: flex-start; flex-wrap: wrap; }
  .company-header { padding: 18px; margin-bottom: 12px; }
  h1, h2 { margin: 0; }
  h2 { font-size: 1.1rem; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  .panel, .error-card { padding: 16px; margin-bottom: 12px; }
  .error-card { color: var(--danger); }
  .main-grid { display: grid; grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr); gap: 12px; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grid.three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .grid.four { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .nested-form { border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin: 10px 0; background: var(--panel); }
  .mini-list, .deal-list { display: grid; gap: 8px; }
  .mini-row, .deal-row { border-top: 1px solid var(--border); padding: 12px 0; }
  .status-chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 3px 8px; font-size: 0.82rem; color: var(--muted); }
  .summary-box { border: 1px solid var(--border); background: var(--panel); border-radius: 10px; padding: 10px; margin-top: 10px; }
  .summary-box p { margin: 4px 0 0; white-space: pre-wrap; }
  .preline { white-space: pre-wrap; }
  .check-row { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
  .check-row input { width: auto; }
  textarea { resize: vertical; }
  @media (max-width: 860px) {
    .company-header, .section-head, .mini-row, .deal-row { flex-direction: column; align-items: stretch; }
    .main-grid, .grid.two, .grid.three, .grid.four { grid-template-columns: 1fr; }
  }
</style>
