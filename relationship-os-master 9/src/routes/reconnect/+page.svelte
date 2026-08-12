<!-- src/routes/reconnect/+page.svelte -->
<script lang="ts">
    // PURPOSE: Render contacts due to reconnect with simple status
    export let data: {
      now: string | Date;
      due: Array<{
        id: string;
        name: string;
        company: string | null;
        cadenceDays: number | null;
        lastContactedAt: string | Date | null;
        nextDue: string | Date;
        daysOver: number;
      }>;
    };
  
    function fmt(d: string | Date | null) {
      if (!d) return '';
      const dt = typeof d === 'string' ? new Date(d) : d;
      return isNaN(dt.getTime()) ? '' : dt.toLocaleString();
    }
  
    function statusText(daysOver: number) {
      if (daysOver === 0) return 'Due today';
      if (daysOver > 0) return `${daysOver} day${daysOver === 1 ? '' : 's'} overdue`;
      return '';
    }
  </script>
  
  <div class="container">
    <div class="card" style="padding:16px; max-width:900px; margin:0 auto;">
      <h1 style="margin:0 0 8px 0;">Reconnect</h1>
      <p class="muted" style="margin:0 0 16px 0;">As of {fmt(data.now)}</p>
  
      {#if data.due.length === 0}
        <p class="muted">No contacts are due to reconnect.</p>
      {:else}
        <table class="tbl">
          <thead>
            <tr>
              <th>Contact</th>
              <th>Company</th>
              <th>Cadence</th>
              <th>Last contacted</th>
              <th>Next due</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {#each data.due as c}
              <tr>
                <td>{c.name}</td>
                <td>{c.company ?? ''}</td>
                <td>{c.cadenceDays ?? ''}{c.cadenceDays ? ' days' : ''}</td>
                <td>{fmt(c.lastContactedAt)}</td>
                <td>{fmt(c.nextDue)}</td>
                <td>
                  <span class="pill {c.daysOver > 0 ? 'over' : 'due'}">{statusText(c.daysOver)}</span>
                </td>
                <td>
                  <a class="btn" href={`/contacts/${c.id}`}>Open</a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
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
    }
    .btn:hover { background: var(--surface-3); }
    .pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 9999px;
      font-size: 12px;
      background: var(--surface-2);
      color: var(--muted);
    }
    .pill.due { background: #e5f4ff; color: #0369a1; border: 1px solid #bae6fd; }
    .pill.over { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
  </style>
  