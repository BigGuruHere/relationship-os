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
  let showAddCompanyNote = false;
  let showCreateLead = false;
  let showAttachLead = false;
  let taskNotes = '';
  let taskSummary = '';
  let companyNoteText = '';
  let companyNoteSummary = '';
  let contactSearch = '';
  let leadSearch = '';
  let newCompanyLeadSourceChoice = 'builtin:MANUAL';

  $: filteredContactOptions = (data.contactOptions || []).filter((contact: any) => {
    const q = contactSearch.trim().toLowerCase();
    if (!q) return true;
    return `${contact.name || ''} ${contact.email || ''} ${contact.phone || ''}`.toLowerCase().includes(q);
  });

  $: filteredLeadOptions = (data.leadOptions || []).filter((lead: any) => {
    const q = leadSearch.trim().toLowerCase();
    if (!q) return true;
    return `${lead.title || ''} ${lead.name || ''} ${lead.companyName || ''} ${lead.email || ''} ${lead.phone || ''} ${lead.sourceLabel || ''}`.toLowerCase().includes(q);
  });

  const fmt = (value: any) => value ? new Date(value).toLocaleString() : '';
  const fmtDate = (value: any) => value ? new Date(value).toLocaleDateString() : '';

  function submitContainingForm(event: Event) {
    const formEl = (event.currentTarget as HTMLSelectElement).closest('form');
    if (formEl) formEl.requestSubmit();
  }

  function closeContainingDetails(event: Event) {
    const details = (event.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null;
    if (details) details.open = false;
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
      {#if data.company.phone}<div class="muted small">{data.company.phone}</div>{/if}
      {#if data.company.tags?.length}<div class="tag-row">{#each data.company.tags as tag}<span class="status-chip">{tag.name}</span>{/each}</div>{/if}
    </div>
    <div class="header-actions">
      <button class="btn" type="button" on:click={() => (showEdit = !showEdit)}>{showEdit ? 'Cancel' : 'Edit company'}</button>
      <button class="btn primary" type="button" on:click={() => (showAddTask = !showAddTask)}>{showAddTask ? 'Cancel task' : 'Add task'}</button>
      <form method="post" action="?/scoreCompany"><button class="btn" type="submit">Score opportunity</button></form>
      <form method="post" action="?/enrichCompany"><button class="btn" type="submit">Enrich company</button></form>
      <a class="btn" href={`/agents/enrichment/new?mode=company&entityType=company&entityId=${data.company.id}&enableWebResearch=true&returnTo=/companies/${data.company.id}`}>Company options</a>
      <form method="post" action="?/findCompanyContacts"><button class="btn" type="submit">Find contacts</button></form>
      <a class="btn" href={`/agents/enrichment/new?mode=find_contacts&entityType=company&entityId=${data.company.id}&enableWebResearch=true&returnTo=/companies/${data.company.id}`}>Contact find options</a>
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
          <div class="field"><label for="phone">Phone</label><input id="phone" name="phone" value={data.company.phone} /></div>
          <div class="field"><label for="kind">Type</label><select id="kind" name="kind">{#each data.companyKinds as opt}<option value={opt.value} selected={data.company.kind === opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid two">
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
        <div class="field"><label for="taskFocus">Focus</label><select id="taskFocus" name="focus">{#each data.taskFocusOptions as opt}<option value={opt.value} selected={opt.value === 'NEW'}>{opt.label}</option>{/each}</select></div>
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

  <section class="card panel">
    <div class="section-head"><h2>Company tags</h2></div>
    {#if data.company.tags?.length}
      <div class="tag-row">
        {#each data.company.tags as tag}
          <form method="post" action="?/removeCompanyTag" class="inline-form">
            <input type="hidden" name="linkId" value={tag.id} />
            <button class="status-chip" type="submit" title="Remove tag">{tag.name} ×</button>
          </form>
        {/each}
      </div>
    {:else}
      <p class="muted">No company tags yet.</p>
    {/if}
    <form method="post" action="?/addCompanyTag" class="tag-add-row">
      <input name="tag" placeholder="Add company tag" />
      <button class="btn" type="submit">Add tag</button>
    </form>
  </section>

  <ExchangeItemsPanel items={data.exchangeItems ?? []} entityLabel={data.company.name} />

  <AgentBriefingsPanel entityType="company" entityId={data.company.id} entityLabel={data.company.name} artifacts={data.agentArtifacts ?? []} />

  <section class="card panel">
    <div class="section-head"><h2>Company notes</h2><button class="btn" type="button" on:click={() => (showAddCompanyNote = !showAddCompanyNote)}>{showAddCompanyNote ? 'Cancel note' : 'Add note'}</button></div>
    {#if showAddCompanyNote}
      <form method="post" action="?/createCompanyNote" class="nested-form">
        <div class="grid two">
          <div class="field"><label for="companyNoteChannel">Channel</label><select id="companyNoteChannel" name="channel">{#each data.noteChannels as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="companyNoteOccurredAt">Note date</label><input id="companyNoteOccurredAt" name="occurredAt" type="datetime-local" /></div>
        </div>
        <VoiceTextField id="companyNote" textName="body" summaryName="summary" label="Add company note" placeholder="Record company-level research, calls, emails, source context, or next steps." rows={4} bind:value={companyNoteText} bind:summary={companyNoteSummary} contextLabel="company note" />
        <button class="btn primary" type="submit">Save note</button>
      </form>
    {/if}

    {#if data.companyNotes?.length}
      <div class="mini-list">
        {#each data.companyNotes as note}
          <div class="mini-row">
            <div>
              <div class="muted small"><span class="status-chip">{note.channelLabel}</span> {fmt(note.occurredAt)}</div>
              <p class="preline small">{note.body}</p>
              {#if note.summary}<div class="summary-box"><div class="muted small">AI summary</div><p>{note.summary}</p></div>{/if}
              <details class="edit-note">
                <summary>Edit note</summary>
                <form method="post" action="?/updateCompanyNote" class="nested-form">
                  <input type="hidden" name="noteId" value={note.id} />
                  <div class="grid two">
                    <div class="field"><label for={`companyNoteChannel-${note.id}`}>Channel</label><select id={`companyNoteChannel-${note.id}`} name="channel">{#each data.noteChannels as opt}<option value={opt.value} selected={note.channel === opt.value}>{opt.label}</option>{/each}</select></div>
                    <div class="field"><label for={`companyNoteOccurred-${note.id}`}>Note date</label><input id={`companyNoteOccurred-${note.id}`} name="occurredAt" type="datetime-local" value={note.occurredAtInput} /></div>
                  </div>
                  <div class="field"><label for={`companyNoteBody-${note.id}`}>Note</label><textarea id={`companyNoteBody-${note.id}`} name="body" rows="4">{note.body}</textarea></div>
                  <div class="field"><label for={`companyNoteSummary-${note.id}`}>Summary</label><textarea id={`companyNoteSummary-${note.id}`} name="summary" rows="2">{note.summary}</textarea></div>
                  <div class="actions small-actions"><button class="btn primary" type="submit">Save note changes</button><button class="btn" type="button" on:click={closeContainingDetails}>Cancel</button></div>
                </form>
              </details>
            </div>
            <form method="post" action="?/deleteCompanyNote" on:submit={(event) => { if (!confirm('Delete this company note?')) event.preventDefault(); }}>
              <input type="hidden" name="noteId" value={note.id} />
              <button class="btn" type="submit">Delete</button>
            </form>
          </div>
        {/each}
      </div>
    {:else}
      <p class="muted">No company notes yet.</p>
    {/if}
  </section>

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
          <div class="field"><label for="contactSearch">Search contacts</label><input id="contactSearch" bind:value={contactSearch} placeholder="Type a name, email or phone" /></div>
          <div class="field"><label for="contactId">Contact</label><select id="contactId" name="contactId" required size={Math.min(8, Math.max(3, filteredContactOptions.length || 3))}><option value="">Select contact</option>{#each filteredContactOptions as c}<option value={c.id}>{c.name}{c.email ? ` - ${c.email}` : ''}{c.phone ? ` - ${c.phone}` : ''}</option>{/each}</select></div>
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
              <div class="row-actions">
                <a class="btn" href={`/companies/${data.company.id}/contacts/${employee.id}`}>Open relationship</a>
                <form method="post" action="?/removeContact" on:submit={(event) => { if (!confirm('Remove this contact from the company?')) event.preventDefault(); }}>
                  <input type="hidden" name="linkId" value={employee.id} />
                  <button class="btn" type="submit">Remove</button>
                </form>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  </div>

  <section class="card panel">
    <div class="section-head">
      <h2>Leads linked to this company</h2>
      <div class="row-actions">
        <button class="btn" type="button" on:click={() => (showCreateLead = !showCreateLead)}>{showCreateLead ? 'Cancel new lead' : 'Create lead from company'}</button>
        <button class="btn" type="button" on:click={() => (showAttachLead = !showAttachLead)}>{showAttachLead ? 'Cancel attach' : 'Attach existing lead'}</button>
      </div>
    </div>

    {#if showCreateLead}
      <form method="post" action="?/createCompanyLead" class="nested-form">
        <div class="grid two">
          <div class="field"><label for="leadTitle">Lead title</label><input id="leadTitle" name="title" value={data.company.name} /></div>
          <div class="field"><label for="leadType">Lead type</label><select id="leadType" name="type">{#each data.leadTypes as opt}<option value={opt.value} selected={opt.value === 'COMPANY'}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid three">
          <div class="field"><label for="leadStatus">Status</label><select id="leadStatus" name="status">{#each data.leadStatuses as opt}<option value={opt.value} selected={opt.value === 'NEW'}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="leadSourceChoice">Source</label><select id="leadSourceChoice" name="sourceChoice" bind:value={newCompanyLeadSourceChoice}>{#each data.leadSourceOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="leadNextActionAt">Next action date</label><input id="leadNextActionAt" name="nextActionAt" type="datetime-local" /></div>
        </div>
        {#if newCompanyLeadSourceChoice === 'CUSTOM'}
          <div class="field"><label for="newLeadSource">Custom source</label><input id="newLeadSource" name="newLeadSource" placeholder="e.g. Sam spreadsheet, LinkedIn search" /></div>
        {/if}
        <div class="field"><label for="leadNextAction">Next action</label><input id="leadNextAction" name="nextAction" placeholder="e.g. research decision-maker, call office, qualify buyer/seller angle" /></div>
        <div class="field"><label for="leadNotes">Lead notes</label><textarea id="leadNotes" name="notes" rows="3"></textarea></div>
        <button class="btn primary" type="submit">Create linked lead</button>
      </form>
    {/if}

    {#if showAttachLead}
      <form method="post" action="?/attachLead" class="nested-form">
        <div class="field"><label for="leadSearch">Search leads</label><input id="leadSearch" bind:value={leadSearch} placeholder="Type lead name, company, email, phone or source" /></div>
        <div class="field"><label for="leadId">Lead</label><select id="leadId" name="leadId" required size={Math.min(8, Math.max(3, filteredLeadOptions.length || 3))}><option value="">Select lead</option>{#each filteredLeadOptions as lead}<option value={lead.id}>{lead.title}{lead.name ? ` - ${lead.name}` : ''}{lead.sourceLabel ? ` - ${lead.sourceLabel}` : ''}</option>{/each}</select></div>
        {#if filteredLeadOptions.length}
          <div class="mini-list compact-list">
            {#each filteredLeadOptions.slice(0, 8) as lead}
              <div class="mini-row compact-row"><div><strong>{lead.title}</strong><div class="muted small">{lead.typeLabel} - {lead.statusLabel} - {lead.sourceLabel}</div></div><a class="btn" href={`/leads/${lead.id}`} target="_blank" rel="noreferrer">Open</a></div>
            {/each}
          </div>
        {/if}
        <button class="btn primary" type="submit">Attach lead</button>
      </form>
    {/if}

    {#if data.linkedLeads?.length}
      <div class="mini-list">
        {#each data.linkedLeads as lead}
          <div class="mini-row">
            <div>
              <div class="title-line"><a href={`/leads/${lead.id}`}>{lead.title}</a><span class="status-chip">{lead.typeLabel}</span><span class="status-chip">{lead.statusLabel}</span>{#if lead.convertedAt}<span class="status-chip">Converted</span>{/if}</div>
              <div class="muted small">Source: {lead.sourceLabel} - Contact: {lead.contactAttemptStatusLabel} - Buyer: {lead.buyerStatusLabel} - Seller: {lead.sellerStatusLabel}</div>
              {#if lead.nextAction}<p class="preline small"><strong>Next:</strong> {lead.nextAction}{lead.nextActionAt ? ` - ${fmt(lead.nextActionAt)}` : ''}</p>{/if}
              <div class="context-row">
                {#if lead.contactId}<a class="chip" href={`/contacts/${lead.contactId}`}>Linked contact</a>{/if}
                {#if lead.projectId}<a class="chip" href={`/projects/${lead.projectId}`}>Project</a>{/if}
                {#if lead.workstream}<span class="chip">Workstream: {lead.workstream.name}</span>{/if}
              </div>
            </div>
            <form method="post" action="?/detachLead" on:submit={(event) => { if (!confirm('Detach this lead from the company?')) event.preventDefault(); }}>
              <input type="hidden" name="leadId" value={lead.id} />
              <button class="btn" type="submit">Detach</button>
            </form>
          </div>
        {/each}
      </div>
    {:else}
      <p class="muted">No leads linked to this company yet.</p>
    {/if}
  </section>

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
              <div class="title-line"><a href={`/tasks/${task.id}/edit?returnTo=/companies/${data.company.id}`}>{task.title}</a><span class="status-chip">{task.statusLabel}</span><span class="status-chip">{task.urgencyLabel}</span><span class="status-chip">{task.focusLabel}</span></div>
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
  .company-header, .section-head, .mini-row, .deal-row, .title-line, .meta-row, .header-actions, .row-actions, .tag-row, .tag-add-row { display: flex; gap: 10px; align-items: flex-start; justify-content: space-between; }
  .title-line, .meta-row, .header-actions, .row-actions, .tag-row, .tag-add-row { align-items: center; justify-content: flex-start; flex-wrap: wrap; }
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
  .context-row { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; margin-top: 6px; }
  .chip { border: 1px solid var(--border); border-radius: 999px; padding: 2px 8px; font-size: 0.8rem; color: var(--muted); text-decoration: none; background: var(--panel); }
  .compact-list { margin: 8px 0; }
  .compact-row { padding: 8px 0; }
  .check-row { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
  .check-row input { width: auto; }
  .inline-form { display: inline; }
  .tag-add-row { margin-top: 10px; }
  .tag-add-row input { max-width: 320px; }
  textarea { resize: vertical; }
  @media (max-width: 860px) {
    .company-header, .section-head, .mini-row, .deal-row { flex-direction: column; align-items: stretch; }
    .main-grid, .grid.two, .grid.three, .grid.four { grid-template-columns: 1fr; }
  }
</style>
