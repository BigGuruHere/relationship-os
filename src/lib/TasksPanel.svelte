<!-- src/lib/TasksPanel.svelte -->
<script lang="ts">
  // PURPOSE: Reusable entity-local task list plus inline "add task" form.
  // SECURITY: Submit goes to the current page's server actions, which tenant-scope and encrypt values.
  import VoiceTextField from '$lib/recording/VoiceTextField.svelte';
  import { closeDatePickerOnChange } from '$lib/closeDatePicker';

  export let tasks: any[] = [];
  export let heading = 'Tasks';
  export let emptyMessage = 'No tasks yet.';
  export let createAction = '?/createTask';
  export let taskTypeOptions: any[] = [];
  export let taskStatusOptions: any[] = [];
  export let taskUrgencyOptions: any[] = [];
  export let taskImportanceOptions: any[] = [];
  export let taskFocusOptions: any[] = [];
  export let editReturnTo = '';
  export let showDelete = false;
  export let deleteAction = '?/deleteTask';
  export let inboxHref = '';
  export let inboxLabel = 'Task inbox';
  export let linkFieldsLabel = 'Link to...';

  // IT: full canonical picker option lists - see src/routes/tasks/+page.server.ts loadOptions().
  export let contactOptions: any[] = [];
  export let dealOptions: any[] = [];
  export let companyOptions: any[] = [];
  export let projectOptions: any[] = [];
  export let workstreamOptions: any[] = [];
  export let marketLeadOptions: any[] = [];
  export let dealContactOptions: any[] = [];
  export let dealCompanyOptions: any[] = [];
  export let wantOptions: any[] = [];
  export let offerOptions: any[] = [];

  // IT: when set, hides that picker entirely - the real value is supplied server-side via the
  // calling page's own context object passed to createTaskFromForm, not via a hidden input here.
  export let lockedContactId = '';
  export let lockedDealId = '';
  export let lockedCompanyId = '';
  export let lockedProjectId = '';
  export let lockedDealContactId = '';
  export let lockedMarketLeadId = '';
  export let lockedWantId = '';
  export let lockedOfferId = '';

  // IT: unlike the locked*Id props above, this never hides the workstream picker - it only
  // preselects that option by default. The workstream field is always visible and editable, and
  // whatever the form submits at save time is what createTaskFromForm actually uses.
  export let lockedWorkstreamId = '';

  let showForm = false;
  let notesValue = '';
  let summaryValue = '';

  function fmtDate(value: string | Date | null | undefined) {
    if (!value) return 'not set';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return 'not set';
    return d.toLocaleString();
  }

  function submitContainingForm(event: Event) {
    // IT: Status changes submit immediately so there is no confusing Update button.
    (event.currentTarget as HTMLSelectElement).form?.requestSubmit();
  }

  function dueClass(value: string | Date | null | undefined, status: string | null | undefined) {
    if (!value || status === 'DONE' || status === 'CANCELLED') return '';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '';
    return d.getTime() < Date.now() ? 'overdue' : '';
  }

  // IT: some pages nest {id,title}, the company-contact page sends flat dealId/dealTitle - accept either.
  function dealInfo(task: any) {
    if (task.deal) return { id: task.deal.id, title: task.deal.title };
    if (task.dealId) return { id: task.dealId, title: task.dealTitle || 'Deal' };
    return null;
  }

  function projectInfo(task: any) {
    if (task.project) return { id: task.project.id, title: task.project.title };
    if (task.projectId) return { id: task.projectId, title: task.projectTitle || 'Project' };
    return null;
  }
</script>

<section class="card tasks-panel">
  <div class="section-head">
    <h2>{heading}</h2>
    <div class="head-actions">
      {#if inboxHref}<a class="btn" href={inboxHref}>{inboxLabel}</a>{/if}
      <button class="btn primary" type="button" on:click={() => (showForm = !showForm)}>{showForm ? 'Cancel task' : 'Add task'}</button>
    </div>
  </div>

  {#if showForm}
    <form method="post" action={createAction} class="task-form">
      <div class="field"><label for="tp-title">Task</label><input id="tp-title" name="title" required placeholder="e.g. Follow up next steps" /></div>

      <div class="grid four">
        <div class="field"><label for="tp-type">Type</label><select id="tp-type" name="taskType">{#each taskTypeOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        <div class="field"><label for="tp-focus">Focus</label><select id="tp-focus" name="focus">{#each taskFocusOptions as opt}<option value={opt.value} selected={opt.value === 'NEW'}>{opt.label}</option>{/each}</select></div>
        <div class="field"><label for="tp-urgency">Urgency</label><select id="tp-urgency" name="urgency">{#each taskUrgencyOptions as opt}<option value={opt.value} selected={opt.value === 'NORMAL'}>{opt.label}</option>{/each}</select></div>
        <div class="field"><label for="tp-importance">Importance</label><select id="tp-importance" name="importance">{#each taskImportanceOptions as opt}<option value={opt.value} selected={opt.value === 'NORMAL'}>{opt.label}</option>{/each}</select></div>
      </div>

      <div class="grid two">
        <div class="field"><label for="tp-status">Status</label><select id="tp-status" name="status">{#each taskStatusOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        <div class="field"><label for="tp-due">Due</label><input id="tp-due" name="dueAt" type="datetime-local" on:change={closeDatePickerOnChange} /></div>
      </div>

      <div class="field">
        <label for="tp-workstream">Workstream</label>
        <select id="tp-workstream" name="workstreamId">
          <option value="">No workstream</option>
          {#each workstreamOptions as opt}<option value={opt.id} selected={Boolean(lockedWorkstreamId) && opt.id === lockedWorkstreamId}>{opt.projectTitle} - {opt.name}</option>{/each}
        </select>
        <p class="hint">Selecting a workstream will also set the parent project.</p>
      </div>

      <div class="field">
        <VoiceTextField
          id="tp-notes"
          textName="notes"
          summaryName="summary"
          label="Task notes"
          placeholder="Record or type the context, outcome, or next step."
          rows={3}
          bind:value={notesValue}
          bind:summary={summaryValue}
          contextLabel="task note"
        />
      </div>

      <details class="link-more">
        <summary>{linkFieldsLabel}</summary>
        <div class="link-more-body">
          <div class="field"><label for="tp-snooze">Snooze until</label><input id="tp-snooze" name="snoozedUntil" type="datetime-local" on:change={closeDatePickerOnChange} /></div>

          <div class="grid two">
            {#if !lockedContactId && !lockedMarketLeadId}
              <div class="field"><label for="tp-contact">Attach person</label><select id="tp-contact" name="contactId"><option value="">No person</option>{#each contactOptions as opt}<option value={opt.id}>{opt.name}</option>{/each}</select></div>
            {/if}
            {#if !lockedDealId && !lockedMarketLeadId}
              <div class="field"><label for="tp-deal">Attach deal</label><select id="tp-deal" name="dealId"><option value="">No deal</option>{#each dealOptions as opt}<option value={opt.id}>{opt.title}</option>{/each}</select></div>
            {/if}
          </div>

          <div class="grid two">
            {#if !lockedCompanyId && !lockedMarketLeadId}
              <div class="field"><label for="tp-company">Attach company</label><select id="tp-company" name="companyId"><option value="">No company</option>{#each companyOptions as opt}<option value={opt.id}>{opt.name}</option>{/each}</select></div>
            {/if}
            {#if !lockedProjectId && !lockedMarketLeadId}
              <div class="field"><label for="tp-project">Attach project</label><select id="tp-project" name="projectId"><option value="">No project</option>{#each projectOptions as opt}<option value={opt.id}>{opt.title}</option>{/each}</select></div>
            {/if}
          </div>

          <div class="grid two">
            {#if !lockedWantId && wantOptions.length > 0}
              <div class="field">
                <label for="tp-want">Attach want</label>
                <select id="tp-want" name="wantId">
                  <option value="">No want</option>
                  {#each wantOptions as opt}<option value={opt.id}>{opt.title}{opt.statusLabel ? ` - ${opt.statusLabel}` : ''}</option>{/each}
                </select>
                <p class="hint">This list is intentionally scoped by the current page. Use Edit task for full Want search.</p>
              </div>
            {/if}
            {#if !lockedOfferId && offerOptions.length > 0}
              <div class="field">
                <label for="tp-offer">Attach offer</label>
                <select id="tp-offer" name="offerId">
                  <option value="">No offer</option>
                  {#each offerOptions as opt}<option value={opt.id}>{opt.title}{opt.statusLabel ? ` - ${opt.statusLabel}` : ''}</option>{/each}
                </select>
                <p class="hint">This list is intentionally scoped by the current page. Use Edit task for full Offer search.</p>
              </div>
            {/if}
          </div>

          {#if !lockedMarketLeadId}
            <div class="field">
              <label for="tp-lead">Attach lead</label>
              <select id="tp-lead" name="marketLeadId">
                <option value="">No lead</option>
                {#each marketLeadOptions as opt}<option value={opt.id}>{opt.title} - {opt.statusLabel}</option>{/each}
              </select>
              <p class="hint">Selecting a lead can also inherit its project, contact, company, or deal links.</p>
            </div>
          {/if}

          <div class="grid two">
            {#if !lockedDealContactId}
              <div class="field">
                <label for="tp-deal-contact">Attach deal-person thread</label>
                <select id="tp-deal-contact" name="dealContactId">
                  <option value="">No specific deal relationship</option>
                  {#each dealContactOptions as opt}<option value={opt.id}>{opt.title}</option>{/each}
                </select>
                <p class="hint">Selecting this also sets the related person and deal.</p>
              </div>
            {/if}
            <div class="field">
              <label for="tp-deal-company">Attach deal-company thread</label>
              <select id="tp-deal-company" name="dealCompanyId">
                <option value="">No specific deal-company relationship</option>
                {#each dealCompanyOptions as opt}<option value={opt.id}>{opt.title}</option>{/each}
              </select>
              <p class="hint">Selecting this also sets the related company and deal.</p>
            </div>
          </div>

          <div class="grid two">
            <div class="field">
              <label for="tp-assigned-contact">Assigned to contact</label>
              <select id="tp-assigned-contact" name="assignedToContactId">
                <option value="">No assigned contact</option>
                {#each contactOptions as opt}<option value={opt.id}>{opt.name}</option>{/each}
              </select>
            </div>
            <div class="field">
              <label for="tp-waiting-on">Waiting on</label>
              <select id="tp-waiting-on" name="waitingOnContactId">
                <option value="">Nobody external</option>
                {#each contactOptions as opt}<option value={opt.id} selected={Boolean(lockedContactId) && opt.id === lockedContactId}>{opt.name}</option>{/each}
              </select>
            </div>
          </div>

          <div class="field"><label for="tp-assigned-text">Assigned to text</label><input id="tp-assigned-text" name="assignedToText" placeholder="e.g. me, Sam, accountant, vendor" /></div>
        </div>
      </details>

      <button class="btn primary" type="submit">Save task</button>
    </form>
  {/if}

  {#if tasks.length === 0}
    <p class="muted">{emptyMessage}</p>
  {:else}
    <div class="task-list">
      {#each tasks as task (task.id)}
        {@const deal = dealInfo(task)}
        {@const project = projectInfo(task)}
        <article class="task-row {dueClass(task.dueAt, task.status)}">
          <details class="task-details">
            <summary>
              <span class="task-title-row">
                <a href={`/tasks/${task.id}`}>{task.title}</a>
                <span class="status-chip">{task.statusLabel}</span>
                <span class="status-chip">{task.urgencyLabel}</span>
                {#if task.focusLabel}<span class="status-chip">{task.focusLabel}</span>{/if}
              </span>
              <span class="muted small">{task.taskTypeLabel}{task.importanceLabel ? ` - ${task.importanceLabel} importance` : ''} - due {fmtDate(task.dueAt)}</span>
            </summary>
            <div class="task-full">
              <div class="task-main">
                {#if task.notes}<p class="preline small">{task.notes}</p>{/if}
                {#if task.summary}<div class="summary-box"><div class="muted small">AI summary</div><p>{task.summary}</p></div>{/if}
                <div class="context-row">
                  {#if task.contact}<a class="chip" href={`/contacts/${task.contact.id}`}>Person: {task.contact.name}</a>{/if}
                  {#if task.company}<a class="chip" href={`/companies/${task.company.id}`}>Company: {task.company.name}</a>{/if}
                  {#if deal}<a class="chip" href={`/deals/${deal.id}`}>Deal: {deal.title}</a>{/if}
                  {#if project}<a class="chip" href={`/projects/${project.id}`}>Project: {project.title}</a>{/if}
                  {#if task.workstream}<span class="chip">Workstream: {task.workstream.name}</span>{/if}
                  {#if task.marketLead}<a class="chip" href={`/leads/${task.marketLead.id}`}>Lead: {task.marketLead.title}</a>{/if}
                  {#if task.want}<a class="chip" href={`/wants/${task.want.id}`}>Want: {task.want.title}</a>{/if}
                  {#if task.offer}<a class="chip" href={`/offers/${task.offer.id}`}>Offer: {task.offer.title}</a>{/if}
                  {#if task.dealContact}<a class="chip" href={`/deals/${task.dealContact.dealId}/relationships/${task.dealContact.id}`}>Person thread: {task.dealContact.contactName}</a>{/if}
                  {#if task.dealCompany}<a class="chip" href={`/companies/${task.dealCompany.companyId}`}>Company thread: {task.dealCompany.companyName}</a>{/if}
                  {#if task.waitingOnContact}<a class="chip" href={`/contacts/${task.waitingOnContact.id}`}>Waiting on: {task.waitingOnContact.name}</a>{/if}
                  {#if task.assignedToContact}<a class="chip" href={`/contacts/${task.assignedToContact.id}`}>Assigned: {task.assignedToContact.name}</a>{/if}
                  {#if task.assignedToText}<span class="chip">Assigned: {task.assignedToText}</span>{/if}
                </div>
              </div>
              <div class="task-actions">
                <form method="post" action="?/updateTaskStatus">
                  <input type="hidden" name="taskId" value={task.id} />
                  <select name="status" aria-label="Update status" on:change={submitContainingForm}>
                    {#each taskStatusOptions as opt}<option value={opt.value} selected={task.status === opt.value}>{opt.label}</option>{/each}
                  </select>
                </form>
                <a class="btn" href={`/tasks/${task.id}/edit?returnTo=${editReturnTo}`}>Edit</a>
                {#if showDelete}
                  <form method="post" action={deleteAction} on:submit={(event) => { if (!confirm('Delete this task?')) event.preventDefault(); }}>
                    <input type="hidden" name="taskId" value={task.id} />
                    <button class="btn" type="submit">Delete</button>
                  </form>
                {/if}
              </div>
            </div>
          </details>
        </article>
      {/each}
    </div>
  {/if}
</section>

<style>
  .tasks-panel { padding: 16px; }
  .section-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
  .section-head h2 { margin: 0; }
  .head-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  .field { display: grid; gap: 6px; margin-bottom: 12px; }
  .field label { font-size: 0.85rem; color: var(--muted); }
  .hint { color: var(--muted); font-size: 0.82rem; margin: 4px 0 0; }
  .field input, .field select, .field textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--border); border-radius: 12px; background: var(--surface, var(--panel)); color: var(--text); }
  .grid { display: grid; gap: 12px; }
  .grid.two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid.four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .task-form { border: 1px solid var(--border); border-radius: 14px; padding: 12px; margin-bottom: 14px; background: var(--surface, var(--panel)); }
  .link-more { margin: 4px 0 12px; }
  .link-more summary { cursor: pointer; color: var(--muted); }
  .link-more-body { display: grid; gap: 12px; margin-top: 10px; }
  .task-list { display: grid; gap: 10px; }
  .task-row { border-top: 1px solid var(--border); padding: 12px 0; }
  .task-row:first-child { border-top: none; padding-top: 0; }
  .task-row.overdue { border-color: var(--danger); }
  .task-details summary { cursor: pointer; display: flex; flex-wrap: wrap; gap: 8px; align-items: baseline; }
  .task-full { display: flex; justify-content: space-between; gap: 12px; margin-top: 10px; }
  .task-main { min-width: 0; }
  .task-title-row, .context-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .task-title-row a { font-weight: 700; }
  .context-row { margin-top: 6px; }
  .task-actions { min-width: 150px; display: grid; gap: 8px; align-content: start; }
  .task-actions form { display: flex; }
  .task-actions select { min-width: 130px; }
  .preline { white-space: pre-wrap; margin: 6px 0 0; }
  .status-chip, .chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 2px 8px; font-size: 0.8rem; color: var(--muted); }
  .chip { color: var(--text); text-decoration: none; }
  .summary-box { border: 1px solid var(--border); background: var(--panel); border-radius: 10px; padding: 10px; margin-top: 8px; }
  .summary-box p { margin: 4px 0 0; white-space: pre-wrap; }
  .btn { border: 1px solid var(--border); border-radius: 12px; padding: 8px 12px; background: var(--panel); color: var(--text); text-decoration: none; cursor: pointer; }
  .btn.primary { font-weight: 700; }

  @media (max-width: 760px) {
    .task-full { flex-direction: column; }
    .task-actions { min-width: 0; }
    .grid.two, .grid.four { grid-template-columns: 1fr; }
  }
</style>
