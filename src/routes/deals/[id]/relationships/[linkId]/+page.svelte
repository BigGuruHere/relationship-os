<!-- src/routes/deals/[id]/relationships/[linkId]/+page.svelte -->
<script lang="ts">
  // PURPOSE: Manage the deal-person commercial conversation thread.
  import NotesPanel from '$lib/NotesPanel.svelte';
  import TasksPanel from '$lib/TasksPanel.svelte';
  import { closeDatePickerOnChange } from '$lib/closeDatePicker';

  export let data: any;
  export let form: any;

  let showEdit = false;

  function fmt(value: string | Date | null | undefined) {
    if (!value) return '';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString();
  }

  function closeContainingDetails(event: Event) {
    const details = (event.currentTarget as HTMLElement).closest('details') as HTMLDetailsElement | null;
    if (details) details.open = false;
  }
</script>

<div class="container">
  <div class="card thread-header">
    <div>
      <div class="eyebrow">Deal relationship</div>
      <h1><a href={`/contacts/${data.thread.contactId}`}>{data.thread.contactName}</a></h1>
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
          <div class="field"><label for="lastContactedAt">Last contacted</label><input id="lastContactedAt" name="lastContactedAt" type="datetime-local" value={data.thread.lastContactedAtInput} on:change={closeDatePickerOnChange} /></div>
        </div>

        <div class="grid two">
          <div class="field"><label for="nextAction">Next action</label><input id="nextAction" name="nextAction" value={data.thread.nextAction} /></div>
          <div class="field"><label for="nextFollowUpAt">Next follow-up</label><input id="nextFollowUpAt" name="nextFollowUpAt" type="datetime-local" value={data.thread.nextFollowUpAtInput} on:change={closeDatePickerOnChange} /></div>
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

  <TasksPanel
    tasks={data.tasks}
    heading="Thread tasks"
    emptyMessage="No open tasks for this thread."
    taskTypeOptions={data.taskTypeOptions}
    taskStatusOptions={data.taskStatusOptions}
    taskUrgencyOptions={data.taskUrgencyOptions}
    taskImportanceOptions={data.taskImportanceOptions}
    taskFocusOptions={data.taskFocusOptions}
    editReturnTo={`/deals/${data.thread.dealId}/relationships/${data.thread.id}`}
    inboxHref="/tasks"
    inboxLabel="Open task inbox"
    lockedContactId={data.thread.contactId}
    lockedDealId={data.thread.dealId}
    lockedDealContactId={data.thread.id}
    contactOptions={data.taskContactOptions}
    companyOptions={data.taskCompanyOptions}
    projectOptions={data.projectOptions}
    workstreamOptions={data.taskWorkstreamOptions}
    marketLeadOptions={data.taskMarketLeadOptions}
    dealCompanyOptions={data.taskDealCompanyOptions}
  />

  <section class="card panel">
    <div class="section-head"><h2>Thread notes</h2><a class="btn" href={`/deals/${data.thread.dealId}/relationships/${data.thread.id}/notes/new`}>New voice/note</a></div>
    <NotesPanel notes={data.notes} emptyMessage="No notes yet for this deal-person thread.">
      <svelte:fragment slot="actions" let:note>
        <details class="edit-box">
          <summary>Edit note</summary>
          <form method="post" action="?/updateNote" class="nested-form">
            <input type="hidden" name="noteId" value={note.id} />
            <div class="grid two">
              <div class="field"><label for={`thread-note-channel-${note.id}`}>Channel</label><select id={`thread-note-channel-${note.id}`} name="channel">{#each data.noteChannels as opt}<option value={opt.value} selected={note.channel === opt.value}>{opt.label}</option>{/each}</select></div>
              <div class="field"><label for={`thread-note-occurred-${note.id}`}>Note date</label><input id={`thread-note-occurred-${note.id}`} name="occurredAt" type="datetime-local" value={note.occurredAtInput} on:change={closeDatePickerOnChange} /></div>
            </div>
            <div class="field"><label for={`thread-note-text-${note.id}`}>Note</label><textarea id={`thread-note-text-${note.id}`} name="text" rows="4" required>{note.rawText}</textarea></div>
            <div class="field"><label for={`thread-note-summary-${note.id}`}>Summary</label><input id={`thread-note-summary-${note.id}`} name="summary" value={note.summary} /></div>
            <div class="row-actions"><button class="btn primary" type="submit">Save note</button><button class="btn" type="button" on:click={closeContainingDetails}>Cancel</button></div>
          </form>
        </details>
      </svelte:fragment>
    </NotesPanel>
  </section>

  <div class="bottom-actions"><a class="btn" href={`/deals/${data.thread.dealId}`}>Back to deal</a></div>
</div>

<style>
  .thread-header { padding: 18px; display: flex; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  h1 { margin: 0; }
  h2 { margin: 0 0 10px; font-size: 1.1rem; }
  .muted { color: var(--muted); }
  .actions, .meta-row, .section-head, .bottom-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .panel, .error-card { padding: 16px; margin-bottom: 12px; }
  .error-card { color: var(--danger); }
  .grid.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .grid.three { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
  .main-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
  .detail-list { display: grid; gap: 8px; }
  .detail-list div { display: grid; grid-template-columns: 140px 1fr; gap: 8px; }
  .preline { white-space: pre-wrap; }
  .status-chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 2px 8px; font-size: 0.8rem; color: var(--muted); }
  .inline-action { margin: 12px 0; }
  .nested-form { display: grid; gap: 12px; margin-top: 10px; }
  .row-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .edit-box { margin-top: 10px; }
  .edit-box summary { cursor: pointer; color: var(--muted); }
  textarea { resize: vertical; }
  @media (max-width: 860px) {
    .thread-header, .section-head { flex-direction: column; align-items: stretch; }
    .main-grid, .grid.two, .grid.three { grid-template-columns: 1fr; }
  }
</style>
