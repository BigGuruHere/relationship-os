<!-- src/routes/tasks/[id]/edit/+page.svelte -->
<script lang="ts">
  // PURPOSE: Edit a task and its relationship/deal/project context.
  // SECURITY: Server action validates ownership of every linked record before saving.

  import VoiceTextField from '$lib/recording/VoiceTextField.svelte';
  import TaskCommercialLinkPicker from '$lib/TaskCommercialLinkPicker.svelte';
  import { closeDatePickerOnChange } from '$lib/closeDatePicker';

  export let data: any;
  export let form: any;

  let notes = data.task.notes || '';
  let summary = data.task.summary || '';

  // IT: These context fields stay live so Want/Offer suggestions can re-rank as the task is edited.
  let contactId = data.task.contactId || '';
  let companyId = data.task.companyId || '';
  let dealId = data.task.dealId || '';
  let projectId = data.task.projectId || '';
  let workstreamId = data.task.workstreamId || '';
  let wantId = data.task.wantId || '';
  let offerId = data.task.offerId || '';

  function syncProjectFromWorkstream() {
    // IT: A Workstream always belongs to one Project, so keep the two task selectors consistent before save.
    const selected = data.options.workstreams.find((item: any) => item.id === workstreamId);
    if (selected?.projectId) projectId = selected.projectId;
  }
</script>

<div class="container">
  <div class="card form-card">
    <div class="page-head">
      <div>
        <div class="eyebrow">Edit action</div>
        <h1>Edit task</h1>
        <p class="muted">Update the task, context links, priority, and voice-enabled notes.</p>
      </div>
      <a class="btn" href={data.returnTo || '/tasks'}>Cancel</a>
    </div>

    {#if form?.error}<div class="error-card">{form.error}</div>{/if}

    <form method="post" action="?/update">
      <input type="hidden" name="returnTo" value={data.returnTo || '/tasks'} />

      <div class="field">
        <label for="title">Task</label>
        <input id="title" name="title" required value={data.task.title} />
      </div>

      <div class="grid five">
        <div class="field">
          <label for="taskType">Type</label>
          <select id="taskType" name="taskType">{#each data.taskTypes as opt}<option value={opt.value} selected={data.task.taskType === opt.value}>{opt.label}</option>{/each}</select>
        </div>
        <div class="field">
          <label for="urgency">Urgency</label>
          <select id="urgency" name="urgency">{#each data.taskUrgencies as opt}<option value={opt.value} selected={data.task.urgency === opt.value}>{opt.label}</option>{/each}</select>
        </div>
        <div class="field">
          <label for="importance">Importance</label>
          <select id="importance" name="importance">{#each data.taskImportances as opt}<option value={opt.value} selected={data.task.importance === opt.value}>{opt.label}</option>{/each}</select>
        </div>
        <div class="field">
          <label for="status">Status</label>
          <select id="status" name="status">{#each data.taskStatuses as opt}<option value={opt.value} selected={data.task.status === opt.value}>{opt.label}</option>{/each}</select>
        </div>
        <div class="field">
          <label for="focus">Focus</label>
          <select id="focus" name="focus">{#each data.taskFocusOptions as opt}<option value={opt.value} selected={data.task.focus === opt.value}>{opt.label}</option>{/each}</select>
        </div>
      </div>

      <div class="grid two">
        <div class="field"><label for="dueAt">Due</label><input id="dueAt" name="dueAt" type="datetime-local" value={data.task.dueAtInput} on:change={closeDatePickerOnChange} /></div>
        <div class="field"><label for="snoozedUntil">Snooze until</label><input id="snoozedUntil" name="snoozedUntil" type="datetime-local" value={data.task.snoozedUntilInput} on:change={closeDatePickerOnChange} /></div>
      </div>

      <details class="repeat-panel">
        <summary>Repeat</summary>
        <div class="field repeat-field">
          <label for="recurrenceRule">Repeat schedule</label>
          <select id="recurrenceRule" name="recurrenceRule">
            <option value="" selected={!data.task.recurrenceRule}>Never</option>
            <option value="DAILY" selected={data.task.recurrenceRule === 'DAILY'}>Daily</option>
            <option value="WEEKLY" selected={data.task.recurrenceRule === 'WEEKLY'}>Weekly</option>
            <option value="FORTNIGHTLY" selected={data.task.recurrenceRule === 'FORTNIGHTLY'}>Fortnightly</option>
            <option value="MONTHLY" selected={data.task.recurrenceRule === 'MONTHLY'}>Monthly</option>
          </select>
          <p class="hint">The due date is the starting point. One open occurrence is kept at a time.</p>
        </div>
      </details>

      <div class="grid two">
        <div class="field">
          <label for="contactId">Attach person</label>
          <select id="contactId" name="contactId" bind:value={contactId}>
            <option value="">No person</option>
            {#each data.options.contacts as c}<option value={c.id}>{c.name}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="dealId">Attach deal</label>
          <select id="dealId" name="dealId" bind:value={dealId}>
            <option value="">No deal</option>
            {#each data.options.deals as d}<option value={d.id}>{d.title}</option>{/each}
          </select>
        </div>
      </div>

      <div class="grid two">
        <div class="field">
          <label for="companyId">Attach company</label>
          <select id="companyId" name="companyId" bind:value={companyId}>
            <option value="">No company</option>
            {#each data.options.companies as c}<option value={c.id}>{c.name}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="projectId">Attach project</label>
          <select id="projectId" name="projectId" bind:value={projectId}>
            <option value="">No project</option>
            {#each data.options.projects as p}<option value={p.id}>{p.title}</option>{/each}
          </select>
        </div>
      </div>

      <div class="field">
        <label for="workstreamId">Attach workstream</label>
        <select id="workstreamId" name="workstreamId" bind:value={workstreamId} on:change={syncProjectFromWorkstream}>
          <option value="">No workstream</option>
          {#each data.options.workstreams as ws}<option value={ws.id}>{ws.title}</option>{/each}
        </select>
        <p class="hint">Selecting a workstream will automatically attach the task to that workstream's project.</p>
      </div>

      <div class="grid two commercial-links">
        <TaskCommercialLinkPicker
          kind="want"
          bind:selectedId={wantId}
          initialSelected={data.linkedWant}
          {contactId}
          {companyId}
          {dealId}
          {projectId}
          {workstreamId}
        />
        <TaskCommercialLinkPicker
          kind="offer"
          bind:selectedId={offerId}
          initialSelected={data.linkedOffer}
          {contactId}
          {companyId}
          {dealId}
          {projectId}
          {workstreamId}
        />
      </div>

      <div class="grid two">
        <div class="field">
          <label for="dealContactId">Attach deal-person thread</label>
          <select id="dealContactId" name="dealContactId">
            <option value="">No specific deal relationship</option>
            {#each data.options.dealContacts as dc}<option value={dc.id} selected={data.task.dealContactId === dc.id}>{dc.title}</option>{/each}
          </select>
          <p class="hint">Selecting this can set the person and deal context.</p>
        </div>
        <div class="field">
          <label for="dealCompanyId">Attach deal-company thread</label>
          <select id="dealCompanyId" name="dealCompanyId">
            <option value="">No specific deal-company relationship</option>
            {#each data.options.dealCompanies as dc}<option value={dc.id} selected={data.task.dealCompanyId === dc.id}>{dc.title}</option>{/each}
          </select>
          <p class="hint">Selecting this can set the company and deal context.</p>
        </div>
      </div>

      <div class="grid two">
        <div class="field">
          <label for="assignedToContactId">Assigned to contact</label>
          <select id="assignedToContactId" name="assignedToContactId">
            <option value="">No assigned contact</option>
            {#each data.options.contacts as c}<option value={c.id} selected={data.task.assignedToContactId === c.id}>{c.name}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="waitingOnContactId">Waiting on</label>
          <select id="waitingOnContactId" name="waitingOnContactId">
            <option value="">Nobody external</option>
            {#each data.options.contacts as c}<option value={c.id} selected={data.task.waitingOnContactId === c.id}>{c.name}</option>{/each}
          </select>
        </div>
      </div>

      <div class="field">
        <label for="assignedToText">Assigned to text</label>
        <input id="assignedToText" name="assignedToText" value={data.task.assignedToText} placeholder="e.g. me, Sam, accountant, vendor" />
      </div>

      <div class="field">
        <VoiceTextField
          id="notes"
          textName="notes"
          summaryName="summary"
          label="Task notes"
          placeholder="Record or type the context, outcome, or next step."
          rows={5}
          bind:value={notes}
          bind:summary={summary}
          contextLabel="task note"
        />
      </div>

      <div class="actions">
        <button class="btn primary" type="submit">Save changes</button>
        <a class="btn" href={data.returnTo || '/tasks'}>Cancel</a>
      </div>
    </form>
  </div>
</div>

<style>
  .repeat-panel { border: 1px solid var(--border); border-radius: 10px; padding: 10px 12px; margin: 4px 0 12px; }
  .repeat-panel summary { cursor: pointer; font-weight: 700; }
  .repeat-field { margin-top: 10px; }
  .form-card { padding: 18px; max-width: 900px; margin: 0 auto; }
  .page-head, .actions { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .actions { justify-content: flex-start; margin-top: 14px; }
  h1 { margin: 0; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .hint { color: var(--muted); font-size: 0.82rem; margin: 4px 0 0; }
  .error-card { color: var(--danger); margin-bottom: 12px; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grid.four { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .grid.five { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
  .commercial-links { margin: 4px 0 12px; }
  @media (max-width: 820px) {
    .page-head { flex-direction: column; }
    .grid.two, .grid.four, .grid.five { grid-template-columns: 1fr; }
  }
</style>
