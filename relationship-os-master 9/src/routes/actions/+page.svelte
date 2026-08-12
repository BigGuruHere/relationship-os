<!-- src/routes/actions/+page.svelte -->
<script lang="ts">
  // PURPOSE: Daily action dashboard for reconnect cadence, reminders, and tasks.
  export let data: any;

  function fmt(value: string | Date | null | undefined) {
    if (!value) return 'No date';
    const d = typeof value === 'string' ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return 'No date';
    return d.toLocaleString();
  }
</script>

<section class="inbox container">
  <div class="page-head">
    <div>
      <div class="eyebrow">Next best action</div>
      <h1>Actions</h1>
      <p class="muted">Cadence follow-ups, reminders, and open tasks in one place.</p>
    </div>
    <a class="btn primary" href="/tasks">Open task inbox</a>
  </div>

  <div class="summary-grid">
    <div class="card stat"><span>Tasks</span><strong>{data.tasksOpenCount}</strong></div>
    <div class="card stat"><span>Reconnects</span><strong>{data.reconnectDue}</strong></div>
    <div class="card stat"><span>Reminders</span><strong>{data.remindersOpenCount}</strong></div>
  </div>

  <div class="section">
    <div class="section-header"><h2>Tasks</h2>{#if data.tasksOpenCount > 0}<span class="pill">{data.tasksOpenCount}</span>{/if}</div>
    {#if data.tasks.length === 0}
      <p class="muted">No open tasks. Nice work.</p>
    {:else}
      <ul class="list">
        {#each data.tasks as task}
          <li class="card item-card">
            <div class="row">
              <div class="main">
                <div class="name">{task.title}</div>
                <div class="meta">{task.taskTypeLabel} - {task.statusLabel} - {task.urgencyLabel} - due {fmt(task.dueAt)}</div>
                <div class="meta">
                  {#if task.contact}<a href={`/contacts/${task.contact.id}`}>{task.contact.name}</a>{/if}
                  {#if task.deal} {task.contact ? ' - ' : ''}<a href={`/deals/${task.deal.id}`}>{task.deal.title}</a>{/if}
                  {#if task.dealContact} - <a href={`/deals/${task.dealContact.dealId}/relationships/${task.dealContact.id}`}>Thread: {task.dealContact.contactName}</a>{/if}
                  {#if task.waitingOnContact} - waiting on <a href={`/contacts/${task.waitingOnContact.id}`}>{task.waitingOnContact.name}</a>{/if}
                </div>
              </div>
              <a class="btn small" href="/tasks">Manage</a>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="section">
    <div class="section-header"><h2>Reconnect</h2>{#if data.reconnectDue > 0}<span class="pill">{data.reconnectDue}</span>{/if}</div>
    {#if data.dueReconnects.length === 0}
      <p class="muted">No reconnects due.</p>
    {:else}
      <ul class="list">
        {#each data.dueReconnects as c}
          <li class="card item-card">
            <div class="row">
              <div class="main">
                <div class="name">{c.displayName || 'Unknown'}</div>
                <div class="meta">{c.position || ''}{c.position && c.company ? ' - ' : ''}{c.company || ''}</div>
              </div>
              <a class="btn small" href={`/contacts/${c.id}`}>Open</a>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="section" id="reminders">
    <div class="section-header"><h2>Reminders</h2>{#if data.remindersOpenCount > 0}<span class="pill">{data.remindersOpenCount}</span>{/if}</div>
    {#if data.reminders.length === 0}
      <p class="muted">No open reminders.</p>
    {:else}
      <ul class="list">
        {#each data.reminders as r}
          <li class="card item-card">
            <div class="row">
              <div class="main">
                <div class="name">{r.title}</div>
                <div class="meta">Due {fmt(r.dueAt)} - <a href={`/contacts/${r.contactId}`}>{r.contactName}</a></div>
              </div>
              {#if r.contactId}<a class="btn small" href={`/contacts/${r.contactId}`}>Contact</a>{/if}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>
</section>

<style>
  .inbox { padding: 1rem; }
  .page-head, .row, .section-header { display: flex; justify-content: space-between; gap: 12px; align-items: flex-start; }
  .eyebrow { color: var(--accent); font-weight: 700; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; }
  h1 { margin: 0; }
  h2 { margin: 0; font-size: 1.1rem; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin: 12px 0; }
  .stat { padding: 12px; display: grid; gap: 4px; }
  .stat span { color: var(--muted); font-size: 0.9rem; }
  .stat strong { font-size: 1.5rem; }
  .section { margin-top: 1rem; }
  .list { list-style: none; padding: 0; margin: .5rem 0 0; display: grid; gap: .5rem; }
  .item-card { padding: .75rem; }
  .name { font-weight: 600; }
  .meta { font-size: .85rem; color: var(--muted); }
  .btn.small { font-size: .85rem; padding: .35rem .6rem; }
  .muted { color: var(--muted); }
  @media (max-width: 720px) { .page-head, .row { flex-direction: column; align-items: stretch; } .summary-grid { grid-template-columns: 1fr; } }
</style>
