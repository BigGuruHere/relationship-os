<!-- src/routes/deals/[id]/+page.svelte -->
<script lang="ts">
  // PURPOSE: Show one deal, its people, commercial conversation threads, notes, and tasks.
  // SECURITY: This page renders server-prepared decrypted display values only.
  import ExchangeItemsPanel from '$lib/ExchangeItemsPanel.svelte';
  import AgentBriefingsPanel from '$lib/AgentBriefingsPanel.svelte';
  import NotesPanel from '$lib/NotesPanel.svelte';
  import TasksPanel from '$lib/TasksPanel.svelte';
  import { closeDatePickerOnChange } from '$lib/closeDatePicker';

  export let data: any;
  export let form: any;

  $: dealNotesForPanel = (data.notes || []).map((note: any) => ({
    ...note,
    withLabel: note.contactId ? note.contactName : null,
    withHref: note.contactId ? `/contacts/${note.contactId}` : null,
    href: `/deals/${data.deal.id}/notes/${note.id}`
  }));

  $: threadNotesForPanel = (data.threadNotes || []).map((note: any) => ({
    ...note,
    withLabel: note.contactName,
    withHref: `/deals/${data.deal.id}/relationships/${note.dealContactId}`
  }));

  let showStateEditor = false;
  let showAddPerson = false;
  let showAddCompany = false;
  let showLinkProject = false;
  let contactQuery = '';
  $: filteredContactOptions = (data.contactOptions || [])
    .filter((contact: any) => !contactQuery || String(contact.name || '').toLowerCase().includes(contactQuery.toLowerCase()))
    .sort((a: any, b: any) => String(a.name || '').localeCompare(String(b.name || '')))
    .slice(0, 80);

  function fmtDate(value: string | Date | null | undefined) {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString();
  }

  function fmt(value: string | Date | null | undefined) {
    if (!value) return '';
    const date = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleString();
  }
</script>

<div class="container">
  <div class="card deal-header">
    <div class="header-main">
      <div class="deal-icon" aria-hidden="true">◆</div>
      <div>
        <div class="eyebrow">Deal</div>
        <h1>{data.deal.title}</h1>
        <div class="meta-row">
          <span class="status-chip">{data.deal.statusLabel}</span>
          <span>{data.deal.valueLabel}</span>
          <span>{data.deal.probability === null ? 'No probability' : `${data.deal.probability}% chance`}</span>
          <span>{data.deal.weightedValueLabel}</span>
        </div>
      </div>
    </div>
    <div class="actions">
      <button class="btn" type="button" on:click={() => (showStateEditor = !showStateEditor)}>{showStateEditor ? 'Close state' : 'Update state'}</button>
      <button class="btn" type="button" on:click={() => (showLinkProject = !showLinkProject)}>{showLinkProject ? 'Cancel project link' : 'Link project'}</button>
      <a class="btn" href={`/deals/${data.deal.id}/notes/new`}>Add voice/note</a>
      <form method="post" action="?/scoreDeal"><button class="btn" type="submit">Score opportunity</button></form>
      <a class="btn" href={`/deals/${data.deal.id}/edit`}>Edit</a>
    </div>
  </div>

  {#if form?.error}
    <div class="card error-card">{form.error}</div>
  {/if}

  <ExchangeItemsPanel items={data.exchangeItems ?? []} entityLabel={data.deal.title} />

  <AgentBriefingsPanel entityType="deal" entityId={data.deal.id} entityLabel={data.deal.title} artifacts={data.agentArtifacts ?? []} />

  <section class="card panel">
    <div class="section-head">
      <h2>Linked projects</h2>
      <button class="btn" type="button" on:click={() => (showLinkProject = !showLinkProject)}>{showLinkProject ? 'Cancel' : '＋ Link project'}</button>
    </div>
    <p class="muted small">These project links mean this deal belongs directly to a project. Deal tasks may still link to specific projects separately.</p>

    {#if showLinkProject}
      <form method="post" action="?/linkProject" class="add-person">
        <div class="grid two">
          <div class="field">
            <label for="linkProjectId">Project</label>
            <select id="linkProjectId" name="projectId" required>
              <option value="">Choose project</option>
              {#each data.projectOptionsForLinking as project}<option value={project.id}>{project.title} - {project.statusLabel}</option>{/each}
            </select>
          </div>
          <div class="field"><label for="projectLinkLabel">Label</label><input id="projectLinkLabel" name="label" placeholder="e.g. main campaign, buyer mandate" /></div>
        </div>
        <div class="field">
          <label for="projectLinkWorkstreamId">Workstream</label>
          <select id="projectLinkWorkstreamId" name="workstreamId">
            <option value="">No workstream</option>
            {#each data.workstreamOptions as ws}<option value={ws.id}>{ws.projectTitle} - {ws.name}</option>{/each}
          </select>
          <p class="hint">Choose a workstream from the selected project, if relevant.</p>
        </div>
        <div class="field"><label for="projectLinkNotes">Notes</label><textarea id="projectLinkNotes" name="notes" rows="2" placeholder="Why this deal belongs in the project"></textarea></div>
        <button class="btn primary" type="submit">Link project</button>
      </form>
    {/if}

    {#if data.linkedProjects?.length}
      <div class="people-list">
        {#each data.linkedProjects as link}
          <div class="person-card">
            <div>
              <div class="person-title"><a href={`/projects/${link.projectId}`}>{link.title}</a><span class="status-chip">{link.statusLabel}</span></div>
              {#if link.label}<div class="small">{link.label}</div>{/if}
              {#if link.workstream}<div class="small">Workstream: {link.workstream.name}</div>{/if}
              {#if link.notes}<p class="preline small">{link.notes}</p>{/if}
            </div>
            <form method="post" action="?/removeProjectLink" on:submit={(event) => { if (!confirm('Remove this project link? The deal and project will not be deleted.')) event.preventDefault(); }}>
              <input type="hidden" name="linkId" value={link.id} />
              <button class="btn" type="submit">Remove link</button>
            </form>
          </div>
        {/each}
      </div>
    {:else}
      <p class="muted">This deal is not directly linked to any projects yet.</p>
    {/if}
  </section>

  {#if showStateEditor}
    <div class="card panel">
      <h2>Deal state</h2>
      <form method="post" action="?/updateState">
        <div class="grid three">
          <div class="field">
            <label for="status">State</label>
            <select id="status" name="status">
              {#each data.statusOptions as opt}<option value={opt.value} selected={data.deal.status === opt.value}>{opt.label}</option>{/each}
            </select>
          </div>
          <div class="field">
            <label for="probability">Chance of closing %</label>
            <input id="probability" name="probability" type="number" min="0" max="100" value={data.deal.probability ?? ''} />
          </div>
          <div class="field">
            <label for="expectedCloseDate">Expected close</label>
            <input id="expectedCloseDate" name="expectedCloseDate" type="date" value={data.deal.expectedCloseDateInput} on:change={closeDatePickerOnChange} />
          </div>
        </div>
        <div class="grid two">
          <div class="field"><label for="value">Estimated value</label><input id="value" name="value" inputmode="decimal" value={data.deal.valueInput} /></div>
          <div class="field"><label for="currency">Currency</label><input id="currency" name="currency" maxlength="3" value={data.deal.currency} /></div>
        </div>
        <div class="field"><label for="lostReason">Lost reason</label><input id="lostReason" name="lostReason" placeholder="Only used if state is Lost" value={data.deal.lostReason} /></div>
        <button class="btn primary" type="submit">Save state</button>
      </form>
    </div>
  {/if}

  <div class="grid main-grid">
    <section class="card panel">
      <h2>Deal notes</h2>
      {#if data.deal.description}
        <p class="preline">{data.deal.description}</p>
        {#if data.deal.descriptionSummary}
          <div class="summary-box">
            <div class="muted small">AI summary</div>
            <p>{data.deal.descriptionSummary}</p>
          </div>
        {/if}
      {:else}
        <p class="muted">No deal notes yet.</p>
      {/if}
      <div class="detail-list">
        <div><strong>Expected close</strong><span>{fmtDate(data.deal.expectedCloseDate) || 'Not set'}</span></div>
        <div><strong>Closed at</strong><span>{fmtDate(data.deal.closedAt) || 'Not closed'}</span></div>
        {#if data.deal.lostReason}<div><strong>Lost reason</strong><span>{data.deal.lostReason}</span></div>{/if}
      </div>
    </section>

    <section class="card panel">
      <div class="section-head">
        <h2>People and commercial threads</h2>
        <button class="btn" type="button" on:click={() => (showAddPerson = !showAddPerson)}>{showAddPerson ? 'Cancel' : 'Add person'}</button>
      </div>

      {#if showAddPerson}
        <form method="post" action="?/addContact" class="add-person">
          <div class="field">
            <label for="contactSearch">Find contact</label>
            <input id="contactSearch" bind:value={contactQuery} placeholder="Type part of a name to filter contacts" />
          </div>
          <div class="field">
            <label for="contactId">Contact</label>
            <select id="contactId" name="contactId" required size="6">
              <option value="">Select contact</option>
              {#each filteredContactOptions as contact}<option value={contact.id}>{contact.name}</option>{/each}
            </select>
            <div class="muted small">Showing {filteredContactOptions.length} matching contact{filteredContactOptions.length === 1 ? '' : 's'}.</div>
          </div>
          <div class="grid two">
            <div class="field"><label for="relationshipType">Role</label><select id="relationshipType" name="relationshipType">{#each data.relationshipOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
            <div class="field"><label for="label">Custom label</label><input id="label" name="label" placeholder="e.g. sponsor, gatekeeper" /></div>
          </div>
          <div class="grid three">
            <div class="field"><label for="stage">Stage</label><select id="stage" name="stage">{#each data.dealContactStageOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
            <div class="field"><label for="interestLevel">Interest</label><select id="interestLevel" name="interestLevel">{#each data.dealContactInterestOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
            <div class="field"><label for="confidentialityStage">Confidentiality</label><select id="confidentialityStage" name="confidentialityStage">{#each data.dealConfidentialityOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          </div>
          <div class="grid two">
            <div class="field"><label for="nextAction">Next action</label><input id="nextAction" name="nextAction" placeholder="e.g. send NDA, follow up Friday" /></div>
            <div class="field"><label for="nextFollowUpAt">Next follow-up</label><input id="nextFollowUpAt" name="nextFollowUpAt" type="datetime-local" on:change={closeDatePickerOnChange} /></div>
          </div>
          <div class="field"><label for="buyingCriteria">Buying criteria / fit</label><textarea id="buyingCriteria" name="buyingCriteria" rows="2" placeholder="What would make this deal relevant to them?"></textarea></div>
          <div class="field"><label for="notes">Relationship notes</label><textarea id="notes" name="notes" rows="3" placeholder="Why this person matters to the deal"></textarea></div>
          <label class="check-row"><input type="checkbox" name="isPrimary" /><span>Primary relationship for this deal</span></label>
          <button class="btn primary" type="submit">Attach person</button>
        </form>
      {/if}

      {#if data.people.length === 0}
        <p class="muted">No people are attached yet.</p>
      {:else}
        <div class="people-list">
          {#each data.people as person}
            <div class="person-card">
              <div>
                <div class="person-title">
                  <a href={`/deals/${data.deal.id}/relationships/${person.id}`}>{person.name}</a>
                  {#if person.isPrimary}<span class="status-chip">Primary</span>{/if}
                  <span class="status-chip">{person.stageLabel}</span>
                  <span class="status-chip">{person.interestLabel}</span>
                </div>
                <div class="muted">{person.relationshipLabel} - confidentiality: {person.confidentialityLabel}</div>
                {#if person.company}<div class="muted small">{person.company}</div>{/if}
                {#if person.nextAction}<p class="preline small"><strong>Next:</strong> {person.nextAction}{person.nextFollowUpAt ? ` - ${fmt(person.nextFollowUpAt)}` : ''}</p>{/if}
                {#if person.notes}<p class="preline small">{person.notes}</p>{/if}
                <div class="muted small">{person.noteCount} thread note{person.noteCount === 1 ? '' : 's'} - {person.taskCount} task{person.taskCount === 1 ? '' : 's'}</div>
              </div>
              <div class="person-actions">
                <a class="btn" href={`/deals/${data.deal.id}/relationships/${person.id}`}>Open thread</a>
                <a class="btn" href={`/contacts/${person.contactId}`}>Person</a>
                {#if !person.isPrimary}
                  <form method="post" action="?/makePrimary"><input type="hidden" name="linkId" value={person.id} /><button class="btn" type="submit">Make primary</button></form>
                {/if}
                <form method="post" action="?/removeContact" on:submit={(event) => { if (!confirm('Remove this person from the deal?')) event.preventDefault(); }}>
                  <input type="hidden" name="linkId" value={person.id} />
                  <button class="btn" type="submit">Remove</button>
                </form>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="card panel">
      <div class="section-head">
        <h2>Companies and acquirers</h2>
        <button class="btn" type="button" on:click={() => (showAddCompany = !showAddCompany)}>{showAddCompany ? 'Cancel' : 'Add company'}</button>
      </div>

      {#if showAddCompany}
        <form method="post" action="?/addCompany" class="add-person">
          <div class="field">
            <label for="companyId">Company</label>
            <select id="companyId" name="companyId" required>
              <option value="">Select company</option>
              {#each data.companyOptions as company}<option value={company.id}>{company.name} - {company.kindLabel}</option>{/each}
            </select>
          </div>
          <div class="grid two">
            <div class="field"><label for="companyRelationshipType">Role</label><select id="companyRelationshipType" name="relationshipType">{#each data.relationshipOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
            <div class="field"><label for="companyLabel">Custom label</label><input id="companyLabel" name="label" placeholder="e.g. strategic acquirer, funder" /></div>
          </div>
          <div class="grid three">
            <div class="field"><label for="companyStage">Stage</label><select id="companyStage" name="stage">{#each data.dealContactStageOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
            <div class="field"><label for="companyInterest">Interest</label><select id="companyInterest" name="interestLevel">{#each data.dealContactInterestOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
            <div class="field"><label for="companyConfidentiality">Confidentiality</label><select id="companyConfidentiality" name="confidentialityStage">{#each data.dealConfidentialityOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          </div>
          <div class="grid two">
            <div class="field"><label for="companyNextAction">Next action</label><input id="companyNextAction" name="nextAction" placeholder="e.g. find M&A contact, send blind teaser" /></div>
            <div class="field"><label for="companyNextFollowUpAt">Next follow-up</label><input id="companyNextFollowUpAt" name="nextFollowUpAt" type="datetime-local" on:change={closeDatePickerOnChange} /></div>
          </div>
          <div class="field"><label for="acquisitionRationale">Why this company fits</label><textarea id="acquisitionRationale" name="acquisitionRationale" rows="2"></textarea></div>
          <div class="field"><label for="companyNotes">Company deal notes</label><textarea id="companyNotes" name="notes" rows="3"></textarea></div>
          <label class="check-row"><input type="checkbox" name="isPrimary" /><span>Primary company for this deal</span></label>
          <button class="btn primary" type="submit">Attach company</button>
        </form>
      {/if}

      {#if data.companies.length === 0}
        <p class="muted">No companies attached yet. Add likely acquirers, vendor businesses, funds, broker firms, or advisors.</p>
      {:else}
        <div class="people-list">
          {#each data.companies as company}
            <div class="person-card">
              <div>
                <div class="person-title">
                  <a href={`/companies/${company.companyId}`}>{company.name}</a>
                  {#if company.isPrimary}<span class="status-chip">Primary</span>{/if}
                  <span class="status-chip">{company.stageLabel}</span>
                  <span class="status-chip">{company.interestLabel}</span>
                </div>
                <div class="muted">{company.relationshipLabel} - {company.kindLabel} - confidentiality: {company.confidentialityLabel}</div>
                {#if company.industry || company.location}<div class="muted small">{company.industry}{company.industry && company.location ? ' - ' : ''}{company.location}</div>{/if}
                {#if company.nextAction}<p class="preline small"><strong>Next:</strong> {company.nextAction}{company.nextFollowUpAt ? ` - ${fmt(company.nextFollowUpAt)}` : ''}</p>{/if}
                {#if company.acquisitionRationale}<p class="preline small"><strong>Fit:</strong> {company.acquisitionRationale}</p>{/if}
                {#if company.notes}<p class="preline small">{company.notes}</p>{/if}
                <div class="muted small">{company.taskCount} task{company.taskCount === 1 ? '' : 's'}</div>
              </div>
              <div class="person-actions">
                <a class="btn" href={`/companies/${company.companyId}`}>Company</a>
                <form method="post" action="?/removeCompany" on:submit={(event) => { if (!confirm('Remove this company from the deal?')) event.preventDefault(); }}>
                  <input type="hidden" name="linkId" value={company.id} />
                  <button class="btn" type="submit">Remove</button>
                </form>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  </div>

  <TasksPanel
    tasks={data.tasks}
    heading="Next actions"
    emptyMessage="No open tasks for this deal."
    taskTypeOptions={data.taskTypeOptions}
    taskStatusOptions={data.taskStatusOptions}
    taskUrgencyOptions={data.taskUrgencyOptions}
    taskImportanceOptions={data.taskImportanceOptions}
    taskFocusOptions={data.taskFocusOptions}
    editReturnTo={`/deals/${data.deal.id}`}
    inboxHref="/tasks"
    inboxLabel="Open task inbox"
    lockedDealId={data.deal.id}
    contactOptions={data.taskContactOptions}
    companyOptions={data.taskCompanyOptions}
    projectOptions={data.projectOptions}
    workstreamOptions={data.workstreamOptions}
    marketLeadOptions={data.taskMarketLeadOptions}
    dealContactOptions={data.dealContactOptions}
    dealCompanyOptions={data.dealCompanyOptions}
  />

  <section class="card panel">
    <div class="section-head"><h2>Recent deal notes</h2><a class="btn" href={`/deals/${data.deal.id}/notes/new`}>New voice/note</a></div>
    <NotesPanel notes={dealNotesForPanel} emptyMessage="No deal notes yet. Add a typed note or record a voice note." />
  </section>


  <section class="card panel">
    <div class="section-head"><h2>Recent relationship notes</h2><span class="muted small">Notes on specific people in this deal</span></div>
    <NotesPanel notes={threadNotesForPanel} emptyMessage="No deal-person thread notes yet." />
  </section>

  <div class="bottom-actions"><a class="btn" href="/deals">Back to deals</a></div>
</div>

<style>
  .deal-header { padding: 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
  .header-main { display: flex; gap: 12px; align-items: flex-start; }
  .deal-icon { color: var(--accent-2); font-size: 1.8rem; line-height: 1; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  h1 { margin: 0; }
  h2 { margin: 0 0 10px; font-size: 1.1rem; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  .meta-row, .actions, .bottom-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .meta-row { margin-top: 8px; color: var(--muted); }
  .panel { padding: 16px; margin-bottom: 12px; }
  .main-grid { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 12px; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grid.three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .preline { white-space: pre-wrap; }
  .detail-list { display: grid; gap: 8px; margin-top: 12px; }
  .detail-list div { display: grid; grid-template-columns: 130px 1fr; gap: 8px; }
  .section-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
  .add-person { border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin: 10px 0; background: var(--panel); }
  .check-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--text); }
  .check-row input { width: auto; }
  .people-list { display: grid; gap: 8px; }
  .person-card { border-top: 1px solid var(--border); padding: 12px 0; display: flex; justify-content: space-between; gap: 12px; }
  .person-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-weight: 700; }
  .person-actions { display: flex; align-items: flex-start; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .summary-box { border: 1px solid var(--border); background: var(--panel); border-radius: 10px; padding: 10px; margin-top: 10px; }
  .summary-box p { margin: 4px 0 0; white-space: pre-wrap; }
  .status-chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 2px 8px; font-size: 0.8rem; color: var(--muted); }
  .error-card { padding: 12px; color: var(--danger); margin-bottom: 12px; }
  textarea { resize: vertical; }
  @media (max-width: 860px) {
    .deal-header, .person-card, .section-head { flex-direction: column; }
    .main-grid, .grid.two, .grid.three { grid-template-columns: 1fr; }
    .actions, .bottom-actions { align-items: stretch; }
  }
</style>
