<!-- src/routes/leads/[id]/+page.svelte -->
<script lang="ts">
  import VoiceTextField from '$lib/recording/VoiceTextField.svelte';
  import TasksPanel from '$lib/TasksPanel.svelte';

  export let data: any;
  export let form: any;

  const lead = data.lead;
  let showEdit = false;
  let leadNoteText = '';
  let leadNoteSummary = '';
  let editSourceChoice = lead.sourceChoice || (lead.leadSourceId ? `custom:${lead.leadSourceId}` : `builtin:${lead.source || 'MANUAL'}`);
  let companySearch = '';

  $: filteredCompanies = (data.companies || []).filter((company: any) => {
    const q = companySearch.trim().toLowerCase();
    if (!q) return true;
    return `${company.name || ''} ${company.phone || ''} ${company.website || ''}`.toLowerCase().includes(q);
  });

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


</script>

<div class="container">
  <div class="page-head">
    <div>
      <div class="eyebrow">Lead</div>
      <h1>{lead.title}</h1>
      <p class="muted">{lead.typeLabel} - {lead.statusLabel} - {lead.sourceLabel}</p>
      <p class="muted small">Contact: {lead.contactAttemptStatusLabel} - Buyer: {lead.buyerStatusLabel} - Seller: {lead.sellerStatusLabel}</p>
    </div>
    <div class="actions">
      <a class="btn" href="/leads">All leads</a>
      {#if lead.projectId}<a class="btn" href={`/projects/${lead.projectId}`}>Open project</a>{/if}
      <button class="btn" type="button" on:click={() => (showEdit = !showEdit)}>{showEdit ? 'Close edit' : 'Edit lead'}</button>
    </div>
  </div>

  {#if form?.error}<div class="card error-card">{form.error}</div>{/if}

  <div class="grid two">
    <section class="card panel">
      <h2>Details</h2>
      <div class="details-grid">
        <strong>Person</strong><span>{lead.name || ' - '}</span>
        <strong>Role/title</strong><span>{lead.roleTitle || ' - '}</span>
        <strong>Company</strong><span>{lead.companyName || ' - '}</span>
        <strong>Email</strong><span>{lead.email || ' - '}</span>
        <strong>Phone</strong><span>{lead.phone || ' - '}</span>
        <strong>Website</strong><span>{lead.website || ' - '}</span>
        <strong>LinkedIn</strong><span>{lead.linkedin || ' - '}</span>
        <strong>Geography</strong><span>{lead.geography || ' - '}</span>
        <strong>Address</strong><span>{lead.address || ' - '}</span>
        <strong>Usual communication</strong><span>{lead.usualCommunicationMethodLabel}</span>
        <strong>Contact attempt</strong><span>{lead.contactAttemptStatusLabel}</span>
        <strong>Last contacted</strong><span>{fmt(lead.lastContactedAt)}</span>
        <strong>Buyer status</strong><span>{lead.buyerStatusLabel}</span>
        <strong>Seller status</strong><span>{lead.sellerStatusLabel}</span>
        <strong>Priority</strong><span>{lead.priority}/5</span>
        <strong>Confidence</strong><span>{lead.confidence}/100</span>
        <strong>Project</strong><span>{#if lead.projectId}<a href={`/projects/${lead.projectId}`}>{lead.linkedProjectTitle || 'Open project'}</a>{:else}Standalone lead{/if}</span>
        <strong>Workstream</strong><span>{lead.linkedWorkstreamTitle || ' - '}</span>
        <strong>Next action</strong><span>{lead.nextAction || ' - '}</span>
      </div>
      {#if lead.description}<h3>Description</h3><p class="preline">{lead.description}</p>{/if}
      {#if lead.notes}<h3>Original notes</h3><p class="preline">{lead.notes}</p>{/if}
    </section>

    <section class="card panel">
      <h2>Convert or link</h2>
      <p class="muted small">Conversions create stronger CRM records while keeping this lead, notes, and tasks as history.</p>
      <div class="button-grid">
        {#if lead.contactId}
          <a class="chip" href={`/contacts/${lead.contactId}`}>Contact exists</a>
        {:else}
          <form method="post" action="?/convertToContact"><button class="btn primary" type="submit">Convert to contact</button></form>
        {/if}
        {#if lead.companyId}
          <a class="chip" href={`/companies/${lead.companyId}`}>Company exists</a>
        {:else}
          <form method="post" action="?/convertToCompany"><button class="btn primary" type="submit">Convert to company</button></form>
        {/if}
        <form method="post" action="?/convertToDeal"><button class="btn" type="submit">Convert to deal</button></form>
        <form method="post" action="?/convertToWant"><button class="btn" type="submit">Convert to want</button></form>
        <form method="post" action="?/convertToOffer"><button class="btn" type="submit">Convert to offer</button></form>
      </div>

      <h3>Linked records</h3>
      <div class="details-grid">
        <strong>Contact</strong><span>{#if lead.contactId}<a href={`/contacts/${lead.contactId}`}>{lead.linkedContactName || 'Open contact'}</a>{:else} - {/if}</span>
        <strong>Company</strong><span>{#if lead.companyId}<a href={`/companies/${lead.companyId}`}>{lead.linkedCompanyName || 'Open company'}</a>{:else} - {/if}</span>
        <strong>Deal</strong><span>{#if lead.dealId}<a href={`/deals/${lead.dealId}`}>{lead.linkedDealTitle || 'Open deal'}</a>{:else} - {/if}</span>
        <strong>Project</strong><span>{#if lead.projectId}<a href={`/projects/${lead.projectId}`}>{lead.linkedProjectTitle || 'Open project'}</a>{:else} - {/if}</span>
        <strong>Workstream</strong><span>{lead.linkedWorkstreamTitle || ' - '}</span>
        <strong>Want/offer</strong><span>{#if lead.exchangeItemId}{lead.linkedExchangeTitle || 'Created'}{:else} - {/if}</span>
      </div>
      {#if lead.companyId}
        <form method="post" action="?/unlinkCompany" on:submit={(e) => { if (!confirm('Unlink this lead from the company?')) e.preventDefault(); }}><button class="btn" type="submit">Unlink company</button></form>
      {:else}
        <details class="nested-form">
          <summary>Link to existing company</summary>
          <form method="post" action="?/linkCompany">
            <div class="field"><label for="companySearch">Search companies</label><input id="companySearch" bind:value={companySearch} placeholder="Type company, phone or website" /></div>
            <div class="field"><label for="companyId">Company</label><select id="companyId" name="companyId" required size={Math.min(8, Math.max(3, filteredCompanies.length || 3))}><option value="">Select company</option>{#each filteredCompanies as company}<option value={company.id}>{company.name}{company.website ? ` - ${company.website}` : ''}</option>{/each}</select></div>
            {#if filteredCompanies.length}
              <div class="mini-list compact-list">
                {#each filteredCompanies.slice(0, 8) as company}
                  <div class="mini-row compact-row"><div><strong>{company.name}</strong><div class="muted small">{company.phone || ''}{company.phone && company.website ? ' - ' : ''}{company.website || ''}</div></div><a class="btn" href={`/companies/${company.id}`} target="_blank" rel="noreferrer">Open</a></div>
                {/each}
              </div>
            {/if}
            <button class="btn primary" type="submit">Link company</button>
          </form>
        </details>
      {/if}
      {#if lead.convertedAt}<p class="muted small">Converted on {fmt(lead.convertedAt)}</p>{/if}
      <form method="post" action="?/archive" on:submit={(e) => { if (!confirm('Archive this lead?')) e.preventDefault(); }}><button class="btn danger" type="submit">Archive lead</button></form>
    </section>
  </div>

  {#if showEdit}
    <section class="card panel">
      <h2>Edit lead</h2>
      <form method="post" action="?/update" class="create-form">
        <div class="grid two">
          <div class="field"><label for="title">Lead title</label><input id="title" name="title" value={lead.title} /></div>
          <div class="field"><label for="typeEdit">Lead type</label><select id="typeEdit" name="type">{#each data.leadTypes as opt}<option value={opt.value} selected={lead.type === opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid three">
          <div class="field"><label for="statusEdit">Status</label><select id="statusEdit" name="status">{#each data.leadStatuses as opt}<option value={opt.value} selected={lead.status === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="sourceChoiceEdit">Source</label><select id="sourceChoiceEdit" name="sourceChoice" bind:value={editSourceChoice}>{#each data.leadSourceOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="commEdit">Usual communication</label><select id="commEdit" name="usualCommunicationMethod">{#each data.communicationMethods as opt}<option value={opt.value} selected={(lead.usualCommunicationMethod || '') === opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        {#if editSourceChoice === 'CUSTOM'}
          <div class="field"><label for="newLeadSourceEdit">Custom source</label><input id="newLeadSourceEdit" name="newLeadSource" placeholder="e.g. Sam spreadsheet, MFAA list" /></div>
        {/if}
        <div class="grid three">
          <div class="field"><label for="contactAttemptEdit">Contact attempt</label><select id="contactAttemptEdit" name="contactAttemptStatus">{#each data.contactAttemptStatuses as opt}<option value={opt.value} selected={lead.contactAttemptStatus === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="buyerStatusEdit">Buyer status</label><select id="buyerStatusEdit" name="buyerStatus">{#each data.buyerQualificationStatuses as opt}<option value={opt.value} selected={lead.buyerStatus === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="sellerStatusEdit">Seller status</label><select id="sellerStatusEdit" name="sellerStatus">{#each data.sellerQualificationStatuses as opt}<option value={opt.value} selected={lead.sellerStatus === opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="field"><label for="lastContactedAtEdit">Last contacted</label><input id="lastContactedAtEdit" name="lastContactedAt" type="datetime-local" value={lead.lastContactedAtInput} on:change={(e) => (e.currentTarget as HTMLInputElement).blur()} /></div>
        <div class="grid two"><div class="field"><label for="projectIdEdit">Project</label><select id="projectIdEdit" name="projectId"><option value="">Standalone lead</option>{#each data.projects as project}<option value={project.id} selected={(lead.projectId || '') === project.id}>{project.title}</option>{/each}</select></div><div class="field"><label for="workstreamIdEdit">Workstream</label><select id="workstreamIdEdit" name="workstreamId"><option value="">No workstream</option>{#each data.workstreams as ws}<option value={ws.id} selected={(lead.workstreamId || '') === ws.id}>{ws.projectTitle} - {ws.name}</option>{/each}</select></div></div>
        <div class="grid two"><div class="field"><label for="name">Person name</label><input id="name" name="name" value={lead.name} /></div><div class="field"><label for="companyName">Company name</label><input id="companyName" name="companyName" value={lead.companyName} /></div></div>
        <div class="grid two"><div class="field"><label for="email">Email</label><input id="email" name="email" type="email" value={lead.email} /></div><div class="field"><label for="phone">Phone</label><input id="phone" name="phone" value={lead.phone} /></div></div>
        <div class="grid two"><div class="field"><label for="website">Website</label><input id="website" name="website" value={lead.website} /></div><div class="field"><label for="linkedin">LinkedIn</label><input id="linkedin" name="linkedin" value={lead.linkedin} /></div></div>
        <div class="grid two"><div class="field"><label for="roleTitle">Role/title</label><input id="roleTitle" name="roleTitle" value={lead.roleTitle} /></div><div class="field"><label for="geography">Geography</label><input id="geography" name="geography" value={lead.geography} /></div></div>
        <div class="field"><label for="address">Address</label><input id="address" name="address" value={lead.address} /></div>
        <div class="grid three"><div class="field"><label for="priority">Priority</label><input id="priority" name="priority" type="number" min="1" max="5" value={lead.priority} /></div><div class="field"><label for="confidence">Confidence</label><input id="confidence" name="confidence" type="number" min="0" max="100" value={lead.confidence} /></div><div class="field"><label for="currency">Currency</label><input id="currency" name="currency" value={lead.currency} /></div></div>
        <div class="grid two"><div class="field"><label for="valueMin">Value min</label><input id="valueMin" name="valueMin" value={lead.valueMin} /></div><div class="field"><label for="valueMax">Value max</label><input id="valueMax" name="valueMax" value={lead.valueMax} /></div></div>
        <div class="field"><label for="description">Description</label><textarea id="description" name="description" rows="3">{lead.description}</textarea></div>
        <div class="field"><label for="notes">Original notes</label><textarea id="notes" name="notes" rows="3">{lead.notes}</textarea></div>
        <div class="grid two"><div class="field"><label for="sourceUrl">Source URL</label><input id="sourceUrl" name="sourceUrl" value={lead.sourceUrl} /></div><div class="field"><label for="nextAction">Next action</label><input id="nextAction" name="nextAction" value={lead.nextAction} /></div></div>
        <button class="btn primary" type="submit">Save lead</button>
      </form>
    </section>
  {/if}

  <section class="card panel">
    <details open>
      <summary><strong>Lead notes</strong></summary>
      <form method="post" action="?/createLeadNote" class="nested-form">
        <div class="grid two">
          <div class="field"><label for="leadNoteChannel">Channel</label><select id="leadNoteChannel" name="channel">{#each data.noteChannels as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="leadNoteOccurredAt">Note date</label><input id="leadNoteOccurredAt" name="occurredAt" type="datetime-local" on:change={(e) => (e.currentTarget as HTMLInputElement).blur()} /></div>
        </div>
        <VoiceTextField
          id="leadNote"
          textName="body"
          summaryName="summary"
          label="Add lead note"
          placeholder="Record or type research, calls, source context, or qualification notes."
          rows={4}
          bind:value={leadNoteText}
          bind:summary={leadNoteSummary}
          contextLabel="lead note"
        />
        <button class="btn primary" type="submit">Save note</button>
      </form>
      {#if data.leadNotes?.length}
        <div class="mini-list">
          {#each data.leadNotes as note}
            <div class="mini-row">
              <div>
                <div class="muted small"><span class="status-chip">{note.channelLabel}</span> {fmt(note.occurredAt)}</div>
                <p class="preline small">{note.body}</p>
                {#if note.summary}<div class="summary-box"><div class="muted small">AI summary</div><p>{note.summary}</p></div>{/if}
                <details class="edit-note">
                  <summary>Edit note</summary>
                  <form method="post" action="?/updateLeadNote" class="nested-form">
                    <input type="hidden" name="noteId" value={note.id} />
                    <div class="grid two">
                      <div class="field"><label for={`noteChannel-${note.id}`}>Channel</label><select id={`noteChannel-${note.id}`} name="channel">{#each data.noteChannels as opt}<option value={opt.value} selected={note.channel === opt.value}>{opt.label}</option>{/each}</select></div>
                      <div class="field"><label for={`noteOccurred-${note.id}`}>Note date</label><input id={`noteOccurred-${note.id}`} name="occurredAt" type="datetime-local" value={note.occurredAtInput} on:change={(e) => (e.currentTarget as HTMLInputElement).blur()} /></div>
                    </div>
                    <div class="field"><label for={`noteBody-${note.id}`}>Note</label><textarea id={`noteBody-${note.id}`} name="body" rows="4">{note.body}</textarea></div>
                    <div class="field"><label for={`noteSummary-${note.id}`}>Summary</label><textarea id={`noteSummary-${note.id}`} name="summary" rows="2">{note.summary}</textarea></div>
                    <div class="actions small-actions"><button class="btn primary" type="submit">Save note changes</button><button class="btn" type="button" on:click={closeContainingDetails}>Cancel</button></div>
                  </form>
                </details>
              </div>
              <form method="post" action="?/deleteLeadNote" on:submit={(event) => { if (!confirm('Delete this lead note?')) event.preventDefault(); }}>
                <input type="hidden" name="noteId" value={note.id} />
                <button class="btn" type="submit">Delete</button>
              </form>
            </div>
          {/each}
        </div>
      {:else}
        <p class="muted">No lead notes yet.</p>
      {/if}
    </details>
  </section>

  <TasksPanel
    tasks={data.leadTasks}
    heading="Lead tasks"
    emptyMessage="No lead tasks yet."
    taskTypeOptions={data.taskTypes}
    taskStatusOptions={data.taskStatuses}
    taskUrgencyOptions={data.taskUrgencies}
    taskImportanceOptions={data.taskImportances}
    taskFocusOptions={data.taskFocusOptions}
    editReturnTo={`/leads/${lead.id}`}
    showDelete
    inboxHref="/tasks"
    inboxLabel="Task inbox"
    lockedMarketLeadId={lead.id}
    lockedWorkstreamId={lead.workstreamId || ''}
    contactOptions={data.taskContactOptions}
    workstreamOptions={data.workstreams}
    dealContactOptions={data.taskDealContactOptions}
    dealCompanyOptions={data.taskDealCompanyOptions}
  />
</div>

<style>
  .container { padding: 12px; }
  .page-head, .actions { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; flex-wrap: wrap; }
  .actions { justify-content: flex-start; align-items: center; }
  h1, h2, h3 { margin-top: 0; } h2 { font-size: 1.15rem; } h3 { font-size: 1rem; margin-bottom: 6px; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); } .small { font-size: 0.9rem; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grid.three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .panel, .error-card { padding: 14px; margin-bottom: 12px; }
  .error-card { color: var(--danger); }
  .details-grid { display: grid; grid-template-columns: 150px 1fr; gap: 8px 12px; margin: 10px 0; }
  .button-grid { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0 18px; }
  .field { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
  .preline { white-space: pre-wrap; }
  .btn.danger { background:#b00020; color:#fff; border-color:#b00020; }
  details summary { cursor: pointer; margin-bottom: 10px; }
  .nested-form { border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin: 10px 0; background: var(--panel); }
  .mini-list { display: grid; gap: 8px; }
  .mini-row { border-top: 1px solid var(--border); padding: 12px 0; display: flex; justify-content: space-between; gap: 12px; }
  .status-chip, .chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 3px 9px; font-size: 0.85rem; color: var(--muted); }
  .chip { display: inline-flex; align-items: center; color: var(--text); text-decoration: none; padding: 10px 14px; }
  .summary-box { border: 1px solid var(--border); background: var(--panel); border-radius: 10px; padding: 10px; margin: 8px 0; }
  .summary-box p { margin: 4px 0 0; white-space: pre-wrap; }
  textarea { resize: vertical; }
  @media (max-width: 860px) { .page-head, .mini-row { flex-direction: column; } .grid.two, .grid.three, .details-grid { grid-template-columns: 1fr; } }
  .compact-list { margin: 8px 0; }
  .compact-row { padding: 8px 0; }
</style>
