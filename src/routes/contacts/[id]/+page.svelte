<!-- src/routes/contacts/[id]/+page.svelte -->
<script lang="ts">
  // PURPOSE: Show a contact with tags, relationships, deals, reminders, and notes.
  // SECURITY: Data has already been decrypted server side where needed.
  import VoiceTextField from '$lib/recording/VoiceTextField.svelte';
  import ExchangeItemsPanel from '$lib/ExchangeItemsPanel.svelte';
  import AgentBriefingsPanel from '$lib/AgentBriefingsPanel.svelte';

  export let data: any;
  export let form: any;


  const contact = data?.contact ?? null;
  const tags = contact?.tags ?? [];
  const interactions = data?.interactions ?? [];
  const dealNotes = data?.dealNotes ?? [];
  const dealContactNotes = data?.dealContactNotes ?? [];
  const reminders = data?.reminders ?? [];
  const tasks = data?.tasks ?? [];
  const projectOptions = data?.projectOptions ?? [];
  const taskStatusOptions = data?.taskStatusOptions ?? [];
  const taskUrgencyOptions = data?.taskUrgencyOptions ?? [];
  const taskImportanceOptions = data?.taskImportanceOptions ?? [];
  const taskTypeOptions = data?.taskTypeOptions ?? [];
  const relationships = data?.relationships ?? [];
  const companies = data?.companies ?? [];
  const contactOptions = data?.contactOptions ?? [];
  const deals = data?.deals ?? [];
  const dealOptions = data?.dealOptions ?? [];
  const dealRelationshipOptions = data?.dealRelationshipOptions ?? [];
  const linkedLeads = data?.linkedLeads ?? [];

  let showCadenceEditor = false;
  let showReminderPanel = false;
  let showAddRelationship = false;
  let showAddDeal = false;
  let showAddTask = false;
  let newTaskNotes = '';
  let newTaskSummary = '';

  function submitContainingForm(event: Event) {
    // IT: Task status changes are intentionally saved immediately from the dropdown.
    (event.currentTarget as HTMLSelectElement).form?.requestSubmit();
  }

  function fmt(d: string | Date | null | undefined) {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleString();
  }

  function fmtDate(d: string | Date | null | undefined) {
    if (!d) return '';
    const dt = typeof d === 'string' ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return '';
    return dt.toLocaleDateString();
  }

  function getVcardUrl() {
    if (!contact) return '';
    const params = new URLSearchParams();
    params.set('name', contact.name || 'Contact');
    if (contact.company) params.set('org', contact.company);
    if (contact.position) params.set('title', contact.position);
    if (contact.email) params.set('email', contact.email);
    if (contact.phone) params.set('phone', contact.phone);
    if (contact.linkedin) params.set('link', contact.linkedin);
    return `/api/vcard?${params.toString()}`;
  }
</script>

{#if !contact}
  <div class="container">
    <div class="card" style="padding:20px; max-width:680px; margin:0 auto;">
      <h1 style="margin-top:0;">Contact not found</h1>
      <p>Head back to the <a href="/">home page</a>.</p>
    </div>
  </div>
{:else}
  <div class="container">
    {#if form?.error}<div class="card" style="padding:12px; margin-bottom:12px; color:var(--danger);">{form.error}</div>{/if}
    <div class="card hero-card">
      <div class="title-row">
        <div>
          <div class="eyebrow">Contact</div>
          <h1>{contact.name}</h1>
        </div>
        <div class="action-row">
          <a class="btn primary" href={`/contacts/${contact.id}/interactions/new`}>Add voice/note</a>
          <button class="btn" type="button" on:click={() => (showAddTask = !showAddTask)}>{showAddTask ? 'Cancel task' : 'Add task'}</button>
          <a class="btn" href={getVcardUrl()} download aria-label="Download vCard" title="Download vCard">vCard</a>
          <form method="post" action="?/scoreContact"><button class="btn" type="submit">Score opportunity</button></form>
          <form method="post" action="?/enrichContact"><button class="btn" type="submit">Enrich contact</button></form>
          <a class="btn" href={`/agents/enrichment/new?mode=contact&entityType=contact&entityId=${contact.id}&enableWebResearch=true&returnTo=/contacts/${contact.id}`}>Enrichment options</a>
          <form method="post" action="?/createLeadFromContact"><button class="btn" type="submit">Create lead</button></form>
          <a class="btn" href={`/contacts/${contact.id}/edit`} aria-label="Edit contact" title="Edit contact">Edit</a>
        </div>
      </div>

      <div class="quick-row">
        <button type="button" class="btn" on:click={() => (showCadenceEditor = !showCadenceEditor)}>
          {#if contact.reconnectEveryDays}
            Edit cadence - every {contact.reconnectEveryDays} day{contact.reconnectEveryDays === 1 ? '' : 's'}
          {:else}
            Add cadence
          {/if}
        </button>

        <button type="button" class="btn" on:click={() => (showReminderPanel = !showReminderPanel)}>
          {#if reminders.length > 0}
            {reminders.length} open reminder{reminders.length === 1 ? '' : 's'}
          {:else}
            No open reminders
          {/if}
        </button>

        <form method="post" action="?/markContactedToday" style="display:inline;">
          <button class="btn" title="Set last contacted to now">Mark contacted today</button>
        </form>
      </div>

      <div class="cadence-strip">
        <div>
          <strong>Relationship cadence</strong>
          <div class="muted small">
            {#if contact.reconnectEveryDays}
              Reconnect every {contact.reconnectEveryDays} day{contact.reconnectEveryDays === 1 ? '' : 's'}
              {contact.lastContactedAt ? ` - last contacted ${fmtDate(contact.lastContactedAt)}` : ' - no last contact date'}
            {:else}
              No cadence set yet. Add one to keep this relationship warm.
            {/if}
          </div>
        </div>
        <button type="button" class="btn" on:click={() => (showCadenceEditor = !showCadenceEditor)}>
          {showCadenceEditor ? 'Close cadence' : contact.reconnectEveryDays ? 'Edit cadence' : 'Add cadence'}
        </button>
      </div>

      {#if showCadenceEditor}
        <div class="inline-panel">
          <form method="post" action="?/setCadence" class="cadence-form">
            <div class="field compact grow">
              <label for="days">Reconnect every days</label>
              <input id="days" name="days" type="number" min="1" max="3650" value={contact.reconnectEveryDays ?? ''} placeholder="30" />
            </div>
            <button class="btn primary" type="submit">Save cadence</button>
          </form>

          <div class="preset-row" aria-label="Cadence presets">
            <form method="post" action="?/setCadence"><input type="hidden" name="days" value="7" /><button class="btn" type="submit">Weekly</button></form>
            <form method="post" action="?/setCadence"><input type="hidden" name="days" value="14" /><button class="btn" type="submit">Fortnightly</button></form>
            <form method="post" action="?/setCadence"><input type="hidden" name="days" value="30" /><button class="btn" type="submit">Monthly</button></form>
            <form method="post" action="?/setCadence"><input type="hidden" name="days" value="90" /><button class="btn" type="submit">Quarterly</button></form>
            <form method="post" action="?/setCadence"><input type="hidden" name="days" value="" /><button class="btn" type="submit">Clear cadence</button></form>
          </div>
        </div>
      {/if}

      {#if showReminderPanel}
        <div class="inline-panel">
          <form method="post" action="?/createReminder" class="reminder-form">
            <div class="field compact">
              <label for="dueAt">Due</label>
              <input id="dueAt" name="dueAt" type="datetime-local" required />
            </div>
            <div class="field compact grow">
              <label for="note">Note</label>
              <input id="note" name="note" placeholder="What should you remember?" />
            </div>
            <button class="btn primary" type="submit">Add reminder</button>
          </form>

          {#if data.reminders?.length}
            <div class="mini-list">
              {#each data.reminders as reminder}
                <div class="mini-row">
                  <span>{fmt(reminder.dueAt)} {reminder.note ? `- ${reminder.note}` : ''}</span>
                  <form method="post" action="?/completeReminder">
                    <input type="hidden" name="reminderId" value={reminder.id} />
                    <button class="btn" type="submit">Done</button>
                  </form>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <ExchangeItemsPanel items={data.exchangeItems ?? []} entityLabel={contact.name} />

    <AgentBriefingsPanel entityType="contact" entityId={contact.id} entityLabel={contact.name} artifacts={data.agentArtifacts ?? []} />

    {#if showAddTask}
      <div class="inline-panel">
        <h2>Add task for {contact.name}</h2>
        <form method="post" action="?/createTask" class="nested-form">
          <div class="field"><label for="taskTitle">Task</label><input id="taskTitle" name="title" placeholder="e.g. Follow up about Auspath" required /></div>
          <div class="grid two">
            <div class="field"><label for="taskType">Type</label><select id="taskType" name="taskType">{#each taskTypeOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
            <div class="field"><label for="taskDueAt">Due</label><input id="taskDueAt" name="dueAt" type="datetime-local" /></div>
          </div>
          <div class="grid two">
            <div class="field"><label for="taskUrgency">Urgency</label><select id="taskUrgency" name="urgency">{#each taskUrgencyOptions as opt}<option value={opt.value} selected={opt.value === 'NORMAL'}>{opt.label}</option>{/each}</select></div>
            <div class="field"><label for="taskImportance">Importance</label><select id="taskImportance" name="importance">{#each taskImportanceOptions as opt}<option value={opt.value} selected={opt.value === 'NORMAL'}>{opt.label}</option>{/each}</select></div>
          </div>
          <div class="grid two">
            <div class="field"><label for="taskStatus">Status</label><select id="taskStatus" name="status">{#each taskStatusOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
            <div class="field"><label for="taskDealId">Deal context</label><select id="taskDealId" name="dealId"><option value="">No deal</option>{#each deals as deal}<option value={deal.id}>{deal.title}</option>{/each}</select></div>
          </div>
          <div class="grid two">
            <div class="field"><label for="taskDealContactId">Specific deal thread</label><select id="taskDealContactId" name="dealContactId"><option value="">No specific thread</option>{#each deals as deal}<option value={deal.linkId}>{deal.title} - {deal.relationshipLabel}</option>{/each}</select></div>
            <div class="field"><label for="taskProjectId">Project</label><select id="taskProjectId" name="projectId"><option value="">No project</option>{#each projectOptions as project}<option value={project.id}>{project.title}</option>{/each}</select></div>
          </div>
          <label class="check-row"><input type="checkbox" name="waitingOnThisPerson" /><span>This task is waiting on {contact.name}</span></label>
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

    <div class="content-grid">
      <section class="card panel">
        <h2>Details</h2>
        <div class="grid details">
          <div><strong>Email</strong></div><div>{contact.email || ' - '}</div>
          <div><strong>Phone</strong></div><div>{contact.phone || ' - '}</div>
          <div><strong>Company</strong></div><div>{contact.company || ' - '}</div>
          <div><strong>Position</strong></div><div>{contact.position || ' - '}</div>
          <div><strong>LinkedIn</strong></div><div>{contact.linkedin || ' - '}</div>
          <div><strong>Address</strong></div><div>{contact.address || ' - '}</div>
          <div><strong>Source</strong></div><div>{contact.sourceLabel || 'Manual'}</div>
          <div><strong>Usual communication</strong></div><div>{contact.usualCommunicationMethodLabel || 'Not set'}</div>
          <div><strong>Contact attempt</strong></div><div>{contact.contactAttemptStatusLabel || 'Not contacted'}</div>
          <div><strong>Buyer status</strong></div><div>{contact.buyerStatusLabel || 'Not asked'}</div>
          <div><strong>Seller status</strong></div><div>{contact.sellerStatusLabel || 'Not asked'}</div>
          <div><strong>Created</strong></div><div>{fmt(contact.createdAt)}</div>
          <div><strong>Cadence</strong></div><div>{contact.reconnectEveryDays ? `Every ${contact.reconnectEveryDays} days` : 'Not set'}</div>
          <div><strong>Last contacted</strong></div><div>{fmt(contact.lastContactedAt) || 'Not set'}</div>
        </div>

        <div class="section-block">
          <h2>Companies</h2>
          {#if companies.length === 0}
            <p class="muted">No company memberships yet.</p>
          {:else}
            <div class="mini-list">
              {#each companies as company}
                <div class="mini-row">
                  <div>
                    <div class="strong-link"><a href={`/companies/${company.companyId}`}>{company.name}</a> {#if company.isPrimary}<span class="status-chip">Primary</span>{/if}</div>
                    <div class="muted small">{company.title}{company.title && company.department ? ' - ' : ''}{company.department} - {company.kindLabel} - {company.statusLabel}</div>
                    {#if company.industry || company.location}<div class="muted small">{company.industry}{company.industry && company.location ? ' - ' : ''}{company.location}</div>{/if}
                    {#if company.notes}<p class="preline muted small">{company.notes}</p>{/if}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="section-block">
          <div class="section-head compact-head">
            <h2>Linked leads</h2>
            <a class="btn" href={`/leads/new?contactId=${contact.id}`}>New lead</a>
          </div>
          {#if linkedLeads.length === 0}
            <p class="muted">No leads are linked to this contact yet.</p>
          {:else}
            <div class="lead-list-small">
              {#each linkedLeads as lead}
                <div class="lead-card-small">
                  <div>
                    <div class="deal-title-line">
                      <a href={`/leads/${lead.id}`}>{lead.title}</a>
                      <span class="status-chip">{lead.typeLabel}</span>
                      <span class="status-chip">{lead.statusLabel}</span>
                    </div>
                    <div class="muted small">
                      Source: {lead.sourceLabel || 'Not set'}
                      {#if lead.project}
                        - Project: <a href={`/projects/${lead.project.id}`}>{lead.project.title}</a>
                      {/if}
                    </div>
                    <div class="muted small">
                      Contact: {lead.contactAttemptStatusLabel} - Buyer: {lead.buyerStatusLabel} - Seller: {lead.sellerStatusLabel}
                    </div>
                    <div class="muted small">
                      Priority {lead.priority}/5 - Confidence {lead.confidence}/100
                      {lead.convertedAt ? ` - converted ${fmtDate(lead.convertedAt)}` : ''}
                      {lead.lastContactedAt ? ` - last contact ${fmtDate(lead.lastContactedAt)}` : ''}
                    </div>
                    {#if lead.companyName}<div class="muted small">Company from lead: {lead.companyName}</div>{/if}
                    {#if lead.nextAction}<p class="preline muted small"><strong>Next:</strong> {lead.nextAction}</p>{/if}
                  </div>
                  <a class="btn" href={`/leads/${lead.id}`}>Open lead</a>
                </div>
              {/each}
            </div>
          {/if}
        </div>

        <div class="section-block">
          <h2>Tags</h2>
          {#if tags.length > 0}
            <div class="tag-row">
              {#each tags as t}
                <form method="post" action="?/removeTag">
                  <input type="hidden" name="slug" value={t.slug} />
                  <button class="chip" title="Remove tag">
                    <span class="chip-text">{t.name}</span>
                    <span class="chip-x" aria-hidden="true">×</span>
                  </button>
                </form>
              {/each}
            </div>
          {:else}
            <p class="muted">No tags yet.</p>
          {/if}

          <form method="post" action="?/addTag" class="inline-form-row">
            <input name="name" placeholder="Add a tag" aria-label="Tag name" required />
            <button class="btn primary" type="submit">Add</button>
          </form>
        </div>
      </section>

      <section class="card panel">
        <div class="section-head">
          <h2>Deals</h2>
          <div class="action-row">
            <a class="btn" href={`/deals/new`}>New deal</a>
            <button type="button" class="btn" on:click={() => (showAddDeal = !showAddDeal)}>
              {showAddDeal ? 'Cancel' : 'Attach deal'}
            </button>
          </div>
        </div>

        {#if showAddDeal}
          <form method="post" action="?/addDeal" class="nested-form">
            <div class="field">
              <label for="dealId">Deal</label>
              <select id="dealId" name="dealId" required>
                <option value="">Select deal</option>
                {#each dealOptions as deal}
                  <option value={deal.id}>{deal.title} ({deal.statusLabel})</option>
                {/each}
              </select>
            </div>

            <div class="grid two">
              <div class="field">
                <label for="dealRelationshipType">Role in deal</label>
                <select id="dealRelationshipType" name="relationshipType">
                  {#each dealRelationshipOptions as opt}
                    <option value={opt.value}>{opt.label}</option>
                  {/each}
                </select>
              </div>
              <div class="field">
                <label for="dealLabel">Custom label</label>
                <input id="dealLabel" name="label" placeholder="e.g. introducer, sponsor" />
              </div>
            </div>

            <div class="grid three">
              <div class="field"><label for="dealStage">Stage</label><select id="dealStage" name="stage">{#each data.dealContactStageOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
              <div class="field"><label for="dealInterest">Interest</label><select id="dealInterest" name="interestLevel">{#each data.dealContactInterestOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
              <div class="field"><label for="dealConfidentiality">Confidentiality</label><select id="dealConfidentiality" name="confidentialityStage">{#each data.dealConfidentialityOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
            </div>

            <div class="grid two">
              <div class="field"><label for="dealNextAction">Next action</label><input id="dealNextAction" name="nextAction" placeholder="e.g. send NDA, follow up Friday" /></div>
              <div class="field"><label for="dealNextFollowUpAt">Next follow-up</label><input id="dealNextFollowUpAt" name="nextFollowUpAt" type="datetime-local" /></div>
            </div>

            <div class="field"><label for="buyingCriteria">Buying criteria / fit</label><textarea id="buyingCriteria" name="buyingCriteria" rows="2"></textarea></div>

            <div class="field">
              <label for="dealNotes">Relationship notes</label>
              <textarea id="dealNotes" name="notes" rows="3"></textarea>
            </div>

            <label class="check-row">
              <input type="checkbox" name="isPrimary" />
              <span>Primary relationship for this deal</span>
            </label>

            <button class="btn primary" type="submit">Attach deal</button>
          </form>
        {/if}

        {#if deals.length === 0}
          <p class="muted">No deals attached yet.</p>
        {:else}
          <div class="deal-list">
            {#each deals as deal}
              <div class="deal-card-inline">
                <div>
                  <div class="deal-title-line">
                    <span class="deal-icon" aria-hidden="true">◆</span>
                    <a href={`/deals/${deal.id}/relationships/${deal.linkId}`}>{deal.title}</a>
                    {#if deal.isPrimary}<span class="status-chip">Primary</span>{/if}
                  </div>
                  <div class="muted small">{deal.relationshipLabel} - {deal.statusLabel} - {deal.valueLabel}</div>
                  <div class="muted small">Thread: {deal.stageLabel || deal.stage || 'Not contacted'} - {deal.interestLabel || deal.interestLevel || 'Unknown'}{deal.nextFollowUpAt ? ` - follow up ${fmtDate(deal.nextFollowUpAt)}` : ''}</div>
                  {#if deal.probability !== null}
                    <div class="muted small">{deal.probability}% chance{deal.expectedCloseDate ? ` - expected ${fmtDate(deal.expectedCloseDate)}` : ''}</div>
                  {/if}
                  {#if deal.nextAction}<p class="muted preline"><strong>Next:</strong> {deal.nextAction}</p>{/if}
                  {#if deal.notes}<p class="muted preline">{deal.notes}</p>{/if}
                  <div class="muted small">{deal.noteCount || 0} thread notes - {deal.taskCount || 0} tasks</div>
                  <div class="action-row"><a class="btn" href={`/deals/${deal.id}`}>Open deal</a><a class="btn" href={`/deals/${deal.id}/relationships/${deal.linkId}`}>Open thread</a></div>
                </div>
                <form method="post" action="?/removeDeal" on:submit={(event) => { if (!confirm('Remove this deal relationship?')) event.preventDefault(); }}>
                  <input type="hidden" name="linkId" value={deal.linkId} />
                  <button class="btn" type="submit">Remove</button>
                </form>
              </div>
            {/each}
          </div>
        {/if}
      </section>
    </div>

    <section class="card panel">
      <div class="section-head">
        <h2>Connections</h2>
        <button type="button" class="btn" on:click={() => (showAddRelationship = !showAddRelationship)}>
          {showAddRelationship ? 'Cancel' : 'Add connection'}
        </button>
      </div>

      {#if showAddRelationship}
        <form method="post" action="?/addRelationship" class="nested-form">
          <div class="field">
            <label for="otherContactId">Connect to</label>
            <select id="otherContactId" name="otherContactId" required>
              <option value="">Select contact</option>
              {#each contactOptions as opt}
                <option value={opt.id}>{opt.name}</option>
              {/each}
            </select>
          </div>

          <div class="field">
            <label for="label">Relationship</label>
            <input id="label" name="label" placeholder="e.g. colleague, friend, spouse" />
          </div>

          <button class="btn primary" type="submit">Add connection</button>
        </form>
      {/if}

      {#if relationships.length === 0}
        <p class="muted">No connections yet.</p>
      {:else}
        <ul class="plain-list">
          {#each relationships as rel}
            <li class="list-row">
              <div>
                <a href={`/contacts/${rel.otherContactId}`} class="strong-link">{rel.otherContactName}</a>
                <span class="muted">({rel.label})</span>
              </div>
              <form method="post" action="?/removeRelationship">
                <input type="hidden" name="relationshipId" value={rel.id} />
                <button class="btn" type="submit">Remove</button>
              </form>
            </li>
          {/each}
        </ul>
      {/if}
    </section>

    <section class="card panel">
      <div class="section-head">
        <h2>Open tasks</h2>
        <a class="btn" href="/tasks">Open task inbox</a>
      </div>
      {#if tasks.length === 0}
        <p class="muted">No open tasks for this person.</p>
      {:else}
        <div class="mini-list">
          {#each tasks as task}
            <div class="mini-row task-mini-row">
              <div>
                <div class="strong-link">{task.title} <span class="status-chip">{task.statusLabel}</span> <span class="status-chip">{task.urgencyLabel}</span></div>
                <div class="muted small">{task.taskTypeLabel} - due {fmt(task.dueAt) || 'not set'}{task.deal ? ` - ${task.deal.title}` : ''}</div>
                {#if task.notes}<p class="preline muted small">{task.notes}</p>{/if}
                {#if task.summary}<div class="summary-box"><div class="muted small">AI summary</div><p>{task.summary}</p></div>{/if}
              </div>
              <form method="post" action="?/updateTaskStatus">
                <input type="hidden" name="taskId" value={task.id} />
                <select name="status" on:change={submitContainingForm}>{#each taskStatusOptions as opt}<option value={opt.value} selected={task.status === opt.value}>{opt.label}</option>{/each}</select>
              </form>
              <a class="btn" href={`/tasks/${task.id}/edit?returnTo=/contacts/${contact.id}`}>Edit</a>
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="card panel">
      <div class="section-head">
        <h2>Recent notes</h2>
        <a class="btn" href={`/contacts/${contact.id}/interactions/new`}>New voice/note</a>
      </div>

      {#if interactions.length === 0}
        <p class="muted">No notes yet. Add the first one.</p>
      {:else}
        <ul class="notes">
          {#each interactions as n}
            <li class="note">
              <div class="note-meta">
                <span class="pill">{n.channel}</span>
                <span class="muted">{fmt(n.occurredAt)}</span>
              </div>
              <a class="note-link" href={`/contacts/${contact.id}/interactions/${n.id}`}>{n.preview || '(empty)'}</a>
            </li>
          {/each}
        </ul>
      {/if}

      {#if dealNotes.length > 0}
        <div class="section-block">
          <h2>Deal notes involving this person</h2>
          <ul class="notes">
            {#each dealNotes as note}
              <li class="note">
                <div class="note-meta">
                  <span class="pill">{note.channel}</span>
                  <span class="muted">{fmt(note.occurredAt)}</span>
                  <span class="muted">on <a href={`/deals/${note.dealId}`}>{note.dealTitle}</a> ({note.dealStatusLabel})</span>
                </div>
                <a class="preline note-link" href={`/deals/${note.dealId}/notes/${note.id}`}>{note.preview || '(empty)'}</a>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

      {#if dealContactNotes.length > 0}
        <div class="section-block">
          <h2>Deal relationship notes involving this person</h2>
          <ul class="notes">
            {#each dealContactNotes as note}
              <li class="note">
                <div class="note-meta">
                  <span class="pill">{note.channel}</span>
                  <span class="muted">{fmt(note.occurredAt)}</span>
                  <span class="muted">on <a href={`/deals/${note.dealId}/relationships/${note.dealContactId}`}>{note.dealTitle}</a> ({note.dealStatusLabel})</span>
                </div>
                <p class="preline note-link">{note.preview || '(empty)'}</p>
              </li>
            {/each}
          </ul>
        </div>
      {/if}

    </section>

    <div style="display:flex; gap:10px; margin-top:16px;">
      <a class="btn" href="/">Back</a>
    </div>
  </div>
{/if}

<style>
  .container { padding: 12px; }
  .hero-card, .panel { padding: 18px; margin-bottom: 12px; }
  .title-row, .section-head, .deal-card-inline, .list-row, .mini-row { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .action-row, .quick-row, .inline-form-row, .reminder-form, .cadence-form, .preset-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  h1 { margin: 0; }
  h2 { margin: 0 0 10px; font-size: 1.1rem; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  .strong-link { font-weight: 700; }
  .content-grid { display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 12px; }
  .grid.details { display: grid; grid-template-columns: 120px 1fr; gap: 8px; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .section-block { margin-top: 18px; }
  .inline-form-row { margin-top: 10px; }
  .inline-form-row input { flex: 1 1 180px; }
  .inline-panel, .nested-form, .cadence-strip { border: 1px solid var(--border); border-radius: 12px; padding: 12px; margin-top: 10px; background: var(--panel); }
  .cadence-strip { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
  .preset-row { margin-top: 10px; }
  .preset-row form { display: inline-flex; }
  .field.compact { margin-bottom: 0; }
  .grow { flex: 1 1 220px; }
  .mini-list { margin-top: 10px; display: grid; gap: 6px; }
  .deal-list { display: grid; gap: 8px; }
  .deal-card-inline { border-top: 1px solid var(--border); padding: 12px 0; }
  .lead-list-small { margin-top: 10px; display: grid; gap: 8px; }
  .lead-card-small { border-top: 1px solid var(--border); padding: 10px 0; display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .compact-head { margin-bottom: 8px; }
  .deal-title-line { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; font-weight: 700; }
  .deal-icon { color: var(--accent-2); line-height: 1; }
  .summary-box { border: 1px solid var(--border); background: var(--panel); border-radius: 10px; padding: 8px; margin: 8px 0; }
  .summary-box p { margin: 4px 0 0; white-space: pre-wrap; }
  .status-chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 2px 8px; font-size: 0.8rem; color: var(--muted); }
  .check-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: var(--text); }
  .check-row input { width: auto; }
  .plain-list, .notes { list-style: none; padding: 0; margin: 0; }
  .list-row { padding: 10px 0; border-top: 1px solid var(--border); align-items: center; }
  .note { padding: 10px 0; border-top: 1px solid var(--border); }
  .note-meta { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
  .preline { white-space: pre-wrap; }
  textarea { resize: vertical; }
  @media (max-width: 860px) {
    .title-row, .section-head, .deal-card-inline, .lead-card-small, .list-row, .cadence-strip { flex-direction: column; align-items: stretch; }
    .content-grid, .grid.two { grid-template-columns: 1fr; }
    .quick-row, .reminder-form { flex-direction: column; align-items: stretch; }
  }
</style>
