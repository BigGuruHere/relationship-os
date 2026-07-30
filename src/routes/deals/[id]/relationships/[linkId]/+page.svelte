<!-- src/routes/deals/[id]/relationships/[linkId]/+page.svelte -->
<script lang="ts">
  // PURPOSE: Manage the deal-person commercial conversation thread.
  import VoiceTextField from '$lib/recording/VoiceTextField.svelte';

  export let data: any;
  export let form: any;

  let showEdit = false;
  let showAddTask = false;
  let newTaskNotes = '';
  let newTaskSummary = '';

  function submitContainingForm(event: Event) {
    // IT: Status changes submit immediately from the dropdown.
    (event.currentTarget as HTMLSelectElement).form?.requestSubmit();
  }

  function fmt(value: string | Date | null | undefined) {
    if (!value) return '';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString();
  }
</script>

<div class="container">
  <div class="card thread-header">
    <div>
      <div class="eyebrow">Deal relationship</div>
      <h1>{data.thread.contactName}</h1>
      <div class="muted">on <a href={`/deals/${data.thread.dealId}`}>{data.thread.dealTitle}</a></div>
      <div class="meta-row">
        <span class="status-chip">{data.thread.relationshipLabel}</span>
        <span class="status-chip">{data.thread.stageLabel}</span>
        <span class="status-chip">{data.thread.interestLabel}</span>
        <span class="status-chip">{data.thread.confidentialityLabel}</span>
      </div>
    </div>
    <div class="actions">
      <button class="btn" type="button" on:click={() => (showEdit = !showEdit)}>{showEdit ? 'Close edit' : 'Edit thread'}</button>
      <button class="btn" type="button" on:click={() => (showAddTask = !showAddTask)}>{showAddTask ? 'Cancel task' : 'Add task'}</button>
      <a class="btn" href={`/deals/${data.thread.dealId}/relationships/${data.thread.id}/notes/new`}>Add voice/note</a>
      <a class="btn" href={`/contacts/${data.thread.contactId}`}>Open person</a>
    </div>
  </div>

  {#if form?.error}<div class="card error-card">{form.error}</div>{/if}

  {#if showEdit}
    <section class="card panel">
      <h2>Edit commercial thread</h2>
      <form method="post" action="?/save">
        <div class="grid three">
          <div class="field">
            <label for="relationshipType">Role</label>
            <select id="relationshipType" name="relationshipType">
              {#each data.relationshipOptions as opt}<option value={opt.value} selected={(data.thread.relationshipType || '') === opt.value}>{opt.label}</option>{/each}
            </select>
          </div>
          <div class="field"><label for="label">Custom label</label><input id="label" name="label" value={data.thread.label} /></div>
          <div class="field"><label for="stage">Stage</label><select id="stage" name="stage">{#each data.dealContactStageOptions as opt}<option value={opt.value} selected={data.thread.stage === opt.value}>{opt.label}</option>{/each}</select></div>
        </div>

        <div class="grid three">
          <div class="field"><label for="interestLevel">Interest</label><select id="interestLevel" name="interestLevel">{#each data.dealContactInterestOptions as opt}<option value={opt.value} selected={data.thread.interestLevel === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="confidentialityStage">Confidentiality</label><select id="confidentialityStage" name="confidentialityStage">{#each data.dealConfidentialityOptions as opt}<option value={opt.value} selected={data.thread.confidentialityStage === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="lastContactedAt">Last contacted</label><input id="lastContactedAt" name="lastContactedAt" type="datetime-local" value={data.thread.lastContactedAtInput} /></div>
        </div>

        <div class="grid two">
          <div class="field"><label for="nextAction">Next action</label><input id="nextAction" name="nextAction" value={data.thread.nextAction} /></div>
          <div class="field"><label for="nextFollowUpAt">Next follow-up</label><input id="nextFollowUpAt" name="nextFollowUpAt" type="datetime-local" value={data.thread.nextFollowUpAtInput} /></div>
        </div>

        <div class="grid two">
          <div class="field"><label for="buyingCriteria">Buying criteria / fit</label><textarea id="buyingCriteria" name="buyingCriteria" rows="4">{data.thread.buyingCriteria}</textarea></div>
          <div class="field"><label for="objections">Objections / concerns</label><textarea id="objections" name="objections" rows="4">{data.thread.objections}</textarea></div>
        </div>

        <div class="grid two">
          <div class="field"><label for="fundingCapacity">Funding capacity / ability</label><textarea id="fundingCapacity" name="fundingCapacity" rows="4">{data.thread.fundingCapacity}</textarea></div>
          <div class="field"><label for="referralPath">Referral path</label><textarea id="referralPath" name="referralPath" rows="4">{data.thread.referralPath}</textarea></div>
        </div>

        <div class="field"><label for="notes">General relationship notes</label><textarea id="notes" name="notes" rows="4">{data.thread.notes}</textarea></div>
        <button class="btn primary" type="submit">Save thread</button>
      </form>
    </section>
  {/if}

  {#if showAddTask}
    <section class="card panel">
      <h2>Add task for this thread</h2>
      <form method="post" action="?/createTask">
        <div class="field"><label for="taskTitle">Task</label><input id="taskTitle" name="title" placeholder="e.g. Send NDA to this person" required /></div>
        <div class="grid four">
          <div class="field"><label for="taskType">Type</label><select id="taskType" name="taskType">{#each data.taskTypeOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="urgency">Urgency</label><select id="urgency" name="urgency">{#each data.taskUrgencyOptions as opt}<option value={opt.value} selected={opt.value === 'NORMAL'}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="importance">Importance</label><select id="importance" name="importance">{#each data.taskImportanceOptions as opt}<option value={opt.value} selected={opt.value === 'NORMAL'}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="status">Status</label><select id="status" name="status">{#each data.taskStatusOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="grid two">
          <div class="field"><label for="dueAt">Due</label><input id="dueAt" name="dueAt" type="datetime-local" /></div>
          <div class="field"><label for="projectId">Project</label><select id="projectId" name="projectId"><option value="">No project</option>{#each data.projectOptions as project}<option value={project.id}>{project.title}</option>{/each}</select></div>
        </div>
        <label class="check-row"><input type="checkbox" name="waitingOnThisPerson" /><span>This task is waiting on {data.thread.contactName}</span></label>
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
    </section>
  {/if}

  <div class="grid main-grid">
    <section class="card panel">
      <h2>Commercial state</h2>
      <div class="detail-list">
        <div><strong>Role</strong><span>{data.thread.relationshipLabel}</span></div>
        <div><strong>Stage</strong><span>{data.thread.stageLabel}</span></div>
        <div><strong>Interest</strong><span>{data.thread.interestLabel}</span></div>
        <div><strong>Confidentiality</strong><span>{data.thread.confidentialityLabel}</span></div>
        <div><strong>Last contacted</strong><span>{fmt(data.thread.lastContactedAt) || 'Not set'}</span></div>
        <div><strong>Next follow-up</strong><span>{fmt(data.thread.nextFollowUpAt) || 'Not set'}</span></div>
      </div>
      <form method="post" action="?/markContactedToday" class="inline-action"><button class="btn" type="submit">Mark contacted today</button></form>
      {#if data.thread.nextAction}<p class="preline"><strong>Next action:</strong> {data.thread.nextAction}</p>{/if}
      {#if data.thread.notes}<p class="preline"><strong>Notes:</strong> {data.thread.notes}</p>{/if}
    </section>

    <section class="card panel">
      <h2>Fit and constraints</h2>
      {#if data.thread.buyingCriteria}<p class="preline"><strong>Buying criteria:</strong> {data.thread.buyingCriteria}</p>{/if}
      {#if data.thread.objections}<p class="preline"><strong>Objections:</strong> {data.thread.objections}</p>{/if}
      {#if data.thread.fundingCapacity}<p class="preline"><strong>Funding capacity:</strong> {data.thread.fundingCapacity}</p>{/if}
      {#if data.thread.referralPath}<p class="preline"><strong>Referral path:</strong> {data.thread.referralPath}</p>{/if}
      {#if !data.thread.buyingCriteria && !data.thread.objections && !data.thread.fundingCapacity && !data.thread.referralPath}
        <p class="muted">No fit, objections, funding, or referral notes yet.</p>
      {/if}
    </section>
  </div>

  <section class="card panel">
    <div class="section-head"><h2>Thread tasks</h2><a class="btn" href="/tasks">Open task inbox</a></div>
    {#if data.tasks.length === 0}
      <p class="muted">No open tasks for this thread.</p>
    {:else}
      <div class="task-list">
        {#each data.tasks as task}
          <div class="task-row">
            <div>
              <div class="task-title"><strong>{task.title}</strong><span class="status-chip">{task.statusLabel}</span><span class="status-chip">{task.urgencyLabel}</span></div>
              <div class="muted small">{task.taskTypeLabel} - due {fmt(task.dueAt) || 'not set'}{task.waitingOnContact ? ` - waiting on ${task.waitingOnContact.name}` : ''}</div>
              {#if task.notes}<p class="preline small">{task.notes}</p>{/if}
              {#if task.summary}<div class="summary-box"><div class="muted small">AI summary</div><p>{task.summary}</p></div>{/if}
            </div>
            <form method="post" action="?/updateTaskStatus" class="status-form">
              <input type="hidden" name="taskId" value={task.id} />
              <select name="status" on:change={submitContainingForm}>{#each data.taskStatusOptions as opt}<option value={opt.value} selected={task.status === opt.value}>{opt.label}</option>{/each}</select>
            </form>
            <a class="btn" href={`/tasks/${task.id}/edit?returnTo=/deals/${data.thread.dealId}/relationships/${data.thread.id}`}>Edit</a>
          </div>
        {/each}
      </div>
    {/if}
  </section>

  <section class="card panel">
    <div class="section-head"><h2>Thread notes</h2><a class="btn" href={`/deals/${data.thread.dealId}/relationships/${data.thread.id}/notes/new`}>New voice/note</a></div>
    {#if data.notes.length === 0}
      <p class="muted">No notes yet for this deal-person thread.</p>
    {:else}
      <ul class="notes-list">
        {#each data.notes as note}
          <li class="note-row">
            <div class="note-meta"><span class="status-chip">{note.channel}</span><span class="muted">{fmt(note.occurredAt)}</span></div>
            <p class="preline">{note.preview || '(empty)'}</p>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <div class="bottom-actions"><a class="btn" href={`/deals/${data.thread.dealId}`}>Back to deal</a></div>
</div>

<style>
  .thread-header { padding: 18px; display: flex; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  h1 { margin: 0; }
  h2 { margin: 0 0 10px; font-size: 1.1rem; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  .actions, .meta-row, .section-head, .status-form, .task-title, .bottom-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .panel, .error-card { padding: 16px; margin-bottom: 12px; }
  .error-card { color: var(--danger); }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grid.three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .grid.four { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
  .main-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .detail-list { display: grid; gap: 8px; }
  .detail-list div { display: grid; grid-template-columns: 140px 1fr; gap: 8px; }
  .preline { white-space: pre-wrap; }
  .summary-box { border: 1px solid var(--border); background: var(--panel); border-radius: 10px; padding: 8px; margin: 8px 0; }
  .summary-box p { margin: 4px 0 0; white-space: pre-wrap; }
  .status-chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 2px 8px; font-size: 0.8rem; color: var(--muted); }
  .inline-action { margin: 12px 0; }
  .check-row { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
  .check-row input { width: auto; }
  .task-list, .notes-list { display: grid; gap: 8px; }
  .notes-list { list-style: none; padding: 0; margin: 0; }
  .task-row, .note-row { border-top: 1px solid var(--border); padding: 12px 0; display: flex; justify-content: space-between; gap: 12px; }
  .note-row { display: block; }
  .note-meta { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  textarea { resize: vertical; }
  @media (max-width: 860px) {
    .thread-header, .task-row, .section-head { flex-direction: column; align-items: stretch; }
    .main-grid, .grid.two, .grid.three, .grid.four { grid-template-columns: 1fr; }
  }
</style>
