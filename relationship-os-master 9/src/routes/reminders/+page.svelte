<!-- src/routes/reminders/+page.svelte -->
<script lang="ts">
    // PURPOSE: Render overdue and upcoming reminders with links to contacts and quick actions.
    export let data: {
      overdue: Array<{ id: string; dueAt: string | Date; note: string; contactId: string; contactName: string; company: string | null }>;
      upcoming: Array<{ id: string; dueAt: string | Date; note: string; contactId: string; contactName: string; company: string | null }>;
      now: string | Date;
    };
  
    function fmt(d: string | Date) {
      const dt = typeof d === 'string' ? new Date(d) : d;
      return isNaN(dt.getTime()) ? '' : dt.toLocaleString();
    }
  </script>
  
  <div class="container">
    <div class="card" style="padding:16px; max-width:960px; margin:0 auto;">
      <h1 style="margin:0 0 12px 0;">Reminders</h1>
  
      <!-- Overdue -->
      <section style="margin-bottom:18px;">
        <h2 style="margin:0 0 8px 0; font-size:18px;">
          Overdue
          <span class="pill over">{data.overdue.length}</span>
        </h2>
  
        {#if data.overdue.length === 0}
          <p class="muted">Nothing overdue.</p>
        {:else}
          <table class="tbl">
            <thead>
              <tr>
                <th>Due</th>
                <th>Contact</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each data.overdue as r}
                <tr>
                  <td>{fmt(r.dueAt)}</td>
                  <td>
                    <a href={`/contacts/${r.contactId}`}>{r.contactName}</a>
                    {#if r.company}<span class="muted"> - {r.company}</span>{/if}
                  </td>
                  <td>{r.note}</td>
                  <td class="actions">
                    <form method="post" action="?/complete" style="display:inline;">
                      <input type="hidden" name="id" value={r.id} />
                      <button class="btn">Done</button>
                    </form>
                    <form method="post" action="?/remove" style="display:inline;" on:submit={(e) => { if (!confirm('Delete this reminder')) e.preventDefault(); }}>
                      <input type="hidden" name="id" value={r.id} />
                      <button class="btn">Delete</button>
                    </form>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </section>
  
      <!-- Upcoming -->
      <section>
        <h2 style="margin:0 0 8px 0; font-size:18px;">
          Upcoming
          <span class="pill due">{data.upcoming.length}</span>
        </h2>
  
        {#if data.upcoming.length === 0}
          <p class="muted">No upcoming reminders.</p>
        {:else}
          <table class="tbl">
            <thead>
              <tr>
                <th>Due</th>
                <th>Contact</th>
                <th>Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each data.upcoming as r}
                <tr>
                  <td>{fmt(r.dueAt)}</td>
                  <td>
                    <a href={`/contacts/${r.contactId}`}>{r.contactName}</a>
                    {#if r.company}<span class="muted"> - {r.company}</span>{/if}
                  </td>
                  <td>{r.note}</td>
                  <td class="actions">
                    <form method="post" action="?/complete" style="display:inline;">
                      <input type="hidden" name="id" value={r.id} />
                      <button class="btn">Done</button>
                    </form>
                    <form method="post" action="?/remove" style="display:inline;" on:submit={(e) => { if (!confirm('Delete this reminder')) e.preventDefault(); }}>
                      <input type="hidden" name="id" value={r.id} />
                      <button class="btn">Delete</button>
                    </form>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      </section>
    </div>
  </div>
  
  <style>
    .muted { color: var(--muted); }
    .tbl {
      width: 100%;
      border-collapse: collapse;
    }
    .tbl th, .tbl td {
      text-align: left;
      padding: 8px 6px;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    .actions { text-align: right; white-space: nowrap; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 8px;
      background: var(--surface-2);
      border: 1px solid var(--border);
      color: var(--text);
      text-decoration: none;
      cursor: pointer;
      margin-left: 6px;
    }
    .btn:hover { background: var(--surface-3); }
    .pill {
      display: inline-block;
      min-width: 20px;
      padding: 2px 6px;
      border-radius: 9999px;
      font-size: 12px;
      text-align: center;
      background: var(--surface-2);
      color: var(--muted);
      border: 1px solid var(--border);
      margin-left: 6px;
    }
    .pill.over { background: #fee2e2; color: #991b1b; border-color: #fecaca; }
    .pill.due  { background: #e5f4ff; color: #0369a1; border-color: #bae6fd; }
  </style>
  