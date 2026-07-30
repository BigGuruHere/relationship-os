<!-- src/routes/tasks/[id]/edit/+page.svelte -->
<script lang="ts">
  // PURPOSE: Edit a task and its relationship/deal/project context.
  // SECURITY: Server action validates ownership of every linked record before saving.

  import VoiceTextField from '$lib/recording/VoiceTextField.svelte';

  export let data: any;
  export let form: any;

  let notes = data.task.notes || '';
  let summary = data.task.summary || '';
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

      <div class="grid four">
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
      </div>

      <div class="grid two">
        <div class="field"><label for="dueAt">Due</label><input id="dueAt" name="dueAt" type="datetime-local" value={data.task.dueAtInput} /></div>
        <div class="field"><label for="snoozedUntil">Snooze until</label><input id="snoozedUntil" name="snoozedUntil" type="datetime-local" value={data.task.snoozedUntilInput} /></div>
      </div>

      <div class="grid two">
        <div class="field">
          <label for="contactId">Attach person</label>
          <select id="contactId" name="contactId">
            <option value="">No person</option>
            {#each data.options.contacts as c}<option value={c.id} selected={data.task.contactId === c.id}>{c.name}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="dealId">Attach deal</label>
          <select id="dealId" name="dealId">
            <option value="">No deal</option>
            {#each data.options.deals as d}<option value={d.id} selected={data.task.dealId === d.id}>{d.title}</option>{/each}
          </select>
        </div>
      </div>

      <div class="grid two">
        <div class="field">
          <label for="dealContactId">Attach deal-person thread</label>
          <select id="dealContactId" name="dealContactId">
            <option value="">No specific deal relationship</option>
            {#each data.options.dealContacts as dc}<option value={dc.id} selected={data.task.dealContactId === dc.id}>{dc.title}</option>{/each}
          </select>
        </div>
        <div class="field">
          <label for="projectId">Attach project</label>
          <select id="projectId" name="projectId">
            <option value="">No project</option>
            {#each data.options.projects as p}<option value={p.id} selected={data.task.projectId === p.id}>{p.title}</option>{/each}
          </select>
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
  .form-card { padding: 18px; max-width: 900px; margin: 0 auto; }
  .page-head, .actions { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .actions { justify-content: flex-start; margin-top: 14px; }
  h1 { margin: 0; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  .muted { color: var(--muted); }
  .error-card { color: var(--danger); margin-bottom: 12px; }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grid.four { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  @media (max-width: 820px) {
    .page-head { flex-direction: column; }
    .grid.two, .grid.four { grid-template-columns: 1fr; }
  }
</style>
