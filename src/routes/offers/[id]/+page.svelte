<!-- src/routes/offers/[id]/+page.svelte -->
<script lang="ts">
  import VoiceTextField from '$lib/recording/VoiceTextField.svelte';
  import NotesPanel from '$lib/NotesPanel.svelte';
  import { closeDatePickerOnChange } from '$lib/closeDatePicker';

  export let data: any;
  export let form: any;

  let showEdit = false;
  let showNoteForm = false;
  let showTaskForm = false;
  let description = data.offer.description || '';
  let summary = data.offer.summary || '';
  let noteBody = '';
  let noteSummary = '';

  function fmt(value: string | Date | null | undefined) {
    if (!value) return 'Not set';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return 'Not set';
    return d.toLocaleString();
  }

  function valueRange(item: any) {
    if (item.valueMinLabel && item.valueMaxLabel) return `${item.valueMinLabel} to ${item.valueMaxLabel}`;
    if (item.valueMinLabel) return `From ${item.valueMinLabel}`;
    if (item.valueMaxLabel) return `Up to ${item.valueMaxLabel}`;
    return 'Not set';
  }
</script>

<div class="container">
  <header class="page-head">
    <div>
      <div class="eyebrow">Offer</div>
      <h1>{data.offer.title}</h1>
      <p class="muted">{data.offer.offerTypeLabel} - {data.offer.statusLabel} - {data.offer.directionLabel} - {data.offer.urgencyLabel} - {data.offer.timeHorizonLabel}</p>
    </div>
    <div class="head-actions">
      <a class="btn" href="/offers">All offers</a>
      <button class="btn" type="button" on:click={() => (showEdit = !showEdit)}>{showEdit ? 'Cancel edit' : 'Edit offer'}</button>
      <form method="post" action="?/convertToDeal" on:submit={(event) => { if (!confirm('Create a deal from this offer?')) event.preventDefault(); }}><button class="btn primary" type="submit">Convert to deal</button></form>
    </div>
  </header>

  {#if form?.error}<div class="card error-card">{form.error}</div>{/if}

  <section class="card panel">
    <div class="grid details">
      <div><strong>Status</strong></div><div>{data.offer.statusLabel}</div>
      <div><strong>Type</strong></div><div>{data.offer.offerTypeLabel}</div>
      <div><strong>Direction</strong></div><div>{data.offer.directionLabel}</div>
      <div><strong>Contact</strong></div><div>{#if data.offer.contact}<a href={`/contacts/${data.offer.contact.id}`}>{data.offer.contact.name}</a>{:else} - {/if}</div>
      <div><strong>Company</strong></div><div>{#if data.offer.company}<a href={`/companies/${data.offer.company.id}`}>{data.offer.company.name}</a>{:else} - {/if}</div>
      <div><strong>Project</strong></div><div>{#if data.offer.project}<a href={`/projects/${data.offer.project.id}`}>{data.offer.project.title}</a>{:else} - {/if}</div>
      <div><strong>Workstream</strong></div><div>{#if data.offer.workstream}<a href={`/projects/${data.offer.workstream.projectId}/workstreams/${data.offer.workstream.id}`}>{data.offer.workstream.name}</a>{:else} - {/if}</div>
      <div><strong>Value</strong></div><div>{valueRange(data.offer)}</div>
      <div><strong>Geography</strong></div><div>{data.offer.geography || ' - '}</div>
      <div><strong>Review</strong></div><div>{fmt(data.offer.reviewAt)}</div>
      <div><strong>Authority</strong></div><div>{data.offer.authorityLabel}</div>
      <div><strong>Source</strong></div><div>{data.offer.sourceTypeLabel}</div>
      <div><strong>Last confirmed</strong></div><div>{fmt(data.offer.confirmedAt)}</div>
    </div>
    {#if data.offer.description}<div class="text-block"><h3>Description</h3><p>{data.offer.description}</p></div>{/if}
    {#if data.offer.terms}<div class="text-block"><h3>Terms</h3><p>{data.offer.terms}</p></div>{/if}
    {#if data.offer.sourceNote}<div class="text-block"><h3>Source / provenance</h3><p>{data.offer.sourceNote}</p></div>{/if}
  </section>

  {#if showEdit}
    <section class="card panel">
      <h2>Edit offer</h2>
      <form method="post" action="?/updateOffer" class="edit-form">
        <div class="grid three">
          <div class="field"><label for="offerType">Type</label><select id="offerType" name="offerType">{#each data.offerTypes as opt}<option value={opt.value} selected={data.offer.offerType === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="status">Status</label><select id="status" name="status">{#each data.offerStatuses as opt}<option value={opt.value} selected={data.offer.status === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="direction">Direction</label><select id="direction" name="direction">{#each data.offerDirections as opt}<option value={opt.value} selected={data.offer.direction === opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <div class="field"><label for="category">Category</label><input id="category" name="category" value={data.offer.category || ''} /></div>
        <div class="field"><label for="offerTitle">Title</label><input id="offerTitle" name="offerTitle" value={data.offer.title} required /></div>
        <VoiceTextField id="offerDescription" textName="offerDescription" summaryName="offerSummary" label="Description" rows={4} bind:value={description} bind:summary={summary} contextLabel="offer" />
        <div class="field"><label for="terms">Terms</label><textarea id="terms" name="terms" rows="4">{data.offer.terms || ''}</textarea></div>
        <div class="grid three">
          <div class="field"><label for="contactId">Contact</label><select id="contactId" name="contactId"><option value="">No contact</option>{#each data.contacts as c}<option value={c.id} selected={data.offer.contactId === c.id}>{c.name}</option>{/each}</select></div>
          <div class="field"><label for="companyId">Company</label><select id="companyId" name="companyId"><option value="">No company</option>{#each data.companies as c}<option value={c.id} selected={data.offer.companyId === c.id}>{c.name}</option>{/each}</select></div>
          <div class="field"><label for="dealId">Deal</label><select id="dealId" name="dealId"><option value="">No deal</option>{#each data.deals as d}<option value={d.id} selected={data.offer.dealId === d.id}>{d.title}</option>{/each}</select></div>
        </div>
        <div class="grid two"><div class="field"><label for="projectId">Project</label><select id="projectId" name="projectId"><option value="">No project</option>{#each data.projects as p}<option value={p.id} selected={data.offer.projectId === p.id}>{p.title}</option>{/each}</select></div><div class="field"><label for="workstreamId">Workstream</label><select id="workstreamId" name="workstreamId"><option value="">No workstream</option>{#each data.workstreams as ws}<option value={ws.id} selected={data.offer.workstreamId === ws.id}>{ws.projectTitle} - {ws.name}</option>{/each}</select></div></div>
        <div class="grid three"><div class="field"><label for="importance">Importance</label><input id="importance" name="importance" type="number" min="1" max="5" value={data.offer.importance} /></div><div class="field"><label for="urgency">Urgency</label><select id="urgency" name="urgency">{#each data.offerUrgencies as opt}<option value={opt.value} selected={data.offer.urgency === opt.value}>{opt.label}</option>{/each}</select></div><div class="field"><label for="timeHorizon">Time horizon</label><select id="timeHorizon" name="timeHorizon">{#each data.offerTimeHorizons as opt}<option value={opt.value} selected={data.offer.timeHorizon === opt.value}>{opt.label}</option>{/each}</select></div></div>
        <div class="grid three"><div class="field"><label for="confidence">Confidence</label><select id="confidence" name="confidence">{#each data.offerConfidences as opt}<option value={opt.value} selected={data.offer.confidence === opt.value}>{opt.label}</option>{/each}</select></div><div class="field"><label for="geography">Geography</label><input id="geography" name="geography" value={data.offer.geography || ''} /></div><div class="field"><label for="currency">Currency</label><input id="currency" name="currency" value={data.offer.currency || 'AUD'} /></div></div>
        <div class="grid three">
          <div class="field"><label for="authority">Authority</label><select id="authority" name="authority">{#each data.knowledgeAuthorities as opt}<option value={opt.value} selected={data.offer.authority === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="sourceType">Source</label><select id="sourceType" name="sourceType">{#each data.knowledgeSourceTypes as opt}<option value={opt.value} selected={data.offer.sourceType === opt.value}>{opt.label}</option>{/each}</select></div>
          <div class="field"><label for="confirmedAt">Last confirmed</label><input id="confirmedAt" name="confirmedAt" type="date" value={data.editValues.confirmedAt} /></div>
        </div>
        <div class="field"><label for="sourceNote">Source / provenance note</label><input id="sourceNote" name="sourceNote" value={data.offer.sourceNote || ''} /></div>
        <div class="grid four"><div class="field"><label for="valueMin">Minimum value ($m)</label><input id="valueMin" name="valueMin" type="number" min="0" max="100000000" step="0.00000001" inputmode="decimal" value={data.editValues.valueMin || ''} /></div><div class="field"><label for="valueMax">Maximum value ($m)</label><input id="valueMax" name="valueMax" type="number" min="0" max="100000000" step="0.00000001" inputmode="decimal" value={data.editValues.valueMax || ''} /></div><div class="field"><label for="reviewAt">Review</label><input id="reviewAt" name="reviewAt" type="date" value={data.editValues.reviewAt} on:change={closeDatePickerOnChange} /></div><div class="field"><label for="expiresAt">Expiry</label><input id="expiresAt" name="expiresAt" type="date" value={data.editValues.expiresAt} on:change={closeDatePickerOnChange} /></div></div>
        <button class="btn primary" type="submit">Save changes</button>
      </form>
    </section>
  {/if}

  <section class="card panel">
    <div class="section-head"><h2>Tasks</h2><button class="btn" type="button" on:click={() => (showTaskForm = !showTaskForm)}>{showTaskForm ? 'Cancel' : 'Add task'}</button></div>
    {#if showTaskForm}
      <form method="post" action="?/createTask" class="nested-form">
        <div class="field"><label for="title">Task title</label><input id="title" name="title" required /></div>
        <div class="grid three"><div class="field"><label for="statusTask">Status</label><select id="statusTask" name="status">{#each data.taskStatuses as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div><div class="field"><label for="focusTask">Focus</label><select id="focusTask" name="focus">{#each data.taskFocusOptions as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div><div class="field"><label for="taskType">Type</label><select id="taskType" name="taskType">{#each data.taskTypes as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div></div>
        <div class="field"><label for="dueAt">Due</label><input id="dueAt" name="dueAt" type="datetime-local" on:change={closeDatePickerOnChange} /></div>
        <div class="field"><label for="notes">Notes</label><textarea id="notes" name="notes" rows="3"></textarea></div>
        <button class="btn primary" type="submit">Save task</button>
      </form>
    {/if}
    {#if data.tasks.length === 0}<p class="muted">No tasks attached to this offer.</p>{:else}<div class="item-list">{#each data.tasks as task}<div class="item-row"><div><a href={`/tasks/${task.id}`}><strong>{task.title}</strong></a><div class="muted small">{task.statusLabel} - {task.focusLabel} - due {fmt(task.dueAt)}</div></div><a class="btn" href={`/tasks/${task.id}/edit?returnTo=/offers/${data.offer.id}`}>Edit</a></div>{/each}</div>{/if}
  </section>

  <section class="card panel">
    <div class="section-head"><h2>Notes</h2><button class="btn" type="button" on:click={() => (showNoteForm = !showNoteForm)}>{showNoteForm ? 'Cancel' : 'Add note'}</button></div>
    {#if showNoteForm}
      <form method="post" action="?/addNote" class="nested-form">
        <div class="grid two">
          <div class="field"><label for="occurredAt">Date</label><input id="occurredAt" name="occurredAt" type="datetime-local" on:change={closeDatePickerOnChange} /></div>
          <div class="field"><label for="channel">Channel</label><select id="channel" name="channel">{#each data.noteChannels as opt}<option value={opt.value}>{opt.label}</option>{/each}</select></div>
        </div>
        <VoiceTextField
          id="noteBody"
          textName="body"
          summaryName="summary"
          label="Note"
          placeholder="Record or type what happened, what matters, or the next step."
          rows={4}
          bind:value={noteBody}
          bind:summary={noteSummary}
          contextLabel="offer note"
        />
        <button class="btn primary" type="submit">Save note</button>
      </form>
    {/if}

    <NotesPanel notes={data.notes} emptyMessage="No notes yet.">
      <svelte:fragment slot="actions" let:note>
        <details class="edit-box">
          <summary>Edit note</summary>
          <form method="post" action="?/updateNote" class="nested-form">
            <input type="hidden" name="noteId" value={note.id} />
            <div class="grid two">
              <div class="field"><label for={`note-date-${note.id}`}>Date</label><input id={`note-date-${note.id}`} name="occurredAt" type="datetime-local" value={note.occurredInput} on:change={closeDatePickerOnChange} /></div>
              <div class="field"><label for={`note-channel-${note.id}`}>Channel</label><select id={`note-channel-${note.id}`} name="channel">{#each data.noteChannels as opt}<option value={opt.value} selected={note.channel === opt.value}>{opt.label}</option>{/each}</select></div>
            </div>
            <div class="field"><label for={`note-body-${note.id}`}>Note</label><textarea id={`note-body-${note.id}`} name="body" rows="4" required>{note.body}</textarea></div>
            <div class="field"><label for={`note-summary-${note.id}`}>Summary</label><input id={`note-summary-${note.id}`} name="summary" value={note.summary || ''} /></div>
            <button class="btn primary" type="submit">Save note changes</button>
          </form>
        </details>
        <form method="post" action="?/deleteNote" on:submit={(event) => { if (!confirm('Delete this note?')) event.preventDefault(); }}>
          <input type="hidden" name="noteId" value={note.id} />
          <button class="btn" type="submit">Delete</button>
        </form>
      </svelte:fragment>
    </NotesPanel>
  </section>
</div>

<style>
  .container { padding:12px; }
  .page-head, .section-head, .item-row, .note-head, .actions { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
  .head-actions, .actions { display:flex; gap:8px; flex-wrap:wrap; }
  h1, h2, h3 { margin:0; } h2 { font-size:1.1rem; } h3 { font-size:1rem; margin-top:12px; }
  .eyebrow { color:var(--accent); font-weight:700; font-size:0.85rem; text-transform:uppercase; letter-spacing:0.04em; }
  .muted { color:var(--muted); } .small { font-size:0.9rem; }
  .panel, .error-card { padding:14px; margin-bottom:12px; }
  .error-card { color:var(--danger); }
  .grid.details { display:grid; grid-template-columns:180px 1fr; gap:8px 12px; }
  .grid.two { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:12px; }
  .grid.three { display:grid; grid-template-columns:repeat(3, minmax(0, 1fr)); gap:12px; }
  .grid.four { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px; }
  .field { display:flex; flex-direction:column; gap:6px; margin-bottom:12px; }
  .field input, .field select, .field textarea { padding:10px 12px; border:1px solid var(--border); border-radius:12px; background:var(--surface); color:var(--text); }
  .text-block { border-top:1px solid var(--border); margin-top:12px; padding-top:12px; }
  .text-block p, .preline { white-space:pre-wrap; }
  .item-list { display:grid; gap:10px; }
  .item-row, .note-card { border:1px solid var(--border); border-radius:14px; padding:12px; background:var(--surface); }
  .btn { border:1px solid var(--border); border-radius:12px; padding:8px 12px; background:var(--surface); color:var(--text); text-decoration:none; cursor:pointer; }
  .btn.primary { background:linear-gradient(180deg, #21c7b6, #0fa7a0); border-color:#0f9b92; color:#fff; font-weight:700; }
  @media (max-width:860px) { .page-head, .section-head, .item-row, .note-head { flex-direction:column; } .grid.details, .grid.two, .grid.three, .grid.four { grid-template-columns:1fr; } }
</style>
