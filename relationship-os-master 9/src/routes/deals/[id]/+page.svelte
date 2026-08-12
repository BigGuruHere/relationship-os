<!-- src/routes/deals/[id]/+page.svelte -->
<script lang="ts">
  // PURPOSE: Show one deal, its people, commercial conversation threads, notes, and tasks.
  // SECURITY: This page renders server-prepared decrypted display values only.
  import VoiceTextField from '$lib/recording/VoiceTextField.svelte';
  import ExchangeItemsPanel from '$lib/ExchangeItemsPanel.svelte';
  import AgentBriefingsPanel from '$lib/AgentBriefingsPanel.svelte';

  export let data: any;
  export let form: any;

  let showStateEditor = false;
  let showAddPerson = false;
  let showAddCompany = false;
  let showAddTask = false;
  let newTaskNotes = '';
  let newTaskSummary = '';

  function submitContainingForm(event: Event) {
    // IT: Status changes are small enough to submit immediately from the dropdown.
    (event.currentTarget as HTMLSelectElement).form?.requestSubmit();
  }

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
      <button class="btn" type="button" on:click={() => (showAddTask = !showAddTask)}>{showAddTask ? 'Cancel task' : 'Add task'}</button>
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
            <input id="expectedCloseDate" name="expectedCloseDate" type="date" value={data.deal.expectedCloseDateInput} />
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

  {#if showAddTask}
    <div class="card panel">
      <h2>Add task for this deal</h2>
      <form method="post" action="?/createTask" class="task-form">
        <div class="field"><label for="taskTitle">Task</label><input id="taskTitle" name="title" placeholder="e.g. Follow up buyer list" required /></div>
        <div class="grid four">
          <div class="field"><label for="taskType">Type</label><select id="taskType" name="taskType">{#each data.taskTypeOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="taskUrgency">Urgency</label><select id="taskUrgency" name="urgency">{#each data.taskUrgencyOptions as opt}<option value={opt.value} selected={opt.value === 'NORMAL'}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="taskImportance">Importance</label><select id="taskImportance" name="importance">{#each data.taskImportanceOptions as opt}<option value={opt.value} selected={opt.value === 'NORMAL'}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="taskStatus">Status</label><select id="taskStatus" name="status">{#each data.taskStatusOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid two">
          <div class="field"><label for="taskDueAt">Due</label><input id="taskDueAt" name="dueAt" type="datetime-local" /></div>
          <div class="field">
            <label for="taskDealContactId">Specific person in deal</label>
            <select id="taskDealContactId" name="dealContactId">
              <option value="">No specific person thread</option>
              {#each data.people as person}<option value={person.id}>{person.name} - {person.relationshipLabel}</option>{/each}
            </select>
          </div>
        </div>
        <div class="grid two">
          <div class="field">
            <label for="taskDealCompanyId">Specific company in deal</label>
            <select id="taskDealCompanyId" name="dealCompanyId">
              <option value="">No specific company thread</option>
              {#each data.companies as company}<option value={company.id}>{company.name} - {company.relationshipLabel}</option>{/each}
            </select>
          </div>
          <div class="field">
            <label for="taskWaitingOnContactId">Waiting on</label>
            <select id="taskWaitingOnContactId" name="waitingOnContactId">
              <option value="">Nobody external</option>
              {#each data.people as person}<option value={person.contactId}>{person.name}</option>{/each}
            </select>
          </div>
        </div>
        <div class="grid two">
          <div class="field">
            <label for="taskProjectId">Project</label>
            <select id="taskProjectId" name="projectId">
              <option value="">No project</option>
              {#each data.projectOptions as project}<option value={project.id}>{project.title}</option>{/each}
            </select>
          </div>
        </div>
        <div class="field">
          <VoiceTextField
            id="taskNotes"
            textName="notes"
            summaryName="summary"
            label="Task notes"
            placeholder="Record or type the context, outcome, or next step."
            rows={3}
            bind:value={newTaskNotes}
            bind:summary={newTaskSummary}
            contextLabel="task note"
          />
        </div>
        <button class="btn primary" type="submit">Save task</button>
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
            <label for="contactId">Contact</label>
            <select id="contactId" name="contactId" required>
              <option value="">Select contact</option>
              {#each data.contactOptions as contact}<option value={contact.id}>{contact.name}</option>{/each}
            </select>
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
            <div class="field"><label for="nextFollowUpAt">Next follow-up</label><input id="nextFollowUpAt" name="nextFollowUpAt" type="datetime-local" /></div>
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
            <div class="field"><label for="companyNextFollowUpAt">Next follow-up</label><input id="companyNextFollowUpAt" name="nextFollowUpAt" type="datetime-local" /></div>
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

  <section class="card panel">
    <div class="section-head"><h2>Next actions</h2><a class="btn" href="/tasks">Open task inbox</a></div>
    {#if data.tasks.length === 0}
      <p class="muted">No open tasks for this deal.</p>
    {:else}
      <div class="task-list">
        {#each data.tasks as task}
          <div class="task-row">
            <div>
              <div class="person-title"><span>{task.title}</span><span class="status-chip">{task.statusLabel}</span><span class="status-chip">{task.urgencyLabel}</span></div>
              <div class="muted small">{task.taskTypeLabel} - due {fmt(task.dueAt) || 'not set'}</div>
              <div class="context-row small">
                {#if task.contact}<a class="chip" href={`/contacts/${task.contact.id}`}>Person: {task.contact.name}</a>{/if}
                {#if task.company}<a class="chip" href={`/companies/${task.company.id}`}>Company: {task.company.name}</a>{/if}
                {#if task.dealContact}<a class="chip" href={`/deals/${data.deal.id}/relationships/${task.dealContact.id}`}>Person thread: {task.dealContact.contactName}</a>{/if}
                {#if task.dealCompany}<a class="chip" href={`/companies/${task.dealCompany.companyId}`}>Company thread: {task.dealCompany.companyName}</a>{/if}
                {#if task.waitingOnContact}<a class="chip" href={`/contacts/${task.waitingOnContact.id}`}>Waiting on: {task.waitingOnContact.name}</a>{/if}
                {#if task.project}<a class="chip" href={`/projects/${task.project.id}`}>Project: {task.project.title}</a>{/if}
              </div>
              {#if task.notes}<p class="preline small">{task.notes}</p>{/if}
              {#if task.summary}<div class="summary-box"><div class="muted small">AI summary</div><p>{task.summary}</p></div>{/if}
              <a class="btn tiny" href={`/tasks/${task.id}/edit?returnTo=/deals/${data.deal.id}`}>Edit task</a>
            </div>
            <form method="post" action="?/updateTaskStatus" class="status-form">
              <input type="hidden" name="taskId" value={task.id} />
              <select name="status" on:change={submitContainingForm}>{#each data.taskStatusOptions as opt}<option value={opt.value} selected={task.status === opt.value}>{opt.label}</option>{/each}</select>
              
            </form>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <section class="card panel">
    <div class="section-head"><h2>Recent deal notes</h2><a class="btn" href={`/deals/${data.deal.id}/notes/new`}>New voice/note</a></div>
    {#if data.notes.length === 0}
      <p class="muted">No deal notes yet. Add a typed note or record a voice note.</p>
    {:else}
      <ul class="notes-list">
        {#each data.notes as note}
          <li class="note-row">
            <div class="note-meta">
              <span class="status-chip">{note.channel}</span>
              <span class="muted">{fmtDate(note.occurredAt)}</span>
              {#if note.contactId}<span class="muted">with <a href={`/contacts/${note.contactId}`}>{note.contactName}</a></span>{/if}
            </div>
            <a class="preline note-preview note-link" href={`/deals/${data.deal.id}/notes/${note.id}`}>{note.preview || '(empty)'}</a>
          </li>
        {/each}
      </ul>
    {/if}
  </section>


  <section class="card panel">
    <div class="section-head"><h2>Recent relationship notes</h2><span class="muted small">Notes on specific people in this deal</span></div>
    {#if !data.threadNotes || data.threadNotes.length === 0}
      <p class="muted">No deal-person thread notes yet.</p>
    {:else}
      <ul class="notes-list">
        {#each data.threadNotes as note}
          <li class="note-row">
            <div class="note-meta">
              <span class="status-chip">{note.channel}</span>
              <span class="muted">{fmtDate(note.occurredAt)}</span>
              <span class="muted">with <a href={`/deals/${data.deal.id}/relationships/${note.dealContactId}`}>{note.contactName}</a></span>
            </div>
            <p class="preline note-preview">{note.preview || '(empty)'}</p>
          </li>
        {/each}
      </ul>
    {/if}
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
  .meta-row, .actions, .bottom-actions, .status-form, .context-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .meta-row { margin-top: 8px; color: var(--muted); }
  .panel { padding: 16px; margin-bottom: 12px; }
  .main-grid { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 12px; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grid.three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .grid.four { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .preline { white-space: pre-wrap; }
  .detail-list { display: grid; gap: 8px; margin-top: 12px; }
  .detail-list div { display: grid; grid-template-columns: 130px 1fr; gap: 8px; }
  .section-head { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
  .add-person, .task-form { border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin: 10px 0; background: var(--panel); }
  .check-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--text); }
  .check-row input { width: auto; }
  .people-list, .notes-list, .task-list { display: grid; gap: 8px; }
  .notes-list { list-style: none; padding: 0; margin: 0; }
  .note-row { border-top: 1px solid var(--border); padding: 12px 0; }
  .note-meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 6px; }
  .note-preview { margin: 0; display: block; color: inherit; text-decoration: none; }
  .note-link:hover { text-decoration: underline; }
  .person-card, .task-row { border-top: 1px solid var(--border); padding: 12px 0; display: flex; justify-content: space-between; gap: 12px; }
  .person-title { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-weight: 700; }
  .person-actions { display: flex; align-items: flex-start; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
  .summary-box { border: 1px solid var(--border); background: var(--panel); border-radius: 10px; padding: 10px; margin-top: 10px; }
  .summary-box p { margin: 4px 0 0; white-space: pre-wrap; }
  .btn.tiny { padding: 4px 8px; font-size: 0.82rem; }
  .status-chip, .chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 2px 8px; font-size: 0.8rem; color: var(--muted); }
  .chip { color: var(--text); text-decoration: none; }
  .error-card { padding: 12px; color: var(--danger); margin-bottom: 12px; }
  textarea { resize: vertical; }
  @media (max-width: 860px) {
    .deal-header, .person-card, .task-row, .section-head { flex-direction: column; }
    .main-grid, .grid.two, .grid.three, .grid.four { grid-template-columns: 1fr; }
    .actions, .bottom-actions { align-items: stretch; }
  }
</style>
