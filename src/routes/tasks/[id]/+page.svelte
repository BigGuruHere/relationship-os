<!-- src/routes/tasks/[id]/+page.svelte -->
<script lang="ts">
  // PURPOSE: Show one task and everything it is attached to.
  // SECURITY: This page renders server-prepared decrypted display values only.

  export let data: any;
  export let form: any;

  function fmt(value: string | Date | null | undefined) {
    if (!value) return 'Not set';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return 'Not set';
    return d.toLocaleString();
  }

  function submitContainingForm(event: Event) {
    // IT: Status/focus changes submit immediately so there is no confusing Update button.
    (event.currentTarget as HTMLSelectElement).form?.requestSubmit();
  }
</script>

<div class="container">
  <div class="card task-header">
    <div class="header-main">
      <div class="task-icon" aria-hidden="true">✓</div>
      <div>
        <div class="eyebrow">Task</div>
        <h1>{data.task.title}</h1>
        <div class="meta-row">
          <span class="status-chip">{data.task.statusLabel}</span>
          <span class="status-chip">{data.task.urgencyLabel} urgency</span>
          <span class="status-chip">{data.task.importanceLabel} importance</span>
          <span class="status-chip">{data.task.focusLabel}</span>
          <span class="status-chip">{data.task.taskTypeLabel}</span>
        </div>
      </div>
    </div>
    <div class="actions">
      <a class="btn" href={`/tasks/${data.task.id}/edit?returnTo=/tasks/${data.task.id}`}>Edit</a>
      <a class="btn" href="/tasks">Back to tasks</a>
    </div>
  </div>

  {#if form?.error}
    <div class="card error-card">{form.error}</div>
  {/if}

  <div class="grid main-grid">
    <section class="card panel">
      <h2>Details</h2>
      <div class="detail-list">
        <div><strong>Due</strong><span>{fmt(data.task.dueAt)}</span></div>
        <div><strong>Snoozed until</strong><span>{fmt(data.task.snoozedUntil)}</span></div>
        {#if data.task.status === 'DONE'}<div><strong>Completed</strong><span>{fmt(data.task.completedAt)}</span></div>{/if}
        {#if data.task.status === 'CANCELLED'}<div><strong>Cancelled</strong><span>{fmt(data.task.cancelledAt)}</span></div>{/if}
        <div><strong>Created</strong><span>{fmt(data.task.createdAt)}</span></div>
        <div><strong>Updated</strong><span>{fmt(data.task.updatedAt)}</span></div>
        {#if data.task.recurrenceLabel}<div><strong>Repeat</strong><span>{data.task.recurrenceLabel}</span></div>{/if}
      </div>

      {#if data.task.notes}
        <p class="preline">{data.task.notes}</p>
      {:else}
        <p class="muted">No notes for this task.</p>
      {/if}
      {#if data.task.summary}
        <div class="summary-box"><div class="muted small">AI summary</div><p>{data.task.summary}</p></div>
      {/if}
    </section>

    <section class="card panel">
      <h2>Quick actions</h2>
      <form method="post" action="?/updateStatus" class="field">
        <label for="status">Status</label>
        <select id="status" name="status" on:change={submitContainingForm}>
          {#each data.taskStatuses as opt}<option value={opt.value} selected={data.task.status === opt.value}>{opt.label}</option>{/each}
        </select>
      </form>
      <form method="post" action="?/updateFocus" class="field">
        <label for="focus">Focus</label>
        <select id="focus" name="focus" on:change={submitContainingForm}>
          {#each data.taskFocusOptions as opt}<option value={opt.value} selected={data.task.focus === opt.value}>{opt.label}</option>{/each}
        </select>
      </form>
      <form method="post" action="?/delete" on:submit={(event) => { if (!confirm('Delete this task?')) event.preventDefault(); }}>
        <button class="btn" type="submit">Delete task</button>
      </form>
    </section>
  </div>

  <section class="card panel">
    <h2>Attached to</h2>
    {#if !(data.task.contact || data.task.company || data.task.deal || data.task.dealContact || data.task.dealCompany || data.task.companyContact || data.task.project || data.task.workstream || data.task.marketLead || data.task.want || data.task.offer || data.task.assignedToContact || data.task.waitingOnContact || data.task.assignedToText)}
      <p class="muted">This task is not attached to anything.</p>
    {:else}
      <div class="context-row">
        {#if data.task.contact}<a class="chip" href={`/contacts/${data.task.contact.id}`}>Person: {data.task.contact.name}</a>{/if}
        {#if data.task.company}<a class="chip" href={`/companies/${data.task.company.id}`}>Company: {data.task.company.name}</a>{/if}
        {#if data.task.deal}<a class="chip" href={`/deals/${data.task.deal.id}`}>Deal: {data.task.deal.title}</a>{/if}
        {#if data.task.dealContact}<a class="chip" href={`/deals/${data.task.dealContact.dealId}/relationships/${data.task.dealContact.id}`}>Deal-person thread: {data.task.dealContact.contactName} on {data.task.dealContact.dealTitle}</a>{/if}
        {#if data.task.dealCompany}<a class="chip" href={`/companies/${data.task.dealCompany.companyId}`}>Deal-company thread: {data.task.dealCompany.companyName} on {data.task.dealCompany.dealTitle}</a>{/if}
        {#if data.task.companyContact}<a class="chip" href={`/companies/${data.task.companyContact.companyId}/contacts/${data.task.companyContact.id}`}>Company-person thread: {data.task.companyContact.contactName} at {data.task.companyContact.companyName}</a>{/if}
        {#if data.task.project}<a class="chip" href={`/projects/${data.task.project.id}`}>Project: {data.task.project.title}</a>{/if}
        {#if data.task.workstream}<a class="chip" href={`/projects/${data.task.workstream.projectId}/workstreams/${data.task.workstream.id}`}>Workstream: {data.task.workstream.name}</a>{/if}
        {#if data.task.marketLead}<a class="chip" href={`/leads/${data.task.marketLead.id}`}>Lead: {data.task.marketLead.title}</a>{/if}
        {#if data.task.want}<a class="chip" href={`/wants/${data.task.want.id}`}>Want: {data.task.want.title}</a>{/if}
        {#if data.task.offer}<a class="chip" href={`/offers/${data.task.offer.id}`}>Offer: {data.task.offer.title}</a>{/if}
        {#if data.task.assignedToContact}<a class="chip" href={`/contacts/${data.task.assignedToContact.id}`}>Assigned: {data.task.assignedToContact.name}</a>{/if}
        {#if data.task.assignedToText}<span class="chip">Assigned: {data.task.assignedToText}</span>{/if}
        {#if data.task.waitingOnContact}<a class="chip" href={`/contacts/${data.task.waitingOnContact.id}`}>Waiting on: {data.task.waitingOnContact.name}</a>{/if}
      </div>
    {/if}
  </section>
</div>

<style>
  .task-header { padding: 18px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
  .header-main { display: flex; gap: 12px; align-items: flex-start; }
  .task-icon { color: var(--accent-2); font-size: 1.8rem; line-height: 1; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  h1 { margin: 0; }
  h2 { margin: 0 0 10px; font-size: 1.1rem; }
  .muted { color: var(--muted); }
  .small { font-size: 0.9rem; }
  .meta-row, .actions, .context-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .meta-row { margin-top: 8px; color: var(--muted); }
  .panel { padding: 16px; margin-bottom: 12px; }
  .main-grid { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr); gap: 12px; }
  .detail-list { display: grid; gap: 8px; margin-bottom: 12px; }
  .detail-list div { display: grid; grid-template-columns: 130px 1fr; gap: 8px; }
  .preline { white-space: pre-wrap; }
  .summary-box { border: 1px solid var(--border); background: var(--panel); border-radius: 10px; padding: 10px; margin-top: 10px; }
  .summary-box p { margin: 4px 0 0; white-space: pre-wrap; }
  .field { display: grid; gap: 4px; margin-bottom: 10px; }
  .field label { font-size: 0.85rem; color: var(--muted); }
  .status-chip, .chip { border: 1px solid var(--border); background: var(--panel); border-radius: 999px; padding: 2px 8px; font-size: 0.8rem; color: var(--muted); }
  .chip { color: var(--text); text-decoration: none; }
  .error-card { padding: 12px; color: var(--danger); margin-bottom: 12px; }
  @media (max-width: 860px) {
    .task-header { flex-direction: column; }
    .main-grid { grid-template-columns: 1fr; }
    .actions { align-items: stretch; }
  }
</style>
